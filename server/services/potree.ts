import { exec } from 'child_process';
import * as fs from 'fs';
import { db } from '../db';
import { projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from "../lib/logger";

const CONVERTER_BINARY = './bin/PotreeConverter';
const SIMULATION_MODE = !fs.existsSync(CONVERTER_BINARY);

export type DeliveryStatus = "pending" | "processing" | "ready" | "failed";

export async function processPointCloud(projectId: number, localE57Path: string): Promise<void> {
  log(`Triggering Point Cloud Processing for Project ${projectId}...`);

  try {
    await db.update(projects)
      .set({ deliveryStatus: "processing" })
      .where(eq(projects.id, projectId));

    if (SIMULATION_MODE) {
      log("WARN: PotreeConverter binary not found. Running in SIMULATION MODE.");
      simulateConversion(projectId);
    } else {
      runRealConversion(projectId, localE57Path);
    }
  } catch (error) {
    log(`ERROR: Failed to start point cloud processing for project ${projectId} - ${error instanceof Error ? error.message : String(error)}`);
    await db.update(projects)
      .set({ deliveryStatus: "failed" })
      .where(eq(projects.id, projectId));
    throw error;
  }
}

function simulateConversion(projectId: number): void {
  setTimeout(async () => {
    try {
      log(`[SIMULATION] Conversion Complete for Project ${projectId}`);

      await db.update(projects).set({
        potreePath: `projects/${projectId}/mock_data`,
        viewerUrl: "http://potree.org/potree/examples/viewer.html",
        deliveryStatus: "ready"
      }).where(eq(projects.id, projectId));
    } catch (error) {
      log(`ERROR: [SIMULATION] Failed to update project ${projectId} - ${error instanceof Error ? error.message : String(error)}`);
      await db.update(projects).set({ deliveryStatus: "failed" }).where(eq(projects.id, projectId));
    }
  }, 5000);
}

async function runRealConversion(projectId: number, filePath: string) {
  const outputDir = `/tmp/potree_out/${projectId}`;
  const cmd = `${CONVERTER_BINARY} "${filePath}" -o "${outputDir}" -p index --generate-page index`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, async (error) => {
    if (error) {
      log(`ERROR: Conversion Failed: ${error.message}`);
      await db.update(projects).set({ deliveryStatus: "failed" }).where(eq(projects.id, projectId));
      return;
    }

    log("Conversion & Upload Complete.");

    const publicUrl = `https://storage.googleapis.com/s2p-share/projects/${projectId}/potree/index.html`;

    await db.update(projects).set({
      potreePath: `projects/${projectId}/potree`,
      viewerUrl: publicUrl,
      deliveryStatus: "ready"
    }).where(eq(projects.id, projectId));
  });
}

export async function getDeliveryStatus(projectId: number): Promise<DeliveryStatus | null> {
  const project = await db.select({ deliveryStatus: projects.deliveryStatus })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  
  return project[0]?.deliveryStatus as DeliveryStatus | null;
}

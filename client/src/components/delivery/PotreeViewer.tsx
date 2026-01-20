import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface PotreeViewerProps {
  cloudUrl: string;
  height?: string;
}

declare global {
  interface Window {
    Potree: any;
    THREE: any;
  }
}

export function PotreeViewer({ cloudUrl, height = "500px" }: PotreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!cloudUrl) {
      setError("No point cloud URL provided");
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadPotree() {
      try {
        if (!window.Potree) {
          await loadScript("https://cdn.jsdelivr.net/npm/potree-core@1.0.0/dist/potree.min.js");
        }

        if (!mounted || !containerRef.current) return;

        const viewer = new window.Potree.Viewer(containerRef.current);
        viewerRef.current = viewer;

        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.loadSettingsFromURL();

        viewer.setBackground("gradient");
        viewer.setDescription("");

        window.Potree.loadPointCloud(cloudUrl, "pointcloud", (e: any) => {
          if (!mounted) return;

          const pointcloud = e.pointcloud;
          const material = pointcloud.material;

          material.size = 1;
          material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
          material.shape = window.Potree.PointShape.SQUARE;

          viewer.scene.addPointCloud(pointcloud);
          viewer.fitToScreen();
          setLoading(false);
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load point cloud viewer");
          setLoading(false);
        }
      }
    }

    loadPotree();

    return () => {
      mounted = false;
      if (viewerRef.current) {
        try {
          viewerRef.current.scene.pointclouds.forEach((pc: any) => {
            viewerRef.current.scene.removePointCloud(pc);
          });
        } catch (e) {
        }
      }
    };
  }, [cloudUrl]);

  if (error) {
    return (
      <div 
        className="flex flex-col items-center justify-center bg-muted/50 rounded-lg"
        style={{ height }}
      >
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium">Failed to load 3D viewer</p>
        <p className="text-muted-foreground text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10 rounded-lg">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Loading 3D Point Cloud...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ height }}
        data-testid="potree-viewer-container"
      />
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

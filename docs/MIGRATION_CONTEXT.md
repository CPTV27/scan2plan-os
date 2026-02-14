# 📂 Drive-to-Cloud Migration: Architecture & Naming Standards

**Status:** Phase 2 (Mapping & Cleanup) -> Phase 3 (Execution)
**Objective:** Migrate 30TB of unstructured Google Drive data to structured Google Cloud Storage (GCS).

## 1. The Core Shift

We are moving from "Human-Readable" folder nesting to "Machine-Readable" flat structures.

* **Old World (Google Drive):** `Active Projects / 2024 / 123 Main St - Client Name / ...`
* **New World (GCS):** `gs://scan2plan-projects/projects/{project_token}/`

## 2. Naming Convention (The "Project Token")

All project folders in the cloud will be normalized using a strict **Project Token**. The OS code must use this token to locate project assets.

**Format:** `[address-slug]_[delivery-date]`

* **`address-slug`**: Kebab-case first line of address (e.g., `123-main-st`).
* **`delivery-date`**: ISO 8601 (e.g., `2024-03-15`).

**Examples:**

* `123-main-st_2024-03-15`
* `4-bond-st-front-facade_2023-04-26`

## 3. Data Structure

The GCS bucket will follow this strict hierarchy. The `scan2plan-os` backend should be configured to read from this path:

```text
gs://scan2plan-projects/
└── projects/
    ├── 123-main-st_2024-03-15/
    │   ├── raw/                # (LiDAR, E57, RCS)
    │   ├── revit/              # (RVT, IFC)
    │   ├── cad/                # (DWG, DXF)
    │   ├── assets/             # (Photos, 360s)
    │   └── project_summary.json # (Metadata Sidecar)
    └── 99-broadway_2024-01-20/
        └── ...
```

## 4. Metadata Injection (Sidecars)

Since GCS folders don't have "attributes," we are injecting a `project_summary.json` (or `.txt`) into every project folder during migration.
**The OS should read this file to populate the UI.**

**Payload:**

```json
{
  "project_id": "CP-001",
  "client": "Acme Corp",
  "lod": "300",
  "sqft": 5200,
  "original_drive_path": "Active Projects/123 Main St/",
  "migration_date": "2026-02-14"
}
```

## 5. Migration Strategy (Underway)

We are currently generating a **Migration Manifest** (`Complete_Migration_Manifest.csv`) that maps every legacy Google Drive folder to its new GCS Token.

* **Mapping Logic:** Fuzzy matching legacy folder names against Airtable "Project Name" records.
* **Execution Tool:** `rclone` (using `rclone copy` with the manifest map).
* **Current Status:** 73% of folders (Active & Archive) have been automatically matched. Manual review is in progress for the remaining 27%.

---

## For the Developer / Agent

* **Do not** build logic that relies on the old Google Drive API file IDs. They will become obsolete.
* **Do** build logic that expects a `project_token` as the primary key for file retrieval.
* **Prepare** the backend to read `project_summary.json` from the GCS bucket to "discover" projects, rather than scanning folders recursively.

---

## 6. Migration Manifest Status

* **Inventory:** 462,116 files cataloged from `/Users/chasethis` root directory.
* **Master Data:** `Complete_Migration_Manifest.csv` (112 MB).
* **Field Schema:** `File Name`, `Path`, `Size (KB)`, `Last Modified`, `Action Required`, `Status`.
* **Key Obstacle:** High volume of "online-only" (dataless) Dropbox files caused initial scan failures; script uses `try/except` blocks to skip these.
* **Migration Google Sheet:** https://docs.google.com/spreadsheets/d/1tlYLMyIny24_6WREKxfiPF_9_9kzFfwbmsAl_JGRVWk/edit?usp=sharing
* **Slicer Needed:** Ingest files >10MB from manifest to populate the Sheet (full 112MB CSV is too large for Google Sheets).

## 7. Firestore SSOT Structure

Metadata from validated files writes to:
```
/projects/{projectId}/file_registry/{fileId}
```

### Parameters Extracted
* Point Density (points per mm/sqft)
* Sensor/Scanner Metadata
* Coordinate System integrity

### Variance Analysis
File registry links to **BigQuery variance oracle** — compares actual technical complexity delivered against original estimate.

## 8. Integration Checklist for Developers

1. **Slicer:** Ingest sliced manifest (files >10MB) into the Migration Google Sheet.
2. **Eventarc:** Configure to listen for GCS `object.finalize` events to start metadata extraction.
3. **RAG Engine:** Management software must query **Vertex AI RAG Engine** (containing 2025 LOD Spec) to validate if extracted metadata meets contracted standards.

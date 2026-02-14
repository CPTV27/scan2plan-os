# Engineering Assessment: Scan2Plan OS Implementation

> **Source:** External agent review of `CPTV27/scan2plan-os`
> **Date:** 2026-02-14
> **Status:** Filed for team review — open questions need answers

---

## Recommendation: Start with Phase 1 (Foundation & Migration)

**Rationale:** Phase 3 (Vertex AI) cannot function without the Firestore SSOT. The legacy PostgreSQL schema must be decoupled before new engines can be built on top.

---

## Architecture Gaps Identified

### 1. Database Dual-Write Complexity 🔴
The project uses legacy PostgreSQL but proposes Firestore as the new SSOT. **No documented sync strategy exists.** If not addressed, state divergence during migration.

**Decision needed:** Clean break (Firestore for new projects only) or sync layer?

### 2. Point Cloud Processing Bottleneck 🟡
Cloud Run proposed for `.e57`/`.rcp` metadata extraction across 462K files. Many are multi-gigabyte point clouds. Standard Cloud Run instances may hit:
- 3600s timeout
- 32GB memory limit

**Mitigation:** Use Cloud Run Jobs (not Services) for batch processing, or offload to Dataflow.

### 3. "Dataless" File Blindspot 🔴
462K files include "online-only" Dropbox placeholders. If GCS transfer doesn't trigger "make available offline" first, migration produces **zero-byte files** → breaks metadata extraction.

**Mitigation:** Pre-filter manifest for dataless files. Run `rclone` with `--dropbox-chunk-size` and availability checks.

### 4. Google Chat Provisioning Rate Limits 🟡
Auto-provisioning Chat spaces per project. Google Workspace has strict per-user rate limits on space creation. Migrating hundreds of projects at once → potential API lockout.

**Mitigation:** Rate-limit provisioning. Batch with exponential backoff. Only provision for active projects.

---

## 3-Day Sprint Plan: Phase 1

### Day 1: Infrastructure as Code
- [ ] Deploy GCS bucket hierarchy: `/incoming`, `/active`, `/quarantine`
- [ ] Initialize Firestore collections: `projects`, `file_registry`
- [ ] Define schema per master project record spec

### Day 2: Quarantine Cloud Function
- [ ] Deploy `cloud-functions/quarantine/main.py` with SOP_PC_001 regex
- [ ] Configure Eventarc: `google.storage.object.v1.finalized` trigger
- [ ] Test with compliant + non-compliant filenames
- [ ] Wire Google Chat webhook for quarantine alerts

### Day 3: Manifest Slicing & Pilot Transfer
- [ ] Run slicer on 112MB manifest → isolate files >10MB
- [ ] Pilot transfer of 50 project folders to GCS
- [ ] Verify Firestore `file_registry` updates
- [ ] Verify quarantine movements for non-compliant names

---

## Open Technical Questions

| # | Question | Context |
|---|---|---|
| 1 | **PostgreSQL sync:** Keep legacy DB in sync with Firestore during Phase 1, or clean break for new projects? | Affects all backend routes |
| 2 | **Auth integration:** Can existing Express/Passport.js Google OAuth be leveraged for Firebase Auth, or new identity provider needed? | See `server/replit_integrations/auth/` |
| 3 | **Storage costs:** Has a GCS lifecycle policy been defined for `/quarantine` and `/staging` buckets? | 462K files, many multi-GB |
| 4 | **E57/RCP library:** Is there a preferred C++/Python library (PDAL, laspy) already vetted for the point cloud versions S2P uses? | Trimble X7 output format |

---

## Responses (To Be Filled)

| # | Answer | Decided By | Date |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

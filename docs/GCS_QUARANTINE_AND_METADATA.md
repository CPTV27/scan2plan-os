# GCS Quarantine & Metadata Extraction

> **Source:** Cross-agent spec (Infrastructure agent)
> **Date:** 2026-02-14
> **Relates to:** Execution Engine (Phase 4), Evidence Vault

---

## Context

462,116 files cataloged across Google Drive. Moving from discovery to enforcement.
The goal: turn SOPs from static documents into **automated gatekeepers**.

---

## 1. GCS Quarantine Cloud Function

**Location:** `cloud-functions/quarantine/main.py`
**Trigger:** GCS Eventarc (object.finalize on incoming bucket)
**Action:** Validate file name against SOP_PC_001 regex → quarantine if non-compliant

### SOP_PC_001 Naming Pattern
```regex
^\d{8}_[A-Z0-9]+_[A-Za-z0-9]+_LoD\d{3}\.[a-z0-9]+$
```
**Example compliant name:** `20260214_CP001_Interior_LoD300.e57`

### Deployment Steps
1. Set up `test-incoming` bucket in Google Cloud Console
2. Deploy the function:
   ```bash
   gcloud functions deploy validate_naming_convention \
     --gen2 \
     --runtime=python311 \
     --trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \
     --trigger-event-filters="bucket=test-incoming" \
     --source=cloud-functions/quarantine/
   ```
3. Test with compliant and non-compliant filenames
4. Wire Google Chat webhook for quarantine alerts

---

## 2. Metadata Extraction (Post-Validation)

Once a file passes the name test, extract technical truth from the file itself.

### Architecture
- **Cloud Run service** peeks inside E57/RCP file headers
- **Point Density Check:** Compare recorded density against LoD standards
- **File Registry:** Write extracted metadata to Firestore

### Extracted Fields
| Field | Source | Purpose |
|---|---|---|
| Scan Date | E57 header | Timeline verification |
| Point Density (pts/m²) | E57 header | LoD compliance check |
| Point Count | E57 header | Coverage verification |
| RMS Accuracy | Registration report | Quality metric |
| Coordinate System | E57 header | Alignment verification |

### Firestore Write
A 2GB point cloud file becomes a lightweight Firestore document with all the "truth" Owen needs to generate a Proof of Quality certificate.

---

## 3. Migration Manifest

- **Total files cataloged:** 462,116
- **Manifest size:** 112MB CSV (too large for Google Sheets)
- **Priority filter:** Files >10MB that require immediate migration decisions
- **Next step:** Run "Slicer" script to extract high-priority subset

---

## 4. Infrastructure Config Needed

- [ ] Create `test-incoming` GCS bucket
- [ ] Deploy quarantine Cloud Function
- [ ] Define Firestore subcollection structure (Estimates vs. Actuals)
- [ ] Set up Google Chat webhook for quarantine alerts
- [ ] Build Cloud Run service for E57/RCP header parsing

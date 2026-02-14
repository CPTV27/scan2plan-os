# Scan2Plan OS v3 — Roadmap

> **Last Updated:** 2026-02-14
> **Authors:** Chase (CPTV27) + Elijah (ElijahFitzgeraldTuttle)
> **Production:** `pipeline.scan2plan.dev` (Railway)
> **Source:** Owen's Strategy Manual, TKB, SOPs, LOD 2025 Specs
> **Agents:** Both developers use Antigravity. Shared context in `.agent/CONTEXT.md`.

---

## Current State

This repo is a **99K-line production CRM** built by Chase and Elijah, currently live on Railway. It handles the full Scan2Plan lifecycle:

| Module | Status | Notes |
|---|---|---|
| Sales Pipeline (Kanban) | ✅ Live | Leads, deals, autosave |
| CPQ Calculator | ✅ Live | 8 pricing matrices, Tier A pricing, quote versioning |
| Proposal Builder | ✅ Live | WYSIWYG editor, PDF export, client signatures |
| Production Pipeline | ✅ Live | Scheduling → Scanning → Registration → Modeling → QC → Delivered |
| QuickBooks | ✅ Wired | 48K-line integration |
| PandaDoc | ✅ Wired | Document signing |
| GoHighLevel | ✅ Wired | Lead intake webhooks |
| Google Drive | ✅ Wired | File storage (being migrated to GCS) |
| Google Cloud Storage | ⚡ Partial | Client exists, no automation |
| AI Chat | ✅ Live | OpenAI-powered |

**Known issues:** Some features from Chase's original fast build are broken or dormant. Health check required before adding new engines.

---

## The Upgrade: Four Engines

Owen's architecture brief defines four engines to build on top of this foundation. Each engine enforces business logic from the Strategy Manual, TKB, and SOPs.

```
┌──────────────────────────────────────────────────────────┐
│                   SCAN2PLAN OS v3                         │
├──────────┬───────────┬────────────┬──────────────────────┤
│ ESTIMATOR│  PROMISE   │ EXECUTION  │   MATT AGENT         │
│ ENGINE   │  ENGINE    │ ENGINE     │   (Marketing)        │
│          │            │            │                      │
│ 65/35    │ Cert of    │ GCS Auto   │ Vertex AI Agent      │
│ +15%Risk │ Assurance  │ Quarantine │ LOD 2025 Citations   │
│ Travel   │ LoA-40/30  │ Chat Alert │ LinkedIn Posts       │
│ LOD 350  │ Method A+B │ ETL Drive  │ Case Study PDFs      │
├──────────┴───────────┴────────────┴──────────────────────┤
│              PostgreSQL (Drizzle ORM)                     │
├──────────────────────────────────────────────────────────┤
│              Railway → Google Cloud Run                   │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: Harden What's Live
**Timeline:** Weeks 1–2
**Priority:** 🔴 Critical — fix before building new

| Task | Owner | Status |
|---|---|---|
| Run app locally, catalog all broken features | Chase + Elijah | 🔲 |
| Fix critical CPQ calculator bugs | TBD | 🔲 |
| Fix critical proposal builder bugs | TBD | 🔲 |
| Verify production pipeline flow end-to-end | TBD | 🔲 |
| Health check QuickBooks integration | TBD | 🔲 |
| Health check PandaDoc integration | TBD | 🔲 |
| Health check GoHighLevel webhooks | TBD | 🔲 |
| Clean up debug logs and temp files in repo | TBD | 🔲 |

**Definition of Done:** All existing features that are supposed to work, actually work. No regressions.

---

## Phase 2: Estimator Engine (Margin Protection)
**Timeline:** Weeks 3–4
**Priority:** 🔴 Critical — this is the core revenue logic
**Source:** Strategy Manual P1, P12; LOD Spec 2025 pg 53

| Task | Owner | Status |
|---|---|---|
| Add 65/35 interior/exterior weighting split | TBD | 🔲 |
| Add +15% occupied building risk premium | TBD | 🔲 |
| Add hidden travel fee (>75mi, ≥2 days → fold into Architecture fee) | TBD | 🔲 |
| Add LOD 350 Steel auto-buffer (gusset plates/connection details) | TBD | 🔲 |
| Make pricing records immutable after quote lock | TBD | 🔲 |
| Add `estimatedMargin` field, lock at quote time | TBD | 🔲 |
| Add variance tracking (estimated vs actual margin) | TBD | 🔲 |
| Write tests for all business logic rules | TBD | 🔲 |

**Definition of Done:** Every quote generated enforces Owen's margin rules. Quotes cannot be modified after lock. Margin delta is trackable.

---

## Phase 3: Promise Engine (Certificate of Assurance)
**Timeline:** Weeks 5–6
**Priority:** 🟡 High — legal/trust differentiator
**Source:** Strategy Manual P14; TKB 6.1, 6.2

| Task | Owner | Status |
|---|---|---|
| Write certificate template text (human-authored, no AI slop) | Chase/Owen | 🔲 |
| Map scope inputs → USIBD standards (LoA-40, LoA-30) | TBD | 🔲 |
| Auto-select validation method (Method A + B) from TKB 6.2 | TBD | 🔲 |
| Inject LOD 2025 spec text for selected LOD level | TBD | 🔲 |
| Generate PDF via PDFKit (match proposal styling) | TBD | 🔲 |
| Attach certificate to proposal workflow | TBD | 🔲 |
| Store certificate URL in project record | TBD | 🔲 |

**Definition of Done:** Clicking "Generate Quote" produces a Certificate of Assurance PDF that cites the exact USIBD/LOD standards for the sold scope.

---

## Phase 4: Execution Engine (GCS + Quarantine)
**Timeline:** Weeks 7–8
**Priority:** 🟡 High — operational discipline
**Source:** SOP_PC_001, SOP_PC_001 Sec 8

| Task | Owner | Status |
|---|---|---|
| Build "Deal Won" trigger → auto-create GCS folder hierarchy | TBD | 🔲 |
| Implement SOP_PC_001 folder structure (Full/Light/Production/QA/Deliverables) | TBD | 🔲 |
| Build quarantine Cloud Function (naming regex enforcement) | TBD | 🔲 |
| Wire Google Chat API alerts for quarantined files | TBD | 🔲 |
| Build metadata extraction from E57/RCP file headers | TBD | 🔲 |
| Map extracted metadata back to project record | TBD | 🔲 |
| Begin ETL: Google Drive archive → GCS | Chase | 🔲 |

**Archive source:** https://drive.google.com/drive/folders/1N4uXymvepbK86drCu9wWmFX8eEr7U2b3?usp=drive_link
*(Additional project links pending from Chase)*

**Migration spec:** See `docs/MIGRATION_CONTEXT.md` for GCS bucket structure, project token format, and metadata sidecar schema.

**Point Cloud Viewer:** Integrate [Potree](https://github.com/potree/potree) (open-source WebGL viewer) to display point clouds from GCS. Prior development exists — needs a working demo with real S2P point cloud data.

**360 Virtual Tours:** Build a web-based 360° tour viewer for panoramic images captured by the Trimble X7 scanner. **Floor-plan-anchored navigation** — use the generated 2D floor plan as an interactive map, click scan positions to open the corresponding 360° panorama (Matterport-style UX). Open-source options: [Marzipano](https://www.marzipano.net/) or [Pannellum](https://pannellum.org/). Load from GCS `assets/` folder. Client deliverable + marketing asset.

**Definition of Done:** Closing a deal auto-creates the correct folder structure. Uploading a non-compliant file triggers quarantine + PM alert.

---

## Phase 5: Matt Agent (Marketing Automation)
**Timeline:** Weeks 9–10
**Priority:** 🟢 Medium — high value but not urgent
**Source:** Strategy Manual P20, P22

| Task | Owner | Status |
|---|---|---|
| Build Vertex AI agent that reads project records | TBD | 🔲 |
| Create retrieval pipeline for LOD 2025 citations | TBD | 🔲 |
| Generate technical LinkedIn posts (cite LoA achieved) | TBD | 🔲 |
| Match project scope → P20 "Castle" proof tile library | TBD | 🔲 |
| Generate case study PDFs | TBD | 🔲 |
| Build anti-slop filter into all generated text | TBD | 🔲 |

**Definition of Done:** After a project is delivered, the Matt Agent generates a draft LinkedIn post and case study PDF with zero AI slop, citing real numbers.

---

## Phase 6: Platform Migration (Parallel)
**Priority:** 🟢 Medium — infrastructure upgrade

| Task | Owner | Status |
|---|---|---|
| Containerize Express app (Dockerfile for Cloud Run) | TBD | 🔲 |
| Swap OpenAI → Gemini (`@google/genai` already in deps) | TBD | 🔲 |
| Set up GitHub Actions CI/CD → Cloud Run | TBD | 🔲 |
| Migrate PostgreSQL to Cloud SQL (or evaluate Firestore) | TBD | 🔲 |
| DNS cutover: `pipeline.scan2plan.dev` → Cloud Run | TBD | 🔲 |
| Decommission Railway | TBD | 🔲 |

**Definition of Done:** App runs on Google Cloud Run with automated deploys from `main` branch.

---

## Phase 7: Anti-Slop & Document Distillation (Parallel)
**Priority:** 🟢 Medium — quality layer

| Task | Owner | Status |
|---|---|---|
| Build `deslop()` utility function | TBD | 🔲 |
| Define banned patterns list (see `.agent/CONTEXT.md`) | Done | ✅ |
| Distill Owen's 535-page ChatGPT doc → ≤50 pages | TBD | 🔲 |
| Inject distilled content into Vertex AI Vector Search | TBD | 🔲 |
| Add anti-slop system prompt to all AI text generation | TBD | 🔲 |

**Definition of Done:** No text output from any module contains AI slop. Owen's source docs are distilled to pure signal.

---

## Shared Context Between Velvet Grit & S2P

The **velvet-grit** repo (`github.com/CPTV27/velvet-grit`) contains:
- `SCAN2PLAN_OS_v3.md` — Full architecture spec with Firestore schema design
- `S2P_CODEBASE_AUDIT.md` — Audit of this codebase
- `MASTER_ARCHITECTURE.md` — Entity hierarchy (Big Muddy → Scan2Plan → Iron Clad)

Reusable patterns from velvet-grit:
- Admin Console (PIN gate + readability toggle)
- Operator AI pattern (Gemini function calling)
- Oracle AI pattern (Grok strategic analysis)
- Anti-slop filter spec

---

## Open Decisions

| # | Decision | Options | Status |
|---|---|---|---|
| 1 | **Database** | Keep PostgreSQL (works, 2.6K-line Drizzle schema) vs. migrate to Firestore (Owen's spec) | TBD |
| 2 | **AI Provider** | Keep OpenAI (current) vs. swap to Gemini (GCP-native) | TBD |
| 3 | **Hosting** | Stay on Railway vs. move to Cloud Run | TBD |
| 4 | **Frontend** | Keep React SPA + Vite vs. move to Next.js App Router | Keep SPA |

---

## Source Authority Map

Every business rule traces to a source document:

| Rule | Source | Section |
|---|---|---|
| 65/35 Interior/Exterior split | Strategy Manual | P12 |
| +15% Occupied risk premium | Strategy Manual | P12 |
| Travel hidden in Architecture fee | Strategy Manual | P12 |
| LOD 350 Steel gusset plate buffer | LOD Spec 2025 | pg 53 |
| LoA-40 Point Cloud standard | TKB | 6.1 |
| LoA-30 BIM Model standard | TKB | 6.1 |
| Validation Method A+B | TKB | 6.2 |
| Certificate of Assurance | Strategy Manual | P14 |
| Folder provisioning | SOP_PC_001 | — |
| Quarantine alerting | SOP_PC_001 | Sec 8 |
| Castle proof library | Strategy Manual | P20 |
| Marketing automation | Strategy Manual | P22 |

---

## Git Workflow

```
Elijah's repo (upstream)          Chase's fork (origin)
ElijahFitzgeraldTuttle/S2P-S-P-v2    CPTV27/S2P-S-P-v2
         │                                    │
         │                                    │
         ▼                                    ▼
    main branch ◄──── PRs ────► main branch
         │                          │
         │                          ├── chase/feature-x
         ├── elijah/feature-y       ├── chase/feature-z
         │                          │
         ▼                          ▼
    pipeline.scan2plan.dev     (dev/staging)
```

- **Feature branches** for all work. Never commit directly to `main`.
- **Pull requests** for review. Both Chase and Elijah review.
- **`main`** auto-deploys to `pipeline.scan2plan.dev`.

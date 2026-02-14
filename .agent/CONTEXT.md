# Agent Context: Scan2Plan OS v3

> This file is read by Antigravity agents working on this codebase.
> Both Chase and Elijah use Antigravity. This file is the shared context.
> **Last updated:** 2026-02-14 by Chase's Antigravity instance.

---

## Who's Working Here

| Person | Role | Antigravity Instance |
|---|---|---|
| **Chase** | CEO / System Architect | Active — audited codebase, wrote v3 spec |
| **Elijah** | Lead Developer | Active — built the original S2P-S&P v2 |
| **Owen** | Strategy / Operations | Provided architecture brief (source docs via OpenAI/NotebookLM) |

## Production Environment

| Environment | URL | Platform |
|---|---|---|
| Production | `pipeline.scan2plan.dev` | Railway (current) |
| Dev | `localhost:5000` | Local Express + Vite |

## Git Workflow

- **`main`** = production. Auto-deploys to `pipeline.scan2plan.dev`.
- **Feature branches** for parallel work: `chase/feature-name`, `elijah/feature-name`
- **Pull requests** to merge into `main`. Both review before merge.
- **Never force push to `main`.**

---

## What We're Building (v3 Upgrade)

The existing S2P-S&P v2 is a working CRM with sales pipeline, CPQ calculator, proposal builder, and production tracking. We are upgrading it to the **Scan2Plan Operating System v3** by adding four engines on top:

### Engine 1: Estimator Engine (Priority 1)
**Inject business logic into the existing CPQ calculator.**
- If `Interior + Exterior` → force **65/35 weighting split** [Strategy Manual P12]
- If `Occupied` → apply **+15% fee** [Strategy Manual P12]
- If `Distance > 75 miles` AND `Days ≥ 2` → hide travel in Architecture fee [Strategy Manual P12]
- If `LOD 350` + Steel → add labor buffer for **gusset plates** [LOD Spec 2025, pg 53]
- Output: **immutable pricing record** (lock margin at quote time)

### Engine 2: Promise Engine (New Module)
**Auto-generate Certificate of Assurance PDF.**
- Point Cloud → hard-code **LoA-40 (≤3mm studio RMS, ≥65% overlap)** [TKB 6.1]
- BIM Model → hard-code **LoA-30 (±1/2 inch positional guidance)** [TKB 6.1]
- Validation → auto-select **Method A (Registration) + Method B (Overlap)** [TKB 6.2]
- Implementation: PDFKit or ReportLab, triggered by "Generate Quote"

### Engine 3: Execution Engine (Extend Existing GCS)
**Auto-provision project folders + quarantine non-compliant files.**
- On "Deal Won" → create SOP_PC_001 folder structure in GCS
- Monitor uploads → enforce naming regex `[ProjectCode]_[Site]_[Scope]_[Coord].ext`
- Non-compliant files → quarantine + Google Chat alert [SOP_PC_001 Sec 8]

#### GCS Migration — Archive Projects
Source data (Google Drive): https://drive.google.com/drive/folders/1N4uXymvepbK86drCu9wWmFX8eEr7U2b3?usp=drive_link

**Status:** Pending — Chase will provide additional project links.
**Task:** ETL existing project data from Google Drive/Dropbox into the new GCS bucket structure, extracting metadata to populate Firestore back-catalogue.

### Engine 4: Matt Agent (New Module)
**Auto-generate marketing content from project data.**
- Read Firestore project record (scope + QA metrics)
- Pull LOD 2025 citations
- Generate LinkedIn posts citing specific USIBD LoA achieved
- Link to P20 "Castle" proof tiles

---

## Anti-Slop Filter (Cross-Cutting)

Owen's source documents are generated via OpenAI and contain significant AI slop. **All text output must be clean.**

### Banned patterns
- "In today's fast-paced..." / "It's important to note..." / "leverage" / "utilize" / "robust" / "comprehensive" / "cutting-edge" / "streamline" / "synergy" / "ecosystem" / "best-in-class" / "moving forward"
- Repeating the same point in different words

### Voice rules
1. Active voice. Short sentences (max 25 words).
2. Specific over vague. Numbers over adjectives.
3. Say it once.

---

## Key Files in This Repo

| File | What It Does |
|---|---|
| `shared/schema/db.ts` | 2,608-line Drizzle schema — the data model |
| `shared/schema/constants.ts` | 18K lines of enums and constants |
| `server/storage.ts` | IStorage interface (27K lines) |
| `server/quickbooks-client.ts` | QuickBooks integration (48K lines) |
| `server/routes/cpq.ts` | CPQ calculator endpoints |
| `client/src/cpq/` | CPQ calculator frontend |
| `client/src/features/proposals/` | Proposal builder frontend |
| `data/*.csv` | 8 pricing matrix files |
| `CLAUDE.md` | Original Claude Code context (Elijah's) |

---

## Reference Documents (in velvet-grit repo)

These documents contain the full architecture spec and audit:
- `velvet-grit/SCAN2PLAN_OS_v3.md` — Full v3 architecture spec with Firestore schema
- `velvet-grit/S2P_CODEBASE_AUDIT.md` — Audit of this codebase
- `velvet-grit/MASTER_ARCHITECTURE.md` — High-level entity hierarchy

---

## Open Decisions

| Decision | Options | Status |
|---|---|---|
| Database | Keep PostgreSQL or migrate to Firestore? | **TBD** |
| AI Provider | Keep OpenAI or swap to Gemini? | **TBD** (Gemini pkg already in deps) |
| Hosting | Stay on Railway or move to Cloud Run? | **TBD** |
| Frontend | Keep React SPA or move to Next.js? | **Keep SPA for now** |

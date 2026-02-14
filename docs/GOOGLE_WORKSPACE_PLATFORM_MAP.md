# Google Workspace Platform Map

> **Date:** 2026-02-14
> **Principle:** Use everything included in Google Workspace before paying for external services.
> **Strategic Goal:** Build multi-tenant so this can scale to other companies.

---

## What's Included in Google Workspace (Business Plus / Enterprise)

| Service | Included? | S2P Use Case | Status |
|---|---|---|---|
| **Gemini for Workspace** | ✅ Included | AI in Docs, Sheets, Gmail — site audit summaries, proposal drafts | 🔲 Not wired |
| **Google Chat API** | ✅ Included | Auto-provision project "War Rooms" on retainer payment | 🔲 Spec written |
| **Google Drive API** | ✅ Included | Project file access, proposal storage (legacy, migrating to GCS) | ✅ In codebase |
| **Google Sheets API** | ✅ Included | Migration manifest, pricing matrices already in CSV → could be live Sheets | 🟡 Partial |
| **Gmail API** | ✅ Included | Automated project status emails, lead nurture, invoice reminders | 🔲 Not wired |
| **Google Calendar API** | ✅ Included | Auto-schedule scan dates, tech assignments, QC reviews | 🔲 Not wired |
| **Google Meet API** | ✅ Included | Auto-create project kickoff calls, client walkthrough sessions | 🔲 Not wired |
| **Google Forms** | ✅ Included | Site readiness forms (already have questions, could auto-generate Form) | 🔲 Not wired |
| **Google Docs API** | ✅ Included | Proposal templates, mission briefs as live Docs | 🔲 Not wired |
| **Google Slides API** | ✅ Included | Auto-generate project presentation decks for clients | 🔲 Not wired |
| **Google Contacts** | ✅ Included | Sync CRM contacts ↔ Google Contacts for team visibility | 🔲 Not wired |
| **Google Tasks API** | ✅ Included | Push production tasks to team members' task lists | 🔲 Not wired |
| **Admin SDK** | ✅ Included | User provisioning, org unit management | 🔲 Not wired |
| **Vault (eDiscovery)** | ✅ Included | Evidence archival, audit trail | 🔲 Not wired |

## Google Cloud (Pay-As-You-Go, but GCP credits often included)

| Service | S2P Use Case | Status |
|---|---|---|
| **Cloud Storage (GCS)** | Project file hosting, quarantine, active storage | ✅ In codebase |
| **Firestore** | Project SSOT, file registry, metadata | 🔲 Planned |
| **Cloud Run** | App hosting (migrate from Railway) | 🔲 Planned |
| **Cloud Functions** | GCS quarantine trigger, webhooks | ✅ Code written |
| **Vertex AI** | Site Reality Audit, RAG for LOD specs | 🔲 Planned |
| **BigQuery** | Variance oracle (estimate vs actual margin analysis) | 🔲 Planned |
| **Eventarc** | GCS → metadata extraction triggers | 🔲 Planned |
| **Cloud Build** | CI/CD pipeline | 🔲 Not wired |
| **Secret Manager** | API keys, OAuth tokens | 🔲 Not wired |

---

## Multi-Tenancy / Scalability Design

### The Platform Question
> "What if somebody wants to take this and do this at scale?"

The current architecture is single-tenant (one company, one database). To make this a platform:

### Tier 1: White-Label (Minimal Change)
- Fork repo, change branding, deploy to customer's GCP project
- Each customer gets their own GCS bucket, Firestore DB, Cloud Run instance
- **Effort:** Low. Works today with per-customer deployment.

### Tier 2: Multi-Tenant SaaS (Medium Change)
- Single deployment, tenant isolation via Firestore subcollections
- `tenants/{tenantId}/projects/{projectId}/...`
- Shared Cloud Run, per-tenant GCS buckets
- OAuth scoped per tenant's Google Workspace
- **Effort:** Medium. Requires auth refactor + data isolation layer.

### Tier 3: Marketplace Product (Major Change)
- Google Workspace Marketplace add-on
- Install directly into customer's Workspace
- Zero infrastructure for the customer
- You manage the platform, they pay per-seat
- **Effort:** High. Requires Marketplace certification, billing integration.

### Recommended Path
Start at **Tier 1** (it's what you're building now). The architecture decisions we're making (GCS buckets, Firestore, Cloud Run, Workspace APIs) are already aligned with Tier 2. The jump from Tier 1 → 2 is mostly adding a `tenantId` to every data path.

---

## Cost Optimization

### What You're Already Paying For (Workspace)
- Gemini, Chat, Drive, Gmail, Calendar, Meet, Docs, Sheets, Slides, Forms, Tasks, Admin, Vault
- **Use all of these before adding external services**

### What You Can Likely Cancel
| Service | Monthly | Can Replace With |
|---|---|---|
| Separate ChatGPT subscription | $20-200 | Gemini (included) or OpenRouter per-token |
| Separate Claude subscription | $20-200 | OpenRouter per-token for ad-hoc use |
| Slack (if using) | $8+/user | Google Chat (included) |
| Calendly or scheduling tool | $10+/mo | Google Calendar API (included) |
| DocuSign | $25+/mo | Already using PandaDoc; or build in-app signatures (exists in codebase) |

### OpenRouter for Agent Work
- One API key → Claude, GPT-4, Gemini, Llama, Mistral
- Pay per token instead of per subscription
- Route cheap tasks to cheap models, expensive tasks to expensive models

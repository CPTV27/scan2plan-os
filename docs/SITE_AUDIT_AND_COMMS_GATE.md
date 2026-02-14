# Site Reality Audit & Communication Gate

> **Source:** Cross-agent spec (Evidence Vault agent)
> **Date:** 2026-02-14
> **Relates to:** Estimator Engine (risk detection), Execution Engine (provisioning)

---

## Part 1: Site Reality Audit (Vertex AI + Google Maps Grounding)

### Problem: Discovery Risk
Clients omit physical site complexities from scoping notes (e.g., "Standard 2-story office" when it's actually a 5-story historic building with cornices). This causes unbudgeted contingency burn and "Day 2" price disputes.

### Solution
Use Vertex AI with Google Maps grounding to verify site conditions against scoping notes **before mobilization**.

### Technical Architecture

**File:** `server/lib/vertex-audit.ts`

- **Model:** `gemini-1.5-pro` via Vertex AI SDK
- **Grounding:** Enable `Google Search_retrieval` tool for Google Maps imagery, 3D building data, historical site records
- **Input:** Project Address + Executive Scoping Notes
- **AI Task:** Compare notes against site reality. Verify: building height, approximate footprint, presence of complex features (historic masonry, external MEP, cornices)
- **Output:** Structured JSON "Reality Report" stored in Evidence Vault

### Variance Flagging

If AI detects discrepancies:
- 5-story building where scope claims 3-story
- Historic Preservation requirements not mentioned in quote
- Complex exterior MEP not accounted for

→ System auto-sets project status to `NEEDS_REVIEW`
→ Gives objective data to adjust quote before mobilization

### Schema Addition

```typescript
// Add to projects table
googleChatSpaceId: text("google_chat_space_id"),
driveFolderId: text("drive_folder_id"),
realityAuditReport: jsonb("reality_audit_report"),
auditStatus: text("audit_status").default("pending"), // 'passed', 'failed', 'review'
```

---

## Part 2: Communication Gate (Google Chat API)

### Problem: Coordination Friction
Teams start projects without consistent communication channels, folder access, or context.

### Solution
Auto-provision a project "War Room" the moment the retainer payment clears.

### Trigger Logic

**File:** `server/routes.ts` (webhook listener)

- **Condition:** Invoice `status` changes to `PAID` for retainer type
- **Action:** Fire `provisionProjectWorkspace()` function

### Provisioning Actions

**File:** `server/lib/chat-automation.ts`

1. **Create Google Chat Space:** Named `[Project ID] | [Client Name] | [Site Name]`
2. **Membership Sync:** Auto-invite Primary Architect, Project Manager, Modeling Lead
3. **Context Injection:** Bot posts and pins "Source of Truth" message:
   - 🔗 Google Drive Folder: Direct link to project modeling directory
   - 🔗 Evidence Vault: Link to Site Reality Audit report
   - 📏 Standards Brief: Summary of committed LoA/LoD (e.g., LoD 350)

---

## Executive Impact

1. **Risk Transfer:** Site Reality Audit = defensible baseline. Client claims "simple" but AI shows historic cornices → objective proof to adjust scope.
2. **Operational Maturity:** Every project starts with consistent delivery environment (chat space, folder, context).
3. **Zero Babysitting:** The "Toll Booth" handles logistics automatically.

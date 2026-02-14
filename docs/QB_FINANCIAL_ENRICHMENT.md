# QuickBooks Financial Metadata Enrichment

> **Source:** Gemini (S2P-OS Engineering)
> **Date:** 2026-02-14
> **Relates to:** Phase 1 GCS Migration, Phase 4 Execution Engine, Phase 5 Site Audit

---

## Context

The 462K file manifest lacks financial metadata. QuickBooks (QB) holds the ground truth for:
- Which projects are paid vs. outstanding
- Physical site addresses (Ship To)
- Customer → Project ownership hierarchy

## 1. The QB-to-Manifest Join

- **Input:** "Transaction Detail by Customer" export from QB (flat file)
- **Join Key:** `Customer:Project` hierarchy maps GCS `folder_names` to physical `Ship To` addresses and payment statuses
- **Method:** Python ETL worker with fuzzy matching against existing 462K file manifest

## 2. Architectural Impact

### Schema Update
Extend PostgreSQL `site_metadata` table:
```sql
ALTER TABLE site_metadata ADD COLUMN financial_status TEXT;  -- 'paid', 'outstanding', 'partial'
ALTER TABLE site_metadata ADD COLUMN site_address_raw TEXT;  -- Raw Ship To from QB
```

### Financial Gate (New Logic)
Projects without "Paid" status in QB → diverted to **Financial Quarantine** in GCS.
- Prevents unnecessary Vertex AI compute costs on uncollected invoices
- Only paid projects proceed to Site Reality Audit

### Geocoding Pipeline
`Ship To` addresses from QB → ground-truth coordinates for automated Site Audit (Vertex AI + Maps grounding).

## 3. Token Cross-Reference

The `ProjectTokenService` must support:
- QB Customer ID → Internal Project Token lookup
- Fuzzy matching for legacy projects where naming doesn't align
- Manual override for ambiguous matches

## 4. Frontend Requirements

The Site Audit Dashboard (Phase 5) must display:
- **Payment Status** (from QB financial metadata)
- **Verified Site Address** (from QB Ship To → geocoded)

## 5. Action Items

| Task | Owner | Status |
|---|---|---|
| QB "Transaction Detail by Customer" export | Chase/Owen | 🔲 Awaiting |
| Python ETL: QB flat-file → fuzzy match against manifest | Gemini agent | 🔲 In progress |
| Harden ProjectTokenService for QB Customer ID cross-ref | TBD | 🔲 |
| Add financial_status + site_address_raw to schema | TBD | 🔲 |
| Financial Gate logic in quarantine pipeline | TBD | 🔲 |
| Site Audit Dashboard: display payment + address fields | TBD | 🔲 |

---

## Note on Existing QB Integration

The S2P codebase already has a **48K-line QuickBooks client** at `server/quickbooks-client.ts`. The ETL worker should leverage or extend this existing integration rather than building a parallel one.

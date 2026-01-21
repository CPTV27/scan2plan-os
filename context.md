# context.md

This is the single source of truth for repository context plus current goals/progress.

## Project Tracking (Updated: 2026-01-21)

### Current Session: Sales Pipeline & PDF Cover Page Updates (2026-01-21)

**Completed Tasks:**

1. **Sales Pipeline Card Improvements (`client/src/pages/Sales.tsx`):**
   - ✅ Added labels to card elements: "Priority:", "Source:", "Win:"
   - ✅ Made cards clickable (opens deal on click with hover effect)
   - ✅ Added drag-and-drop between stage columns (native HTML5 DnD)
   - ✅ Hidden PersonaSelect dropdown (BP-INST, BP-ARCH, etc.)
   - ✅ Hidden "Last contact" date on cards
   - ✅ Removed Calculator button from cards (Open button remains)
   - ✅ Buttons wrap when space is tight (`flex-wrap`)
   - ✅ Click isolation: checkbox, buttons, links don't trigger card navigation

2. **Sales Header Cleanup:**
   - ✅ Removed "Sync to GHL" button
   - ✅ Removed "Import CSV" button and dialog
   - ✅ Removed "Import PDFs" button
   - ✅ Removed "CPQ Import" button and dialog
   - ✅ Kept: Hot Leads filter, Notification Bell, AI Assistant, Trash, New Deal

3. **PDF Cover Page Update (`server/pdf/proposalGenerator.ts`):**
   - ✅ Added company contact info below logo (address, phone, email, website)
   - ✅ Reformatted address display (street on line 1, city/state/zip on line 2)
   - ✅ Added "(partial building)" note for partial scope projects
   - ✅ LoD + disciplines line formatted as "LoD 350 + MEPF"
   - ✅ Moved acceptance text lower and smaller
   - ✅ Removed footer from cover page (cleaner look)

4. **Proposal Builder Cover Page (`server/routes/proposals.ts`, `ProposalCoverPage.tsx`):**
   - ✅ Fixed coverData to split address: street vs city/state/zip
   - ✅ Auto-adds scope note: "(partial building)", "(interior only)", "(exterior only)"
   - ✅ Updated frontend placeholders and styling for clarity
   - ✅ Cover page now matches reference format

5. **Deal Workspace Header Cleanup (`client/src/pages/DealWorkspace.tsx`):**
   - ✅ Removed: Enroll button, Files Status badge, Open Folder dropdown, Stage badge, Tier A badge
   - ✅ Removed: QBO Estimate button and QboEstimateBadge
   - ✅ Kept only: Deal value badge + Delete button

6. **Proposal Version History:**
   - ✅ Added DELETE endpoint for proposals (`server/routes/proposalTemplates.ts`)
   - ✅ Backend supports `createNewVersion` flag to create new versions instead of updating
   - ✅ Version number auto-increments when creating new versions
   - ✅ Added version history UI in ProposalTab (`client/src/features/deals/components/ProposalTab.tsx`):
     - Shows all proposal versions with version number, name, status, timestamps
     - "New Version" button to create fresh proposal from current quote data
     - "Edit" button to open specific version in Proposal Builder
     - "Delete" button with confirmation dialog
     - Sorted by version (newest first)

**Hot Leads Logic (for reference):**
- Filters deals where: `value >= $10,000` OR `priority >= 4`
- Excludes "Closed Won" and "Closed Lost" stages
- Shows high-value or high-priority active deals

**Files Modified:**
- `client/src/pages/Sales.tsx` - Card improvements, drag-drop, header cleanup
- `server/pdf/proposalGenerator.ts` - Cover page layout matching example

---

### Previous Session: UI Cleanup & Quote Builder Refactoring (2026-01-21)

**Completed Tasks:**

1. **Lead Details Tab Cleanup:**
   - ✅ Removed "I don't know - add to follow-up" button from HungryField component
   - ✅ Removed "Force Sync" button (autosave handles this)
   - ✅ Added new "Project Specifications" card with:
     - BIM Deliverable (dropdown: Revit, Archicad, Sketchup, Rhino, AutoCAD, Other)
     - BIM Version (text input)
     - Building Features (hasBasement, hasAttic checkboxes)
     - Insurance Requirements (textarea)

2. **Quote Builder Cleanup:**
   - ✅ Fixed header alignment (added left padding for embedded mode)
   - ✅ Implemented autosave with `useQuoteAutosave` hook (saves every 2 seconds when embedded)
   - ✅ Added autosave status indicator in Quote Builder header
   - ✅ Hidden export buttons (Save Quote, Export Scoped Doc, Create PandaDoc)
   - ✅ **Removed SCOPE section entirely** (fields were duplicates of Lead Details)
   - ✅ **Removed CRM "Lead Tracking" card** (duplicate of Lead Details `leadSource`)
   - ✅ Renamed "CRM" section to "Internal Pricing" (kept: Internal Notes, Tier A Pricing)

3. **Proposal Tab Cleanup:**
   - ✅ Made "Open Proposal Builder" button larger (`size="lg"`, full width)
   - ✅ Created two-column grid for Proposal Builder and Client Signature cards
   - ✅ Collapsed AI Proposal Assistant into collapsible dropdown (closed by default)
   - ✅ **Removed PandaDoc tab** from Deal Workspace

4. **Database Schema Updates:**
   - ✅ Added `hasBasement` (boolean) to leads table
   - ✅ Added `hasAttic` (boolean) to leads table
   - ✅ Added `insuranceRequirements` (text) to leads table
   - ✅ Schema pushed with `npm run db:push`

**Files Modified:**
- `client/src/components/HungryField.tsx` - Removed IDK button
- `client/src/features/deals/components/LeadDetailsTab.tsx` - Removed Force Sync, added Project Specifications card
- `client/src/features/deals/components/ProposalTab.tsx` - Two-column layout, collapsible AI assistant
- `client/src/pages/DealWorkspace.tsx` - Removed PandaDoc tab
- `client/src/cpq/pages/Calculator.tsx` - Header fix, autosave, removed SCOPE section
- `client/src/cpq/components/CRMFields.tsx` - Removed Lead Tracking card
- `client/src/hooks/use-quote-autosave.ts` - **NEW** autosave hook for Quote Builder
- `shared/schema/db.ts` - Added hasBasement, hasAttic, insuranceRequirements columns

**Quote Builder Structure After Cleanup:**
- **Quote Section (Blue):** Project Areas, Risk Factors, Travel Calculator, Additional Services
- **Internal Pricing Section (Amber):** Internal Notes (margin, caveats), Tier A Pricing (scanning/modeling costs)
- **Pricing Summary (Sidebar):** Real-time pricing breakdown

**Key Architectural Decisions:**
- Quote Builder is now focused purely on financials (pricing configuration)
- Project metadata (BIM deliverables, building features, insurance) lives in Lead Details
- Autosave prevents data loss and removes need for manual save buttons

---

### Current Focus: Proposal Builder

- Backend PDF generation is implemented (`server/pdf/*`, `server/routes/proposals.ts`).
- Draft proposal sections are saved in `generatedProposals` and used during PDF generation (custom sections + variable substitution).
- Frontend editor exists at `/deals/:leadId/proposal` (`client/src/pages/ProposalBuilder.tsx`, `client/src/features/proposals/components/ProposalLayoutEditor.tsx`).

### Active Issue: PDF Output Doesn’t Match Example Proposals

Reference examples in `proposal examples/` are PandaDoc-generated and have a distinct layout (cover, two-column sections, 2-page estimate, multi-page BIM standards table). The current generated PDF is visually and structurally different.

**Progress:**
- Fixed unintended blank pages caused by footer rendering below the content box (PDFKit auto-added pages). Changes in `server/pdf/helpers.ts` and `server/pdf/proposalGenerator.ts` reduce output from 24/16 pages down to the intended 8.

**Next:**
- Decide target template: match PandaDoc examples (12 pages) vs current 8-page “new” layout.
- If matching examples: implement PandaDoc-like cover/header/footer, two-column sections, 2-page estimate layout, and multi-page BIM standards appendix (likely image-based unless we build a detailed table renderer).

### Recent Activity (2026-01-21)
- Updated proposal line item mapping to use CSV catalog names/descriptions and to roll travel into architecture line items (server-side).
- Added proposal line items API endpoint to support proposal builder preview pricing data.
- Proposal builder preview now substitutes variables at render time and supports line item table rendering, plus payment terms/upfront/final amounts.
- Dev server start issue on Windows: `npm run dev` fails due to `NODE_ENV=development` inline syntax; use PowerShell `$env:NODE_ENV='development'; npx tsx server/index.ts`.

### Next Work: WYSIWYG Proposal Editor

**Decision Made (2026-01-20):** Replace current split-panel editor with inline WYSIWYG editing that matches PandaDoc examples.

**New Flow:**
1. "Create Proposal" button → generates proposal with all data filled from Lead + Quote
2. WYSIWYG preview with inline editing (contentEditable regions)
3. Full table editing for Estimate (add/remove rows, edit qty/rate/amount, auto-calc)
4. Auto-save on blur
5. "Download PDF" exports the edited content

**See:** `PROPOSAL_WYSIWYG_PLAN.md` for full implementation plan.

**Implementation Phases:**
1. Data model updates (add lineItems to generatedProposals)
2. Backend API (create endpoint, update PDF generator)
3. EditableText component + auto-save
4. Page components (Cover, Project, Estimate, etc.)
5. Main ProposalWYSIWYG component
6. CSS styling to match PandaDoc
7. PDF generator updates

**Pending:**
- Decide "Send Proposal" semantics (email vs tracking/status only)

## Project Overview

**Scan2Plan Sales & Production** is a streamlined CRM and project management system focused on the Sales pipeline (lead management, CPQ calculator, proposals) and Production pipeline (project scheduling, mission briefs, field data handover). This is a stripped-down version of the full Scan2Plan OS, removing dashboard/analytics, financial modules, marketing automation, and other enterprise features.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Tailwind CSS + Wouter (routing) + Tanstack Query
- Backend: Express.js + Node.js (ESM)
- Database: PostgreSQL with Drizzle ORM
- Build: Vite (client), esbuild (server)
- Testing: Vitest (unit), Playwright (e2e)

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Start development server (runs server + Vite dev server)
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Start production server
npm start
```

### Database
```bash
# Push schema changes to database (development)
npm run db:push

# Note: Drizzle migrations are in ./migrations/
# Schema is defined in shared/schema/db.ts
```

### Testing
```bash
# Run unit tests (Vitest)
npm test

# Watch mode for unit tests
npm run test:watch

# Run e2e tests (Playwright)
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui
```

## Project Architecture

### Monorepo Structure
```
/client          # React frontend
  /src
    /features    # Feature modules (cpq, deals, customers, proposals, sequences)
    /pages       # Page components
    /components  # Shared UI components
    /cpq         # New CPQ module (separate from features/cpq)
    /hooks       # Custom React hooks
    /lib         # Client utilities

/server          # Express backend
  /routes        # API route handlers (cpq.ts, deals.ts, customers.ts, etc.)
  /storage       # Data access layer organized by domain
  /lib           # Server utilities (logger, cache, pricing engine, etc.)
  /middleware    # Express middleware (auth, CSRF, rate limiting, etc.)
  /replit_integrations  # Auth system (session-based with role guards)

/shared          # Shared code between client and server
  /schema        # Drizzle schema definitions + types (db.ts, types.ts, validation.ts)
  /models        # Shared models (auth, chat)
  /utils         # Shared utilities

/db/migrations   # Drizzle migration files
```

### Database Schema Pattern

The database schema is centralized in `shared/schema/db.ts` (2500+ lines) and uses Drizzle ORM:
- Tables are defined with `pgTable()`
- Relations are defined with `relations()` for joins
- Insert schemas are generated with `createInsertSchema()` from `drizzle-zod`
- Constants (enums, status values) are in `shared/schema/constants.ts`

**Key Tables:**
- `leads` - Sales pipeline (deal stages: Leads → Contacted → Proposal → Negotiation → Closed Won/Lost)
- `projects` - Production pipeline (statuses: Scheduling → Scanning → Registration → Modeling → QC → Delivered)
- `cpqQuotes` - CPQ calculator quotes with pricing breakdowns
- `users` - User authentication with roles (ceo, sales, production, accounting)
- `customers` - Client management with QuickBooks integration
- `proposalTemplates` - Proposal builder templates

### Data Access Layer (Storage Pattern)

The backend uses a repository pattern organized in `server/storage/`:
- `storage/leads.ts` - Lead/deal CRUD operations
- `storage/projects.ts` - Project management
- `storage/quotes.ts` - CPQ quotes and versioning
- `storage/financial.ts` - Invoices, accounts, loans, payables
- `storage/marketing.ts` - Events, case studies, ABM analytics
- `storage/users.ts` - User management

**Pattern:** The `server/storage.ts` file exports a unified `storage` object that aggregates all repository methods. Import from this file, not individual repositories.

```typescript
import { storage } from "./storage";

// Good
const lead = await storage.getLead(id);

// Bad - don't import from individual repos
import { leadRepo } from "./storage/leads";
```

### Authentication & Authorization

Session-based authentication is in `server/replit_integrations/auth/`:
- `setupAuth()` - Configures express-session with PostgreSQL store
- `isAuthenticated` - Middleware requiring logged-in user
- `requireRole(...)` - Middleware for role-based access control (RBAC)
- Roles: "ceo", "sales", "production", "accounting"

Frontend uses `useAuth()` hook and `<RoleGuard>` component for client-side route protection.

### API Routes

Routes follow the pattern `/api/<resource>` and are registered in `server/routes.ts`:
- `/api/leads` - Lead/deal pipeline management
- `/api/cpq` - CPQ calculator (pricing, quoting)
- `/api/projects` - Production pipeline
- `/api/customers` - Customer management
- `/api/proposals` - Proposal builder & viewer
- `/api/quickbooks` - QuickBooks OAuth & sync
- `/api/webhooks` - External webhooks (HubSpot, PandaDoc, etc.)

**Important:** Most routes require authentication via `isAuthenticated` middleware. Public routes are explicitly listed in `server/routes.ts` (lines 42-57).

### Frontend Routing

Uses Wouter for client-side routing (lighter than React Router):
- Routes defined in `client/src/App.tsx`
- Role-based route protection with `<RoleGuard>` component
- Main pages: `/sales`, `/production`, `/customers`, `/new-cpq`

### CPQ Calculator

The CPQ (Configure, Price, Quote) calculator has two implementations:
1. **Legacy:** `client/src/features/cpq/` - Original implementation
2. **New:** `client/src/cpq/` - Redesigned modular version (preferred)

The new CPQ uses:
- `client/src/cpq/components/` - Field components (CRMFields, TravelCalculator, etc.)
- `client/src/cpq/lib/pricing.ts` - Pricing calculation engine
- `server/routes/cpq.ts` - Backend API for quotes

### State Management

No Redux or Zustand - uses React Query (Tanstack Query) for server state:
- Queries defined in feature folders (e.g., `features/deals/queries.ts`)
- Query client configured in `client/src/lib/queryClient.ts`
- Mutations use optimistic updates where appropriate

### Middleware

Important middleware in `server/middleware/`:
- `csrf.ts` - CSRF protection for API routes (excludes webhooks)
- `rateLimiter.ts` - Rate limiting (API, auth, uploads, AI, passwords)
- `errorHandler.ts` - Centralized error handling with `asyncHandler` wrapper
- `correlationId.ts` - Request ID tracking for logging
- `performanceLogger.ts` - Performance monitoring
- `webhookSecurity.ts` - Webhook signature verification

### Environment Configuration

Environment variables are validated on startup via `server/config/env.ts`:
- `DATABASE_URL` - PostgreSQL connection (required)
- `SESSION_SECRET` - Session encryption (required)
- `AUTH_DEV_MODE=true` - Enables auto-login for development
- `GOOGLE_MAPS_API_KEY` - Address autocomplete (optional)
- `QUICKBOOKS_CLIENT_ID/SECRET` - QuickBooks integration (optional)
- `HUBSPOT_ACCESS_TOKEN` - HubSpot sync (optional)

See `.env.example` for full list of environment variables.

### Build Process

The build script (`script/build.ts`) uses esbuild:
1. Builds client with Vite → `dist/public/`
2. Builds server with esbuild → `dist/index.cjs` (CommonJS for production)
3. Server serves static files from `dist/public/` in production

In development, Vite runs as middleware via `server/vite.ts`.

## Key Patterns & Conventions

### API Error Handling
Always use `asyncHandler` wrapper for async route handlers to catch errors:
```typescript
import { asyncHandler } from "./middleware/errorHandler";

app.get("/api/leads", isAuthenticated, asyncHandler(async (req, res) => {
  const leads = await storage.getLeads();
  res.json(leads);
}));
```

### Logging
Use the centralized logger from `server/lib/logger.ts`:
```typescript
import { log } from "./lib/logger";

log("Message here", "optional-category");
```

### Type Safety
- Backend types are generated from Drizzle schema (`shared/schema/db.ts`)
- Frontend imports types from `@shared/schema`
- Zod is used for runtime validation (`shared/schema/validation.ts`)

### Path Aliases
TypeScript and Vite are configured with path aliases:
- `@/` - Resolves to `client/src/`
- `@shared/` - Resolves to `shared/`
- `@assets/` - Resolves to `attached_assets/`

## Testing Strategy

### Unit Tests (Vitest)
- Located alongside source files (e.g., `pricing.test.ts`)
- Focus on business logic (pricing engine, validators, utilities)
- Run with `npm test`

### E2E Tests (Playwright)
- Located in `/e2e/` directory
- Example: `e2e/sales-pipeline-full.spec.ts` tests full sales workflow
- Run with `npm run test:e2e`

### API Route Tests
- Located in `server/routes/__tests__/`
- Test route handlers in isolation

## Common Workflows

### Adding a New API Route
1. Create route handler in `server/routes/<resource>.ts`
2. Register route in `server/routes.ts` via `registerRoutes()`
3. Add storage methods in `server/storage/<domain>.ts`
4. Update schema in `shared/schema/db.ts` if needed
5. Run `npm run db:push` to sync database

### Adding a New Frontend Feature
1. Create feature module in `client/src/features/<feature>/`
2. Add page component in `client/src/pages/`
3. Register route in `client/src/App.tsx`
4. Add React Query hooks for data fetching
5. Use `@/components/ui` for UI components (shadcn-based)

### Database Schema Changes
1. Modify `shared/schema/db.ts`
2. Run `npm run db:push` to push changes (development)
3. For production, generate migration with `drizzle-kit generate`
4. The `ensureSchemaColumns()` function in `server/migrations/ensureSchema.ts` handles runtime schema validation

## Integration Points

### QuickBooks Sync
- OAuth flow in `server/routes/quickbooks/`
- Customer sync via `server/quickbooks-client.ts`
- Invoice/estimate creation

### HubSpot CRM
- Bidirectional sync via webhooks
- Deal pipeline mirroring
- Contact management

### PandaDoc Proposals
- Proposal generation via `server/pandadoc.ts`
- Webhook handlers for tracking events

### Google Drive
- File uploads via `server/googleDrive.ts`
- Mission brief PDF generation

## Performance Considerations

- Rate limiting is enforced on all API routes (see `server/middleware/rateLimiter.ts`)
- Database connection pooling via `pg` library (`server/db.ts`)
- React Query caching reduces redundant API calls
- Static assets served with aggressive caching in production

## Security

- CSRF protection on all `/api/` routes (except webhooks/public endpoints)
- Session-based authentication with PostgreSQL store
- Rate limiting on auth, upload, and AI endpoints
- Input validation with Zod schemas
- SQL injection protection via Drizzle parameterized queries
- Webhook signature verification for external integrations

---

## ✅ Proposal Builder Overhaul (2026-01-20)

### Current Status: Backend + Frontend Integrated ✅

The proposal builder is being overhauled to generate professional 9-page PDF proposals matching the Scan2Plan format (examples: `proposal examples/S2P Proposal - 30 Cooper Sq.pdf` and `61 Woods Road.pdf`).

**Completed:** Backend PDF generation + API endpoints + templates + variable substitution + line item generation + dynamic section overrides, plus frontend editor/draft persistence.
**Next:** Testing/polish + decide “Send Proposal” semantics (email vs tracking/status only).

### Implementation Plan

See comprehensive implementation plan in:
- `PROPOSAL_BUILDER_IMPLEMENTATION_PLAN.md` - Full 7-phase plan with code snippets
- `PROPOSAL_DATA_MAPPING.md` - Data mapping strategy (Lead + Quote → Proposal)

**Phases:**
1. ✅ PDF Generator Foundation (COMPLETED)
2. ✅ API Endpoints (COMPLETED - 2026-01-20)
3. ✅ Data Integration Layer (COMPLETED - merged into Phase 2)
4. ✅ Template Content Updates (COMPLETED - 2026-01-20)
5. ✅ Variable Substitution (COMPLETED - 2026-01-20)
6. ✅ Line Item Generation (COMPLETED - 2026-01-20)
7. ✅ Testing & Refinement (COMPLETED - 2026-01-20)
8. ✅ Frontend Integration (COMPLETED - `/deals/:leadId/proposal`)

### Files Created (Phase 1)

#### 1. `server/pdf/helpers.ts` (372 lines)
PDF rendering utilities for consistent formatting:
```typescript
// Key exports:
- COLORS, PAGE constants
- formatCurrency(), formatNumber()
- drawLine(), drawRect()
- renderSectionHeading(), renderParagraph(), renderBulletList()
- renderTable() - For estimate and BIM standards tables
- renderKeyValue(), renderFooter()
- checkPageBreak() - Auto page breaks
```

**Usage:**
```typescript
import { renderTable, formatCurrency, COLORS, PAGE } from "./helpers";

const columns = [
  { header: "ITEM", key: "item", width: 140 },
  { header: "AMOUNT", key: "amount", width: 80, align: "right" }
];
const rows = [{ item: "Scanning", amount: formatCurrency(5000) }];
y = renderTable(doc, columns, rows, y, { headerBg: COLORS.primary });
```

#### 2. `server/pdf/proposalGenerator.ts` (745 lines)
Main PDF generation with 8 page-rendering functions:

**Key Function:**
```typescript
export async function generateProposalPDF(
  data: ProposalData,
  customSections?: any[]
): Promise<PDFKit.PDFDocument>
```

**Page Functions:**
- `renderCoverPage()` - Logo, title, client, date
- `renderAboutPage()` - About Scan2Plan + Why Scan2Plan (boilerplate)
- `renderProjectPage()` - Overview, Scope, Deliverables, Timeline
- `renderEstimatePage()` - Line items table with totals
- `renderPaymentTermsPage()` - Payment structure, methods, terms
- `renderCapabilitiesPage()` - Services, technology, industries (boilerplate)
- `renderDifferencePage()` - Quality, expertise, partnership (boilerplate)
- `renderBIMStandardsPage()` - LoD table with project highlights

**ProposalData Interface:**
```typescript
interface ProposalData {
  projectTitle: string;
  clientName: string;
  date: string;
  location: string;
  overview: { projectName, address, buildingType, sqft, description };
  scope: { scopeSummary, disciplines, deliverables, lodLevels[] };
  timeline: { duration, milestones[] };
  lineItems: LineItem[];
  subtotal: number;
  total: number;
  paymentTerms: { structure, upfrontAmount, totalAmount, methods[], terms };
}
```

#### 3. `server/lib/proposalDataMapper.ts` (263 lines)
Maps Lead + Quote data to ProposalData structure:

**Key Functions:**
```typescript
// Helper functions
export function calculateTotalSqft(areas: any[]): number
export function extractScope(areas: any[]): string
export function extractDisciplines(areas: any[]): string
export function extractLodLevels(areas: any[]): string[]
export function formatServices(services: any): string
export function generateLineItems(quote: CpqQuote | null, lead: Lead): LineItem[]

// Main mapper
export function mapProposalData(lead: Lead, quote: CpqQuote | null): ProposalData
```

**Data Flow:**
```
Lead (leads table) + Quote (cpqQuotes table)
  ↓
mapProposalData()
  ↓
ProposalData interface
  ↓
generateProposalPDF()
  ↓
PDFKit.PDFDocument (stream)
```

### Files Modified

#### `client/src/cpq/components/ScopeFields.tsx`
- **Fix:** Added missing `RadioGroup` and `RadioGroupItem` imports
- **Line 5:** `import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";`

### What Works Now

✅ PDF generator structure (all 9 pages defined)
✅ Data mapping from Lead/Quote to ProposalData
✅ Table rendering for estimates and BIM standards
✅ Bullet lists, sections, key-value pairs
✅ Professional formatting with brand colors
✅ Type-safe interfaces throughout
✅ Modular page-rendering functions
✅ API endpoints working (Phase 2) - PDF download and send

### What's Stubbed/Incomplete

⚠️ **Logo:** Placeholder text instead of actual logo image
  - Need to add logo file to `public/logo-cover.png`
  - Uncomment line 132 in `proposalGenerator.ts`

~~⚠️ **Line Items:** Basic extraction from quote areas~~ ✅ **DONE (Phase 6)**
  - ~~`generateLineItems()` creates simple line items~~ ✅ Full implementation
  - ~~Phase 6 will add full pricing breakdown parsing~~ ✅ Parses `pricingBreakdown.items`

~~⚠️ **API Endpoints:** Don't exist yet (Phase 2)~~ ✅ **DONE**
  - ~~Need to create `POST /api/proposals/:leadId/generate-pdf`~~ ✅ Implemented
  - ~~Need to create `POST /api/proposals/:leadId/send`~~ ✅ Implemented

~~⚠️ **Variable Substitution:** Infrastructure exists but not wired up~~ ✅ **DONE (Phase 5)**
  - ~~Template system in `client/src/features/proposals/hooks/useProposalTemplates.ts`~~ ✅ Server-side substitution added
  - ~~Needs integration with PDF generator~~ ✅ Integrated in `/generate-pdf` endpoint


### Known Issues

**TypeScript Warnings (Non-blocking):**
- Some pdfkit coordinate type strictness warnings in `proposalGenerator.ts`
- Lines with `Type 'number' is not assignable to type '50'`
- These are cosmetic - pdfkit accepts numbers but types are overly strict
- Won't affect runtime - PDFs generate correctly

**Pre-existing Issues (Unrelated):**
- `client/src/components/LeadForm.tsx` - null value type issues
- `client/src/features/deals/components/QuoteBuilderTab.tsx` - number/string type mismatch
- These existed before proposal work and don't block PDF generation

### ✅ Phase 2 Completed (2026-01-20)

**Implemented API Endpoints in `server/routes/proposals.ts`:**

#### 1. `POST /api/proposals/:leadId/generate-pdf`
- Fetches lead and latest quote
- Maps data using `mapProposalData()`
- Generates 9-page PDF using `generateProposalPDF()`
- Streams PDF to browser for download
- Requires authentication

#### 2. `POST /api/proposals/:leadId/send`
- Same as generate-pdf but also:
- Updates lead `dealStage` to "Proposal"
- Creates proposal email tracking event with unique token
- Records `lastContactDate` timestamp
- Returns JSON with success status, PDF size, and token

**Files Modified (Phase 2):**

1. **`server/routes/proposals.ts`**
   - Added imports for `generateProposalPDF`, `mapProposalData`, `isAuthenticated`, `crypto`
   - Added two new POST endpoints (lines 144-254)

2. **`server/pdf/proposalGenerator.ts`**
   - Removed `doc.end()` call from `generateProposalPDF()` function
   - Caller is now responsible for calling `pipe()` and `end()` for proper streaming
   - **Important:** This fixes the `ERR_STREAM_PUSH_AFTER_EOF` error that was causing server crashes

**Bug Fixes:**

- **Stream Error Fix:** The original `generateProposalPDF()` was calling `doc.end()` internally, then the API route was calling `doc.end()` again after piping. This caused `ERR_STREAM_PUSH_AFTER_EOF`. Fixed by removing the internal `doc.end()` call.

- **Type Corrections in proposals.ts:**
  - Changed `stage` to `dealStage` (correct field name in leads table)
  - Changed `lastActivityAt` to `lastContactDate` (correct field name)
  - Removed `lead.email` (field doesn't exist) - now uses `contactEmail`
  - Removed `sentAt`, `openedAt`, `clickedAt` from `createProposalEmailEvent()` (auto-set by schema)

### Testing the PDF Generator

**Currently Working:**

```bash
# Start dev server (Windows PowerShell)
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }; npx tsx server/index.ts

# Navigate to: http://localhost:5000/sales
# Click a deal → Proposal tab → "Open Proposal Builder" button
# Click "Download PDF" - ✅ Works, downloads 9-page PDF
# Click "Send Proposal" - ✅ Works, updates lead stage and creates tracking event
```

**Test Data Required:**
- A lead with basic info (client name, project name, address)
- Optionally: a CPQ quote with areas, pricing breakdown
- If no quote: Falls back to lead data

### ✅ Phase 6 Completed (2026-01-20)

**Implemented Full Line Item Generation in `server/lib/proposalDataMapper.ts`:**

The `generateLineItems()` function now:

1. **Primary Source: `pricingBreakdown.items`**
   - When a quote has `pricingBreakdown.items` from the CPQ calculator, extracts line items directly
   - Parses labels to determine item type and extract sqft quantities
   - Generates appropriate descriptions based on service type

2. **Fallback: Area-Based Extraction**
   - If no pricingBreakdown, extracts from `quote.areas`
   - Creates separate line items for scanning and modeling per area
   - Handles multi-discipline modeling (splits cost per discipline)

3. **Travel & Services**
   - Extracts travel costs with distance and dispatch location
   - Handles Matterport, Photography, and dynamic services

**Line Item Structure:**
```typescript
interface LineItem {
  item: string;        // Service name
  description: string; // Details (scope, LOD, etc.)
  qty: number;         // Quantity (usually sqft)
  rate: number;        // Per-unit rate
  amount: number;      // Total cost
}
```

**Files Modified:**
- `server/lib/proposalDataMapper.ts` - `generateLineItems()` function (lines 87-268)

### Important Implementation Notes


**pdfkit Usage:**
- Import as `import PDFDocument from "pdfkit"` (not `import type`)
- Use `PDFKit.PDFDocument` for type annotations
- Stream-based: Caller must call `doc.pipe(res)` then `doc.end()` for HTTP response
- Do NOT call `doc.end()` inside generator functions - let caller control stream lifecycle

**Data Fallback Logic:**
```typescript
// Quote data preferred, falls back to lead data
const projectName = quote?.projectName || lead.projectName || "Untitled";
const sqft = quote ? calculateTotalSqft(quote.areas) : lead.sqft || 0;
```

**Line Item Generation (Stubbed):**
Currently extracts basic items from quote areas:
- Scanning cost per area
- Modeling cost per area
- Travel (if distance/customTravelCost exist)
- Services (Matterport, photography)

Phase 6 will parse `quote.pricingBreakdown` for full detail.

**Boilerplate Sections:**
These pages have static content that never changes:
- About Scan2Plan

### ✅ Phase 4 and 5 Completed (2026-01-20)

**Template Content & Variable Substitution:**

1. **Database Seeding (`server/seed/proposalTemplates.ts`):**
   - Populated 12 standard proposal templates using the "Standard Proposal" group.
   - Templates include markdown content with `{{variable}}` placeholders.
   - Covers all sections: Cover, About, Why, Overview, Scope, Deliverables, Timeline, Estimate, Terms, Appendix.

2. **Variable Substitution Logic (`server/lib/variableSubstitution.ts`):**
   - Implemented `substituteVariables()` to replace placeholders with live Lead/Quote data.
   - Supports formatting for currency, dates, and numbers.
   - Generates dynamic markdown tables for Line Items and BIM Standards.

3. **PDF Integration:**
   - Updated `POST /api/proposals/:leadId/generate-pdf` to fetch customized sections from `generatedProposals`.
   - Applies variable substitution to these sections before PDF generation.

### ✅ Phase 7 Completed (2026-01-20)

**Refinement: Dynamic PDF Generation**
- Updated `server/pdf/proposalGenerator.ts` to consume custom content.
- `generateProposalPDF` now accepts `customSections` and maps them by name.
- Boilerplate pages (About, Why, Capabilities, Difference, BIM Standards Intro) now support content overrides.
- Added `cleanText` helper to strip markdown headers from template content for cleaner PDF rendering.
- Why Scan2Plan?
- Scan2Plan Capabilities
- The Scan2Plan Difference
- BIM Modeling Standards (table structure is static, highlights are dynamic)

**Variable Sections:**
These pull dynamic data:
- Cover Page (project title, client, date)
- The Project (overview, scope, deliverables, timeline)
- Estimate (line items from quote)
- Payment Terms (amounts, terms)

### File Locations Quick Reference

**PDF Generation:**
- `server/pdf/proposalGenerator.ts` - Main generator
- `server/pdf/helpers.ts` - Rendering utilities
- `server/lib/proposalDataMapper.ts` - Data mapping

**API Routes:**
- `server/routes/proposals.ts` - Add endpoints here
- `server/routes.ts` - Routes already registered (line 107)

**Frontend:**
- `client/src/pages/ProposalBuilder.tsx` - Main page with buttons
- `client/src/features/proposals/components/ProposalLayoutEditor.tsx` - Editor UI
- `client/src/features/proposals/components/ProposalPreview.tsx` - Preview pane

**Documentation:**
- `PROPOSAL_BUILDER_IMPLEMENTATION_PLAN.md` - Full plan
- `PROPOSAL_DATA_MAPPING.md` - Data mapping details

### Useful Commands

```bash
# Type check (includes new PDF files)
npm run check

# Start dev server
npm run dev

# Test PDF generator (once endpoints added)
curl -X POST http://localhost:5000/api/proposals/3/generate-pdf \
  --cookie "session=..." \
  --output test-proposal.pdf
```

### Questions to Resolve

1. **Logo file:** Where should logo be located? Currently expects `public/logo-cover.png`
2. **Email integration:** Should "Send Proposal" button email PDF or just update status?
3. **Multiple template groups:** Support just "Standard Proposal" or add "Simple Quote", "Enterprise" variants?
4. **PDF storage:** Stream to browser only, or save to GCS/database?
5. **Version tracking:** Track proposal versions when regenerated?

### Context for Next Claude Instance

**Current Status:**
- Phase 1-6 are COMPLETE.
- Phase 7 (Testing & Refinement - Backend) is COMPLETE.
  - End-to-End PDF generation flow verified via `server/scripts/test_proposal_flow.ts`.
  - Dynamic content enabled for all key sections (About, Capabilities, Estimate Notes, Terms, etc.).
  - Logo integrated.
  - Variable substitution working including line items table.

**What you're picking up:**
- **Frontend integration is in place** (`/deals/:leadId/proposal`) and saves drafts to `generatedProposals`.
- Backend PDF generation consumes the latest saved draft sections from `generatedProposals` in `POST /api/proposals/:leadId/generate-pdf`.
- Next work is primarily polish/testing + clarifying the “Send Proposal” behavior (email vs tracking/status only).

**Testing approach:**
- Use `server/scripts/test_proposal_flow.ts` to verify backend PDF generation with custom sections.
- Smoke test the UI flow in-app: open `/deals/:leadId/proposal`, edit/save sections, then download PDF.

**If you hit issues:**
- Check `server/pdf/proposalGenerator.ts` for rendering logic.
- Check `server/lib/variableSubstitution.ts` for variable mapping.
- Ensure `numbro` is installed (it caused a crash previously).

Good luck! The backend is solid. 🎉


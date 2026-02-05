# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scan2Plan Sales & Production is a streamlined CRM and project management system for a 3D scanning/BIM services company. It manages the full lifecycle from lead capture through project delivery.

## Commands

```bash
# Development
npm run dev              # Start dev server (Vite + Express on port 5000)
npm run check            # TypeScript type checking

# Database
npm run db:push          # Push Drizzle schema changes to PostgreSQL

# Testing
npm run test             # Run Vitest unit tests
npm run test:watch       # Run tests in watch mode
npm run test -- server/routes/__tests__/leads.test.ts  # Run single test file
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with Playwright UI

# Production
npm run build            # Build for production
npm start                # Start production server
```

## Architecture

### Monorepo Structure
- **client/**: React SPA with Vite
- **server/**: Express.js API server
- **shared/**: Code shared between client and server (schemas, types, utilities)

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

### Database Layer
- PostgreSQL with Drizzle ORM
- Schema entry point: `shared/schema.ts` → re-exports from `shared/schema/index.ts`
- Schema organization in `shared/schema/`:
  - `db.ts` - All Drizzle table definitions
  - `types.ts` - TypeScript types derived from tables
  - `validation.ts` - Zod validation schemas
  - `constants.ts` - Enums and constants
  - `cpq.ts` - CPQ-specific schemas
- Database client: `server/db.ts` (exports `db` and `pool`)
- Drizzle config: `drizzle.config.ts` (migrations output to `./migrations`)

### Storage Pattern
The `server/storage.ts` file exports a unified `storage` object implementing `IStorage` interface. This delegates to domain-specific repositories:
- `server/storage/leads.ts` - Lead, research, and document operations
- `server/storage/quotes.ts` - CPQ quotes, versions, and pricing matrices
- `server/storage/projects.ts` - Production projects and attachments
- `server/storage/users.ts` - User management
- `server/storage/financial.ts` - Invoices, accounts, loans, vendor payables
- `server/storage/marketing.ts` - Case studies, events, notifications, deal attributions
- `server/storage/settings.ts` - Application settings
- `server/storage/scantechs.ts` - Field technicians
- `server/storage/notes.ts` - Field notes

### API Layer
- Routes registered in `server/routes.ts` via `registerRoutes()`
- Domain routes in `server/routes/` (leads, projects, proposals, cpq, etc.)
- Auth middleware: `server/replit_integrations/auth/` (Google OAuth + session-based)
- CSRF protection enabled for all `/api/` routes except webhooks and public endpoints

### Frontend State
- TanStack Query for server state (`client/src/lib/queryClient.ts`)
- Custom hooks in `client/src/hooks/` (use-leads, use-projects, use-auth, etc.)
- Autosave hooks: `use-lead-autosave.ts`, `use-quote-autosave.ts`

### Key Frontend Routes (client/src/App.tsx)
- `/` or `/sales` - Sales pipeline (Kanban board)
- `/deals/:id` - Deal workspace
- `/deals/:leadId/proposal` - Proposal builder
- `/production` - Production pipeline
- `/new-cpq/*` - CPQ calculator module

### Role-Based Access
Roles: `ceo`, `sales`, `production`, `accounting`
- `RoleGuard` component protects routes
- `requireRole()` middleware protects API endpoints

### PDF Generation
- Proposal PDFs: `server/pdf/proposalGenerator.ts`
- WYSIWYG proposals: `server/pdf/wysiwygPdfGenerator.ts` (for cover page editor)
- Mission briefs: `server/missionBriefPdf.ts`
- Data mapping: `server/lib/proposalDataMapper.ts`

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key

Optional:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` - OAuth
- `GOOGLE_MAPS_API_KEY` - Address autocomplete
- `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` - QuickBooks integration
- `OPENAI_API_KEY` - AI features

## Testing

Unit tests use Vitest and are co-located with source files (e.g., `server/routes/__tests__/`).

E2E tests use Playwright and are in the `e2e/` directory. The config enables tracing and video recording by default.

## CPQ / Quote Builder

### Active Quote Builder
The active Quote Builder used in Deal Workspace is:
- **Component**: `client/src/cpq/pages/Calculator.tsx`
- **Wrapper**: `client/src/features/deals/components/QuoteBuilderTab.tsx`

**Note**: `client/src/features/deals/components/SimpleQuoteBuilder.tsx` is **DEPRECATED** - do not use or update.

### Tier A Pricing
Tier A is for large projects (50,000+ sqft) with custom pricing:
- **Toggle location**: Internal Pricing section → "Tier A Pricing (Internal)" card in `CRMFields.tsx`
- **When enabled**: Replaces only Architecture line items with manual pricing (scanning cost + modeling cost × margin)
- **Other disciplines** (MEPF, Structure, Site) remain calculated normally
- **Proposal display**: Labels show as regular "Architecture" (strips "Tier A" prefix via `proposalDataMapper.ts`)

Tier A pricing fields in `scopingData`:
- `tierAScanningCost` - Predefined options ($3,500 to $18,500) or "other"
- `tierAScanningCostOther` - Custom scanning cost
- `tierAModelingCost` - Manual modeling cost entry
- `tierAMargin` - Multiplier (2.352X to 4X)

## Proposals / WYSIWYG Editor

### Styling Constants
PDF and WYSIWYG styles should match. Reference colors from:
- **PDF**: `server/pdf/wysiwygPdfGenerator.ts` - `COLORS` and `TYPOGRAPHY` constants
- **WYSIWYG**: `client/src/features/proposals/styles/proposalStyles.ts`

Key colors (must stay in sync):
- Primary blue: `#123ea8`
- Body text: `#49494b`
- Secondary text: `#434343`
- Muted text: `#616161`
- Borders: `#d1d5db`

### Proposal Components
All in `client/src/features/proposals/components/`:
- `ProposalWYSIWYG.tsx` - Main editor container
- `ProposalCoverPage.tsx` - Cover page
- `ProposalAboutPage.tsx` - About Scan2Plan
- `ProposalProjectPage.tsx` - Project overview, scope, deliverables
- `ProposalEstimateTable.tsx` - Line items table
- `ProposalPaymentPage.tsx` - Payment terms
- `ProposalCapabilitiesPage.tsx` - Capabilities list
- `ProposalDifferencePage.tsx` - Differentiators
- `ProposalBIMStandards.tsx` - BIM standards images

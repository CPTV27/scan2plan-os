# Proposal WYSIWYG Editor - Implementation Plan

## Overview

Replace the current split-panel proposal builder with a WYSIWYG inline-editing experience that matches the PandaDoc proposal examples. Users click "Create Proposal" to generate a filled proposal, edit it inline, and export to PDF.

## Target Layout (Matching PandaDoc Examples)

```
Page 1:  Cover Page (logo, "- PROPOSAL -", address, services, client, date)
Page 2:  About Scan2Plan + Why Scan2Plan (image + two-column bullets)
Page 3:  The Project (Overview, Scope, Deliverables, Timeline)
Page 4:  (spacer for estimate to start on odd page)
Page 5-6: Estimate Table (DESCRIPTION | QTY | RATE | AMOUNT) - EDITABLE
Page 7:  Payment Terms
Page 8:  Capabilities (two-column layout)
Page 9:  The Scan2Plan Difference (two-column layout)
Page 10-12: BIM Modeling Standards Table (static)
```

## Key Features

1. **Inline Editing** - Click any text to edit directly (contentEditable)
2. **Full Table Editing** - Add/remove estimate rows, edit all cells
3. **Auto-Calculate** - Amount = QTY × Rate, auto-sum totals
4. **Auto-Save** - Changes persist on blur/change
5. **PDF Export** - Download matches the edited preview exactly

---

## Phase 1: Data Model Updates

### 1.1 Update `generatedProposals` schema

Add `lineItems` JSON column to store editable estimate data separately from sections.

```typescript
// shared/schema/db.ts - Add to generatedProposals table
lineItems: jsonb("line_items").$type<ProposalLineItem[]>(),
```

### 1.2 ProposalLineItem Interface

```typescript
// shared/schema/types.ts
export interface ProposalLineItem {
  id: string;           // UUID for React keys
  itemName: string;     // "Scan2Plan Commercial - LoD 300"
  description: string;  // Full catalog description
  qty: number;          // Square footage or quantity
  rate: number;         // Per-unit rate
  amount: number;       // Calculated: qty × rate
}
```

---

## Phase 2: Backend API Updates

### 2.1 New Endpoint: Initialize Proposal

`POST /api/proposals/:leadId/create`

- Fetches Lead + Quote data
- Pulls line items from Quote (using catalog descriptions from CSV)
- Creates initial proposal with all variables substituted
- Saves to `generatedProposals` table
- Returns the created proposal with ID

```typescript
// Response
{
  id: number;
  sections: ProposalSection[];
  lineItems: ProposalLineItem[];
  totals: { subtotal: number; total: number };
}
```

### 2.2 Update Endpoint: Save Proposal

`PATCH /api/generated-proposals/:id`

- Already exists, update to handle `lineItems` field
- Recalculate totals on save

### 2.3 Update PDF Generator

`POST /api/proposals/:leadId/generate-pdf`

- Read from `generatedProposals` instead of generating fresh
- Use saved `lineItems` for estimate pages
- Match PandaDoc layout exactly

---

## Phase 3: Frontend - WYSIWYG Preview Component

### 3.1 New Component: `ProposalWYSIWYG.tsx`

Replace `ProposalPreview.tsx` with a new component that:
- Renders all 12 pages matching PandaDoc layout
- Each text region is `contentEditable`
- Auto-saves on blur

```
client/src/features/proposals/components/
├── ProposalWYSIWYG.tsx          # Main WYSIWYG editor
├── ProposalCoverPage.tsx        # Page 1
├── ProposalAboutPage.tsx        # Page 2 (About + Why)
├── ProposalProjectPage.tsx      # Page 3 (Overview, Scope, etc.)
├── ProposalEstimateTable.tsx    # Pages 5-6 (editable table)
├── ProposalPaymentPage.tsx      # Page 7
├── ProposalCapabilitiesPage.tsx # Page 8
├── ProposalDifferencePage.tsx   # Page 9
├── ProposalBIMStandards.tsx     # Pages 10-12 (static image/table)
└── EditableText.tsx             # Reusable contentEditable wrapper
```

### 3.2 EditableText Component

```tsx
interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'li';
  placeholder?: string;
}

function EditableText({ value, onChange, className, as = 'p', placeholder }: EditableTextProps) {
  const Tag = as;
  const ref = useRef<HTMLElement>(null);

  const handleBlur = () => {
    if (ref.current) {
      onChange(ref.current.innerText);
    }
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className={cn("outline-none focus:bg-blue-50/50 rounded px-1 -mx-1", className)}
      data-placeholder={placeholder}
    >
      {value}
    </Tag>
  );
}
```

### 3.3 ProposalEstimateTable Component

Fully editable table with:
- Add/Remove row buttons
- Editable cells for all columns
- Auto-calculate Amount = QTY × Rate
- Auto-sum Total

```tsx
interface EstimateTableProps {
  lineItems: ProposalLineItem[];
  onChange: (items: ProposalLineItem[]) => void;
}

function ProposalEstimateTable({ lineItems, onChange }: EstimateTableProps) {
  const addRow = () => {
    onChange([...lineItems, {
      id: crypto.randomUUID(),
      itemName: '',
      description: '',
      qty: 0,
      rate: 0,
      amount: 0,
    }]);
  };

  const updateRow = (id: string, field: string, value: any) => {
    onChange(lineItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated.amount = updated.qty * updated.rate;
      }
      return updated;
    }));
  };

  const removeRow = (id: string) => {
    onChange(lineItems.filter(item => item.id !== id));
  };

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  // Render table...
}
```

---

## Phase 4: Page Layout Components

### 4.1 Cover Page (Page 1)

```tsx
function ProposalCoverPage({ data, onChange }) {
  return (
    <div className="proposal-page cover-page">
      {/* Logo */}
      <img src="/logo-cover.png" className="w-48 mx-auto" />

      {/* Company Info */}
      <div className="text-center text-sm text-gray-600">
        188 1st St, Troy, NY 12180<br/>
        (518) 362-2403 / admin@scan2plan.io<br/>
        www.scan2plan.io
      </div>

      {/* Proposal Title */}
      <h1 className="text-4xl font-bold text-center">- PROPOSAL -</h1>

      {/* Project Info - Editable */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl">Laser Scanning & Building Documentation</h2>
        <EditableText
          value={data.projectTitle}
          onChange={(v) => onChange('projectTitle', v)}
          as="h2"
          className="text-xl"
        />
        <EditableText
          value={data.servicesLine}
          onChange={(v) => onChange('servicesLine', v)}
          className="text-lg text-gray-600"
        />
      </div>

      {/* Legal Text */}
      <p className="text-sm">
        Scan2Plan, Inc., a Delaware corporation ("S2P") hereby proposes...
        to <EditableText value={data.clientName} onChange={(v) => onChange('clientName', v)} as="span" className="font-bold" />.
        Use of the services... dated <EditableText value={data.date} onChange={(v) => onChange('date', v)} as="span" className="font-bold" />
      </p>

      {/* Footer */}
      <div className="page-footer">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io
      </div>
    </div>
  );
}
```

### 4.2 Project Page (Page 3)

```tsx
function ProposalProjectPage({ data, onChange }) {
  return (
    <div className="proposal-page">
      <h1 className="section-title">The Project</h1>

      <h2 className="subsection-title">Overview</h2>
      <EditableText
        value={data.overview}
        onChange={(v) => onChange('overview', v)}
      />

      <h2 className="subsection-title">Scope of Work</h2>
      <ul className="scope-list">
        {data.scopeItems.map((item, i) => (
          <li key={i}>
            <EditableText
              value={item}
              onChange={(v) => {
                const newItems = [...data.scopeItems];
                newItems[i] = v;
                onChange('scopeItems', newItems);
              }}
              as="span"
            />
          </li>
        ))}
      </ul>

      <h2 className="subsection-title">Deliverables</h2>
      <ul className="deliverables-list">
        {data.deliverables.map((item, i) => (
          <li key={i}>
            <EditableText value={item} onChange={...} as="span" />
          </li>
        ))}
      </ul>

      <h2 className="subsection-title">Timeline</h2>
      <EditableText value={data.timelineIntro} onChange={...} />
      <ul>
        {data.milestones.map((m, i) => (
          <li key={i}>
            <EditableText value={m} onChange={...} as="span" />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Phase 5: Update ProposalBuilder Page

### 5.1 New Flow

```tsx
function ProposalBuilder() {
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Check if proposal exists
  const { data: existingProposal } = useQuery(...);

  // Create proposal mutation
  const createProposal = useMutation({
    mutationFn: () => fetch(`/api/proposals/${leadId}/create`, { method: 'POST' }),
    onSuccess: (data) => setProposal(data),
  });

  // If no proposal exists, show "Create Proposal" button
  if (!existingProposal && !proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2>Ready to create a proposal?</h2>
        <p>Data from Quote Builder will be pre-filled.</p>
        <Button onClick={() => createProposal.mutate()}>
          {isCreating ? <Loader2 /> : null}
          Create Proposal
        </Button>
      </div>
    );
  }

  // Otherwise, show WYSIWYG editor
  return (
    <ProposalWYSIWYG
      proposal={proposal || existingProposal}
      onSave={handleAutoSave}
      onDownload={handleDownloadPDF}
    />
  );
}
```

---

## Phase 6: CSS Styling for Print/PDF

### 6.1 Page Styles

```css
/* Proposal page container */
.proposal-page {
  width: 8.5in;
  min-height: 11in;
  padding: 0.75in 1in;
  background: white;
  position: relative;
  page-break-after: always;
}

/* Cover page specific */
.cover-page {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
}

/* Section titles (blue) */
.section-title {
  color: #4285f4;
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 24px;
}

.subsection-title {
  color: #4285f4;
  font-size: 18px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 12px;
}

/* Page footer */
.page-footer {
  position: absolute;
  bottom: 0.5in;
  left: 1in;
  right: 1in;
  text-align: center;
  font-size: 10px;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 8px;
}

/* Two-column layout for Capabilities/Difference pages */
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

/* Estimate table */
.estimate-table {
  width: 100%;
  border-collapse: collapse;
}

.estimate-table th {
  background: #e8f0fe;
  color: #4285f4;
  text-align: left;
  padding: 12px;
  font-size: 12px;
}

.estimate-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}

.estimate-table .amount {
  text-align: right;
}
```

---

## Phase 7: PDF Generator Updates

### 7.1 Update `server/pdf/proposalGenerator.ts`

- Read sections and lineItems from saved proposal
- Match exact layout of PandaDoc examples
- Use saved/edited content, not regenerated

```typescript
export async function generateProposalPDF(
  proposal: GeneratedProposal,
  lead: Lead,
): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 72 });

  // Page 1: Cover
  renderCoverPage(doc, proposal.coverData);

  // Page 2: About + Why
  doc.addPage();
  renderAboutPage(doc, proposal.sections.find(s => s.name === 'About'));

  // Page 3: The Project
  doc.addPage();
  renderProjectPage(doc, proposal.sections.find(s => s.name === 'Project'));

  // Page 4: Spacer (optional)
  doc.addPage();

  // Pages 5-6: Estimate (from lineItems)
  doc.addPage();
  renderEstimatePages(doc, proposal.lineItems, lead);

  // Page 7: Payment Terms
  doc.addPage();
  renderPaymentTermsPage(doc, proposal.sections.find(s => s.name === 'Payment Terms'));

  // ... etc

  return doc;
}
```

---

## Implementation Order

1. **Phase 1** - Data model updates (schema, types)
2. **Phase 2** - Backend API (create endpoint, update save, update PDF)
3. **Phase 3** - EditableText component + auto-save hook
4. **Phase 4** - Individual page components (start with Cover, Project, Estimate)
5. **Phase 5** - Main ProposalWYSIWYG component + ProposalBuilder updates
6. **Phase 6** - CSS styling for visual match
7. **Phase 7** - PDF generator updates
8. **Testing** - End-to-end flow verification

---

## File Changes Summary

### New Files
- `client/src/features/proposals/components/ProposalWYSIWYG.tsx`
- `client/src/features/proposals/components/ProposalCoverPage.tsx`
- `client/src/features/proposals/components/ProposalAboutPage.tsx`
- `client/src/features/proposals/components/ProposalProjectPage.tsx`
- `client/src/features/proposals/components/ProposalEstimateTable.tsx`
- `client/src/features/proposals/components/ProposalPaymentPage.tsx`
- `client/src/features/proposals/components/ProposalCapabilitiesPage.tsx`
- `client/src/features/proposals/components/ProposalDifferencePage.tsx`
- `client/src/features/proposals/components/ProposalBIMStandards.tsx`
- `client/src/features/proposals/components/EditableText.tsx`
- `client/src/features/proposals/styles/proposal.css`

### Modified Files
- `shared/schema/db.ts` - Add lineItems column
- `server/routes/proposals.ts` - Add create endpoint, update PDF endpoint
- `server/pdf/proposalGenerator.ts` - Read from saved proposal
- `client/src/pages/ProposalBuilder.tsx` - New flow with Create button
- `client/src/features/proposals/components/ProposalLayoutEditor.tsx` - Replace with WYSIWYG

---

## Questions Resolved

| Question | Decision |
|----------|----------|
| Auto-save or manual? | Auto-save on blur |
| Estimate calculations | Auto-calc amount = qty × rate |
| BIM Standards table | Include (static image/embed) |
| Editing style | Inline contentEditable |
| Estimate table | Full editing (add/remove rows, all cells) |

# Scan2Plan Sales & Production

A streamlined version of Scan2Plan OS focused exclusively on **Sales** and **Production** workflows.

## Features

### Sales Tab
- Lead/Deal Pipeline Management (Kanban board)
- CPQ Calculator (Configure, Price, Quote)
- Deal Workspace
- Proposal Builder & Viewer
- Customer Management
- Client Signature Capture
- Site Readiness Forms

### Production Tab
- Project Pipeline (Scheduling → Scanning → Registration → Modeling → QC → Delivered)
- Mission Briefs
- Quoted Scope Details
- Scheduling Panel
- Field Data Handover

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

## Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret

Optional:
- `GOOGLE_MAPS_API_KEY` - For address autocomplete
- `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` - For QuickBooks integration
- `OPENAI_API_KEY` - For AI features

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Tanstack Query
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with role guards

## Removed Features

The following features from the full Scan2Plan OS have been removed in this stripped-down version:
- Dashboard/Analytics
- Financial Module
- Marketing Module  
- Business Intelligence/Regional Intel
- Field Hub (Mobile Tech Interface)
- ScanTech Module
- AI Agent/Brand Engine
- HelpCenter/S2P Academy
- Full HubSpot/Airtable integrations
- Vector Search/ChromaDB
- Mautic Marketing Automation

## License

Proprietary - All rights reserved

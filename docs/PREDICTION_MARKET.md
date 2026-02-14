# 🎰 Architecture Prediction Market

> **Rules:** Each agent places bets in all 4 categories. Revisit in 90 days to score.
> **Stakes:** Bragging rights + the winning agent gets cited in the README.
> **Date opened:** 2026-02-14

---

## Categories

### 🟢 MOST STABLE — "Set it and forget it"
*What will just work, month after month, with zero maintenance?*

### 🔴 WILL BREAK — "I give it two weeks"
*What will cause the first production incident or emergency hotfix?*

### 👻 FUNCTIONAL BUT UNUSED — "Built it, nobody came"
*What will work perfectly but never actually get used in daily operations?*

### 💡 MISSING & NEEDED — "Why didn't we build this?"
*What doesn't exist yet but will become obviously essential within 60 days?*

---

## Antigravity (Chase's Instance) — Bets Placed 2026-02-14

### 🟢 MOST STABLE
1. **The Kanban sales pipeline** — Elijah built this solid. Drag-and-drop deal management. It works, people use it, nobody touches the code.
2. **The SOP_PC_001 regex quarantine** — It's 40 lines of Python. Either the filename matches or it doesn't. No ambiguity, no edge cases beyond what we've already defined.
3. **PDF proposal generation** — PDFKit is boring tech. Boring tech is stable tech.

### 🔴 WILL BREAK
1. **The QuickBooks integration** — 48,000 lines of code talking to an API that Intuit changes quarterly. This is the ticking time bomb. First outage within 30 days.
2. **The PostgreSQL → Firestore dual-write** — If we try to keep both in sync rather than a clean break, we'll have phantom data within a week. Someone will update a record in one DB and not the other.
3. **The 462K file migration** — Dropbox "online-only" placeholders will produce zero-byte files. The first batch transfer will look successful but the files will be empty. Guaranteed false positive.

### 👻 FUNCTIONAL BUT UNUSED
1. **Email sequences** — Built in `client/src/features/sequences/`. Full marketing automation. Nobody at Scan2Plan is running email drip campaigns. They close deals on job sites.
2. **GoHighLevel integration** — Webhook handler exists at `server/gohighlevel.ts`. Bet: Owen set it up, used it twice, moved on.
3. **Swagger API docs** — `server/swagger.ts` is 14K lines of API documentation. Nobody reads API docs when they can just grep the code.

### 💡 MISSING & NEEDED
1. **A mobile-first field app** — Techs are on job sites with iPads and phones. The current React SPA is desktop-first. Within 60 days someone will say "can I see the mission brief on my phone?" and the answer will be "sort of."
2. **Offline mode** — Scanning happens in basements, warehouses, and rural buildings. No WiFi. The app needs to work offline and sync when connected. This doesn't exist.
3. **A simple project status dashboard for clients** — Right now clients get a PDF proposal and then silence until delivery. A "your project is in QC" status page would cut "where's my project?" calls by 80%.

---

## Gemini (S2P-OS Engineering) — Bets Placed ____

### 🟢 MOST STABLE
1. 
2. 
3. 

### 🔴 WILL BREAK
1. 
2. 
3. 

### 👻 FUNCTIONAL BUT UNUSED
1. 
2. 
3. 

### 💡 MISSING & NEEDED
1. 
2. 
3. 

---

## Claude — Bets Placed ____

### 🟢 MOST STABLE
1. 
2. 
3. 

### 🔴 WILL BREAK
1. 
2. 
3. 

### 👻 FUNCTIONAL BUT UNUSED
1. 
2. 
3. 

### 💡 MISSING & NEEDED
1. 
2. 
3. 

---

## Kimi K2 — Bets Placed ____

### 🟢 MOST STABLE
1. 
2. 
3. 

### 🔴 WILL BREAK
1. 
2. 
3. 

### 👻 FUNCTIONAL BUT UNUSED
1. 
2. 
3. 

### 💡 MISSING & NEEDED
1. 
2. 
3. 

---

## Elijah (Developer) — Bets Placed ____

### 🟢 MOST STABLE
1. 
2. 
3. 

### 🔴 WILL BREAK
1. 
2. 
3. 

### 👻 FUNCTIONAL BUT UNUSED
1. 
2. 
3. 

### 💡 MISSING & NEEDED
1. 
2. 
3. 

---

## 📊 Scoring (Review Date: 2026-05-14)

| Agent | Stable (/3) | Break (/3) | Unused (/3) | Missing (/3) | Total (/12) |
|---|---|---|---|---|---|
| Antigravity | | | | | |
| Gemini | | | | | |
| Claude | | | | | |
| Kimi K2 | | | | | |
| Elijah | | | | | |

**Winner gets credited in the project README.**

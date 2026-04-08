# DayCoach — Project Reference

> Voice-powered daily accountability app built for the ElevenLabs + Replit Hackathon (ElevenHacks #3).  
> Uses ElevenLabs Conversational AI with 4 adaptive coach personas, real-time client tools, and post-call webhooks.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Environment Variables — How to Get Them](#4-environment-variables--how-to-get-them)
5. [ElevenLabs Setup](#5-elevenlabs-setup)
6. [Voice Personas](#6-voice-personas)
7. [Client Tools](#7-client-tools)
8. [Webhook Setup](#8-webhook-setup)
9. [API Routes Reference](#9-api-routes-reference)
10. [Database Schema](#10-database-schema)
11. [Key Commands](#11-key-commands)
12. [Running Locally (Outside Replit)](#12-running-locally-outside-replit)
13. [Incomplete / Next Steps](#13-incomplete--next-steps)

---

## 1. Project Architecture

```
Browser (React + Vite)
    ↕  REST API calls (React Query hooks)
    ↕  WebSocket (ElevenLabs Conversational AI SDK)
Express API Server (Port 8080)
    ↕  PostgreSQL (Drizzle ORM)
    ↕  ElevenLabs REST API (TTS, Voice Design, Signed URLs)
ElevenLabs Cloud
    → POST-call webhook → Express /api/agent/webhook
```

**Session flow:**
1. User taps coach → frontend calls `POST /api/agent/session`
2. API selects agent based on streak/pattern, generates signed URL + system prompt
3. Frontend opens WebSocket to ElevenLabs using the signed URL
4. Agent speaks; user responds via mic
5. During call: client tools (`complete_task`, `add_task`) update the DB in real-time
6. Call ends → ElevenLabs fires webhook → transcript stored in DB

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, TypeScript, Tailwind CSS |
| Voice SDK | `@11labs/react` (Conversational AI) |
| Backend | Express 5, Node.js 24, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API Spec | OpenAPI 3.1 (Orval for codegen) |
| Monorepo | pnpm workspaces |
| Build | esbuild (CJS) |
| Platform | Replit (originally) |

---

## 3. Folder Structure

```
DayCoach/
├── artifacts/
│   ├── daycoach/           # React frontend (Port 3000 / Replit port 20249)
│   │   └── src/
│   │       ├── App.tsx     # Main app — voice session, client tools, task UI
│   │       └── components/ # ConversationOverlay, VagueSuggestion, Shell
│   └── api-server/         # Express backend (Port 8080 / Replit port 20250)
│       └── src/
│           ├── routes/
│           │   ├── agent.ts      # /api/agent/* — session, webhook, logs
│           │   ├── tasks.ts      # /api/tasks/*
│           │   ├── checkins.ts   # /api/checkin/morning|evening
│           │   ├── patterns.ts   # /api/patterns
│           │   └── history.ts    # /api/history
│           └── lib/
│               ├── elevenlabs.ts # ElevenLabs API calls (TTS, signed URL, voice design)
│               └── voicePersonaSelector.ts
├── lib/
│   ├── db/                 # Drizzle schema + migrations
│   ├── api-spec/           # openapi.yaml — source of truth for API shape
│   ├── api-zod/            # Auto-generated Zod validators (run codegen)
│   └── api-client-react/   # Auto-generated React Query hooks (run codegen)
├── scripts/
│   └── src/seed-demo.ts    # Populates 10 days of realistic demo data
├── documentation/          # ← You are here
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .replit
```

---

## 4. Environment Variables — How to Get Them

You need these 6 env vars. Here's exactly where each one comes from:

---

### `DATABASE_URL`

**What it is:** PostgreSQL connection string.

**On Replit (original method):**
1. Open your Repl
2. In the left sidebar → click **Tools** → **Database**
3. Replit spins up a free PostgreSQL database
4. The `DATABASE_URL` is **automatically added to your Repl's Secrets** — you don't type it yourself
5. To view it: go to **Secrets** tab (lock icon in sidebar) → find `DATABASE_URL`
6. It looks like: `postgresql://user:password@host:5432/dbname`

**Outside Replit (local dev or other platforms):**
- Use [Neon](https://neon.tech) (free PostgreSQL, similar to Replit's) — sign up, create a project, copy the connection string
- Or use [Supabase](https://supabase.com) → Project Settings → Database → Connection String
- Or run locally: `postgresql://postgres:password@localhost:5432/daycoach`

After getting the URL, run the DB migration:
```bash
pnpm --filter @workspace/db run push
```

---

### `SESSION_SECRET`

**What it is:** A random string used by Express to sign session cookies. Can be anything long and random — it just needs to be consistent across restarts.

**On Replit (original method):**
- You (or Replit agent) added this manually to Replit Secrets
- It was likely generated as a random string

**How to generate a new one:**
```bash
# Option 1 — openssl (any terminal)
openssl rand -base64 32

# Option 2 — Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and set it as your `SESSION_SECRET`. Keep it secret — don't commit to git.

---

### `ELEVENLABS_API_KEY`

**What it is:** Your ElevenLabs account API key.

**How to get it:**
1. Go to [elevenlabs.io](https://elevenlabs.io) → sign in
2. Click your profile icon (top right) → **Profile + API Key**
3. Copy the API key shown there
4. Paste into Replit Secrets (or `.env` file locally)

---

### `ELEVENLABS_AGENT_SUNNY`, `_COACH`, `_COMMANDER`, `_CHAMPION`

**What they are:** ElevenLabs Conversational AI agent IDs — one per persona.

**How to get them:**
1. Go to [elevenlabs.io](https://elevenlabs.io) → **Products** → **Conversational AI**
2. You should see your 4 agents: Sunny, Coach, Commander, Champion
3. Click each agent → the **Agent ID** is shown in the URL or on the agent page
4. It looks like: `agent_01abc123...`

> If the agents are missing (e.g., Replit environment was reset), you need to recreate them in the ElevenLabs dashboard. The system prompts are built dynamically in `artifacts/api-server/src/routes/agent.ts` — you don't need to set them in the dashboard, just create agents with any placeholder prompt.

---

## 5. ElevenLabs Setup

### What features are used

| Feature | Where in code | What it does |
|---------|--------------|-------------|
| Conversational AI | `App.tsx` → `useConversation` hook | Live voice chat with agent |
| Signed URL | `elevenlabs.ts` → `getConvAiSignedUrl()` | Secure connection for private agents |
| Client Tools | `App.tsx` lines 302–339 | Agent calls functions in the app during conversation |
| Post-call Webhook | `agent.ts` lines 280–317 | Receives transcript after call ends |
| TTS | `elevenlabs.ts` → `generateSpeech()` | Coaches on vague tasks (audio tip) |
| Voice Design API | `elevenlabs.ts` → `createVoicePreviews()` | Create custom voices (not actively used in UI) |

### Agent configuration (ElevenLabs Dashboard)

The system prompt and first message are **injected at runtime** from the API — you don't need to configure them in the dashboard. But you do need to:

1. Enable **Client Tools** on each agent (see section 7)
2. Add the **Webhook URL** on each agent (see section 8)
3. Set the agent to **private** (requires signed URL — already handled)

---

## 6. Voice Personas

Four personas, each mapped to an ElevenLabs agent. The persona is selected automatically based on the user's streak and missed days:

| Env Var | Persona | Agent ID | Voice style | Triggered when |
|---------|---------|----------|-------------|----------------|
| `ELEVENLABS_AGENT_SUNNY` | Sunny | `agent_REDACTED_SUNNY` | Warm, encouraging | Streak ≥ 2 days |
| `ELEVENLABS_AGENT_COACH` | Coach | `agent_REDACTED_COACH` | Calm but direct | Missed 1–2 days |
| `ELEVENLABS_AGENT_COMMANDER` | Commander | `agent_REDACTED_COMMANDER` | Blunt, no excuses | Missed 3+ days |
| `ELEVENLABS_AGENT_CHAMPION` | Champion | `agent_REDACTED_CHAMPION` | Celebratory, hype | 100% completion today |

Selection logic: `artifacts/api-server/src/lib/voicePersonaSelector.ts`

System prompts are built dynamically in `agent.ts` → `buildSystemPrompt()` and injected via the ElevenLabs SDK override at session start.

---

## 7. Client Tools

Client tools allow the agent to call functions **in the browser** during a conversation, updating the UI and database in real-time.

### Tools defined in `App.tsx` (lines 302–339)

```
complete_task(task_id: number)
  → PATCH /api/tasks/:id/complete
  → marks the task done, updates UI instantly

add_task(text: string)
  → POST /api/tasks
  → adds a new task during conversation
```

### How to register them in ElevenLabs Dashboard

1. Go to your agent → **Tools** tab
2. Add a **Client Tool** (not a server tool)
3. Name: `complete_task`, Parameter: `task_id` (type: number, required)
4. Name: `add_task`, Parameter: `text` (type: string, required)
5. Repeat for all 4 agents

> Client tools run in the browser — the agent calls them, the SDK fires the callback in `App.tsx`, and the result is reported back to the agent automatically.

---

## 8. Webhook Setup

The webhook receives the full conversation transcript after the call ends.

### Endpoint in the app

```
POST /api/agent/webhook
```

Implemented in: `artifacts/api-server/src/routes/agent.ts` lines 280–317

Listens for: `conversation.ended` event  
Stores: transcript in `conversation_logs` table

### Configure in ElevenLabs Dashboard

For **each of the 4 agents**:
1. Go to ElevenLabs → your agent → **Webhooks** tab
2. Add webhook URL: `https://<your-domain>/api/agent/webhook`
3. Enable event: `conversation.ended`
4. Save

Your domain on Replit looks like: `https://daycoach.<your-username>.repl.co`

> **Known limitation:** The current webhook handler updates the first `conversation_log` row with a NULL transcript. This can cause issues if two calls end simultaneously. For hackathon purposes it's fine — a production fix would match by `conversation_id`.

---

## 9. API Routes Reference

### Agent

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/agent/session` | Get signed URL + system prompt for a coach session |
| POST | `/api/agent/conversation-log` | Log conversation metadata after call |
| POST | `/api/agent/webhook` | Receive ElevenLabs post-call webhook |

### Tasks

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/tasks` | Get today's tasks |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id/complete` | Mark task complete |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/validate` | Check if task is vague + return TTS coaching audio |

### Check-ins

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/checkin/morning` | Generate morning briefing audio |
| POST | `/api/checkin/evening` | Generate evening reflection audio |

### Insights

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/patterns` | Streak, missed days, persona, per-category stats |
| GET | `/api/history` | Daily summaries for the last 14 days |
| GET | `/api/voice-personas` | List of 4 configured personas |

### Demo

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/demo/toggle` | Toggle demo mode (forces Commander persona) |

---

## 10. Database Schema

All tables managed via Drizzle ORM. Schema lives in `lib/db/src/schema/`.

### `tasks`
```
id          serial PK
text        varchar
date        date (defaults to today)
completed   boolean (default false)
category    varchar (Health | Work | Learning | Mindset — auto-detected)
created_at  timestamp
```

### `checkins`
```
id          serial PK
type        varchar (morning | evening)
date        date
script      text (generated script)
persona     varchar
created_at  timestamp
```

### `voice_personas`
```
id          serial PK
key         varchar (sunny | coach | commander | champion)
label       varchar
voice_id    varchar (ElevenLabs voice ID)
description text
```

### `daily_summaries`
```
id              serial PK
date            date
total_tasks     integer
completed_tasks integer
completion_rate numeric
persona_used    varchar
created_at      timestamp
```

### `conversation_logs`
```
id               serial PK
voice_persona    varchar
voice_persona_label varchar
started_at       timestamp
ended_at         timestamp
duration_seconds integer
disconnect_reason varchar
mode             varchar (checkin | review)
transcript       text (filled in by webhook)
created_at       timestamp
```

---

## 11. Key Commands

```bash
# Install all dependencies (run this first after moving the project)
pnpm install

# Push DB schema to PostgreSQL (run after setting DATABASE_URL)
pnpm --filter @workspace/db run push

# Run API server in dev mode
pnpm --filter @workspace/api-server run dev

# Run frontend in dev mode
pnpm --filter @workspace/daycoach run dev

# Regenerate React hooks + Zod types from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Typecheck everything
pnpm run typecheck

# Build all packages
pnpm run build

# Populate demo data (10 days of realistic tasks)
pnpm --filter @workspace/scripts run tsx src/seed-demo.ts
```

---

## 12. Running Locally (Outside Replit)

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables** — `.env` file is already at `artifacts/api-server/.env` with all values filled in. Template:
   ```env
   DATABASE_URL=postgresql://postgres:password@helium/heliumdb?sslmode=disable
   SESSION_SECRET=<generated>
   ELEVENLABS_API_KEY=<see .env>
   ELEVENLABS_AGENT_SUNNY=agent_REDACTED_SUNNY
   ELEVENLABS_AGENT_COACH=agent_REDACTED_COACH
   ELEVENLABS_AGENT_COMMANDER=agent_REDACTED_COMMANDER
   ELEVENLABS_AGENT_CHAMPION=agent_REDACTED_CHAMPION
   ```

3. **Push DB schema**
   ```bash
   pnpm --filter @workspace/db run push
   ```

4. **Start API server** (terminal 1)
   ```bash
   pnpm --filter @workspace/api-server run dev
   # Runs on http://localhost:8080
   ```

5. **Start frontend** (terminal 2)
   ```bash
   pnpm --filter @workspace/daycoach run dev
   # Runs on http://localhost:5173 (or similar)
   ```

6. **Configure frontend API URL** — check `artifacts/daycoach/src/` for any API base URL config and point it to `http://localhost:8080`

---

## 13. Incomplete / Next Steps

These were in-progress or not finished when Replit credits ran out:

| Item | Status | Notes |
|------|--------|-------|
| Client tools registered in ElevenLabs dashboard | Pending | Code is complete; need to add tools in ElevenLabs UI for each agent |
| Webhook URL configured in ElevenLabs dashboard | Pending | Code is complete; need to set URL in ElevenLabs UI for each agent |
| Webhook `conversation_id` matching | Partial | Currently matches first NULL transcript row; can cause issues with concurrent calls |
| Seed script path | Minor fix needed | Path in replit.md uses `scripts/node_modules/.bin/tsx`; use `pnpm --filter @workspace/scripts run tsx` instead |

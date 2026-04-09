# DayCoach

Voice-powered daily accountability coaching. Talk to an AI coach that adapts its tone based on how you've been showing up — and can update your task list while you're talking.

Built for the ElevenLabs + Replit hackathon.

---

## What it does

- **Live voice sessions** — morning planning, task review, and evening reflection with an AI coach
- **Adaptive personas** — coach tone shifts automatically based on your streak and completion patterns
- **Real-time task actions** — coach marks tasks complete, adds, edits, or deletes tasks mid-conversation
- **Smart task quality** — vague tasks get flagged with spoken audio feedback and a suggestion
- **Auto-categorisation** — tasks tagged into Health, Work, Learning, Mindset automatically
- **14-day history** — expandable per-day task breakdown with completion rates

## The four coaches

| Coach | Triggered when | Tone |
|---|---|---|
| **Sunny** | Morning — streak of 2+ days | Warm, encouraging |
| **Coach** | Morning — missed 1–2 days | Calm, direct |
| **Commander** | Morning — missed 3+ days | Strict, no excuses |
| **Champion** | Evening — completed every task | Celebratory, hype |

The app selects the coach automatically. Users never choose manually.

---

## Prerequisites

- Node.js 24+
- pnpm (`npm install -g pnpm`)
- A free [Neon](https://neon.tech) PostgreSQL database
- An [ElevenLabs](https://elevenlabs.io) account (free tier works)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/sharmilaraghu/daycoach.git
cd daycoach
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ELEVENLABS_API_KEY=your-api-key

# One agent ID per coaching persona (see step 4)
ELEVENLABS_AGENT_SUNNY=
ELEVENLABS_AGENT_COACH=
ELEVENLABS_AGENT_COMMANDER=
ELEVENLABS_AGENT_CHAMPION=

SESSION_SECRET=any-random-string
PORT=8080
NODE_ENV=development
```

### 3. Set up the database

1. Go to [neon.tech](https://neon.tech) → create a free project
2. Copy the connection string (with `?sslmode=require`) into `DATABASE_URL`
3. Apply the schema:

```bash
pnpm --filter @workspace/db run push
```

### 4. Create ElevenLabs agents

You need **4 Conversational AI agents** — one per persona.

In the [ElevenLabs dashboard](https://elevenlabs.io) → Conversational AI → Create Agent, create four agents and copy each **Agent ID** into your `.env`:

| Agent name | Env var |
|---|---|
| DayCoach — Sunny | `ELEVENLABS_AGENT_SUNNY` |
| DayCoach — Coach | `ELEVENLABS_AGENT_COACH` |
| DayCoach — Commander | `ELEVENLABS_AGENT_COMMANDER` |
| DayCoach — Champion | `ELEVENLABS_AGENT_CHAMPION` |

**For each agent, do two things:**

**a) Enable overrides** — Agent Settings → Security → Allow client to override:
- System prompt ✓
- First message ✓

**b) Register 4 client tools** — Agent Settings → Tools → Add tool → Client tool:

| Tool name | Parameters |
|---|---|
| `complete_task` | `task_id` (number, required) |
| `add_task` | `text` (string, required) |
| `update_task` | `task_id` (number, required), `text` (string, required) |
| `delete_task` | `task_id` (number, required) |

**c) (Production only) Webhook** — Agent Settings → Post-call Webhook:
```
https://<your-domain>/api/agent/webhook
```

### 5. Run

```bash
./start.sh
```

- API: http://localhost:8080
- Frontend: http://localhost:5173

### 6. Seed demo data (optional)

Populates 10 days of realistic task history:

```bash
pnpm --filter @workspace/scripts run seed-demo
```

---

## Deploy to Replit

1. Import this repo in Replit (Create Repl → Import from GitHub)
2. Add secrets in Replit: `DATABASE_URL`, `ELEVENLABS_API_KEY`, `SESSION_SECRET`
3. Add the 4 agent IDs as private environment variables or Replit Secrets:
   `ELEVENLABS_AGENT_SUNNY`, `ELEVENLABS_AGENT_COACH`, `ELEVENLABS_AGENT_COMMANDER`, `ELEVENLABS_AGENT_CHAMPION`
4. Hit **Deploy** — Replit runs the build and starts the server automatically

---

## Key commands

```bash
./start.sh                                    # Run API + frontend
pnpm run typecheck                            # Type check all packages
pnpm --filter @workspace/db run push          # Apply DB schema
pnpm --filter @workspace/api-spec run codegen # Regenerate API client after editing openapi.yaml
pnpm --filter @workspace/scripts run seed-demo # Seed 10 days of demo data
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui |
| Voice | ElevenLabs Conversational AI SDK |
| Backend | Express 5, Node.js 24, TypeScript 5.9 |
| Database | PostgreSQL, Drizzle ORM |
| API contracts | OpenAPI 3.1 → Orval → React Query + Zod |
| Monorepo | pnpm workspaces |

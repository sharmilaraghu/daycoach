# DayCoach — Local Setup Guide

## Prerequisites

- Node.js 24+
- pnpm (`npm install -g pnpm`)
- A free [Neon](https://neon.tech) PostgreSQL database
- An [ElevenLabs](https://elevenlabs.io) account (free tier works)

---

## 1. Clone and install

```bash
git clone https://github.com/sharmilaraghu/daycoach.git
cd daycoach
pnpm install
```

---

## 2. Create your `.env` file

```bash
cp .env.example .env
```

Fill in `.env` — instructions for each service are below.

---

## 3. Set up the database (Neon)

1. Go to [neon.tech](https://neon.tech) → create a free project
2. Copy the **connection string** (with `?sslmode=require`)
3. Paste it into `DATABASE_URL` in your `.env`
4. Apply the schema:

```bash
pnpm --filter @workspace/db run push
```

---

## 4. Set up ElevenLabs agents

You need **4 Conversational AI agents** — one per coaching persona.

### 4a. Create each agent

In the [ElevenLabs dashboard](https://elevenlabs.io) → Conversational AI → Create Agent:

| Persona | Suggested name | `SESSION_SECRET` var |
|---|---|---|
| Sunny | DayCoach — Sunny | `ELEVENLABS_AGENT_SUNNY` |
| Coach | DayCoach — Coach | `ELEVENLABS_AGENT_COACH` |
| Commander | DayCoach — Commander | `ELEVENLABS_AGENT_COMMANDER` |
| Champion | DayCoach — Champion | `ELEVENLABS_AGENT_CHAMPION` |

Copy each **Agent ID** into your `.env`.

### 4b. Enable overrides on each agent

Without this the voice session will disconnect immediately.

For each agent: **Agent Settings → Security → Allow client to override**

Enable both:
- **System prompt**
- **First message**

### 4c. Register client tools on each agent

The coach calls these during live conversations to update the app.

Add two tools to each agent (**Agent Settings → Tools → Add tool → Client tool**):

**Tool 1**
- Name: `complete_task`
- Description: `Mark a task as complete`
- Parameter: `task_id` — type `number`, required

**Tool 2**
- Name: `add_task`
- Description: `Add a new task to today's list`
- Parameter: `text` — type `string`, required

### 4d. (Optional) Webhook — production only

For transcripts to be saved after each session, set a post-call webhook:

**Agent Settings → Post-call Webhook → URL:**
```
https://<your-public-domain>/api/agent/webhook
```

This won't fire on localhost (ElevenLabs can't reach it). Works on Replit / any public deployment.

---

## 5. Start the app

```bash
./start.sh
```

- API: http://localhost:8080
- Frontend: http://localhost:5173

---

## 6. Seed demo data (optional but recommended for demos)

Populates 10 days of realistic task history across all 4 categories:

```bash
pnpm --filter @workspace/scripts run seed-demo
```

---

## Useful commands

```bash
# Run both servers
./start.sh

# Type check everything
pnpm run typecheck

# Apply schema changes to DB
pnpm --filter @workspace/db run push

# Re-generate API client after editing lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

---

## More detail

See [PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md) for architecture, data flow, and deployment notes.

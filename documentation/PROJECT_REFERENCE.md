# DayCoach — Project Reference

Voice-powered daily accountability app. React 19 frontend + Express 5 API + PostgreSQL + ElevenLabs Conversational AI.

---

## Architecture

```
Browser (React + Vite, port 5173)
    ↕  REST API  (React Query — generated hooks)
    ↕  WebSocket (ElevenLabs Conversational AI SDK)

Express API Server (port 8080)
    ↕  PostgreSQL via Drizzle ORM
    ↕  ElevenLabs REST API (signed URLs, TTS)

ElevenLabs Cloud
    → post-call webhook → POST /api/agent/webhook
```

**Voice session flow:**
1. User taps a coach button → `POST /api/agent/session`
2. Server selects agent by streak/pattern, builds system prompt, returns signed URL
3. Frontend connects WebSocket to ElevenLabs via signed URL
4. During call: client tools (`complete_task`, `add_task`) update DB and UI in real time
5. Call ends → ElevenLabs webhook fires → transcript stored in `conversation_logs`

---

## Folder Structure

```
artifacts/
  api-server/src/
    routes/
      agent.ts          # /api/agent/* — session, webhook, conversation log
      tasks.ts          # /api/tasks/* — CRUD, validation, category detection
      patterns.ts       # /api/patterns, /api/history, /api/voice-personas
      checkin.ts        # /api/checkin/morning|evening
      audio.ts          # /api/audio/:id — serve TTS audio files
    lib/
      elevenlabs.ts     # ElevenLabs API (TTS, signed URL, voice design)
      voicePersonaSelector.ts  # Streak-based persona selection logic
      audioStore.ts     # In-memory audio file cache
  daycoach/src/
    App.tsx             # All UI: voice session, client tools, task list, history

lib/
  db/src/schema/        # Drizzle table definitions (source of truth for DB shape)
  api-spec/openapi.yaml # OpenAPI 3.1 spec (source of truth for API shape)
  api-zod/              # Auto-generated Zod validators — DO NOT edit
  api-client-react/     # Auto-generated React Query hooks — DO NOT edit

scripts/src/
  seed-demo.ts          # Inserts 10 days of realistic demo data
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui |
| Voice | `@11labs/react` Conversational AI SDK |
| Backend | Express 5, Node.js 24, TypeScript 5.9 strict |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod v4 (auto-generated from OpenAPI) |
| API Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Monorepo | pnpm workspaces |

---

## Voice Personas

Four personas selected automatically — user never picks manually.

| Persona | Env var | Triggered when |
|---|---|---|
| Sunny | `ELEVENLABS_AGENT_SUNNY` | Streak ≥ 2 days |
| Coach | `ELEVENLABS_AGENT_COACH` | Missed 1–2 days |
| Commander | `ELEVENLABS_AGENT_COMMANDER` | Missed 3+ days |
| Champion | `ELEVENLABS_AGENT_CHAMPION` | 100% completion today |

Selection logic: `lib/voicePersonaSelector.ts` → `selectVoicePersona()`

System prompts are built at runtime in `agent.ts` → `buildSystemPrompt()` and injected via the ElevenLabs SDK `overrides` param at session start. Nothing is hardcoded in the ElevenLabs dashboard.

---

## Client Tools

The coach calls these during live conversation. The ElevenLabs SDK fires the browser-side handler, which hits the API and updates state in real time.

| Tool | Handler in App.tsx | API call |
|---|---|---|
| `complete_task(task_id)` | clientTools in Home() | `PATCH /api/tasks/:id/complete` |
| `add_task(text)` | clientTools in Home() | `POST /api/tasks` |
| `update_task(task_id, text)` | clientTools in Home() | `PATCH /api/tasks/:id` |
| `delete_task(task_id)` | clientTools in Home() | `DELETE /api/tasks/:id` |

All four tools are registered on each agent via the ElevenLabs API (no manual dashboard step needed — see registration script in git history).

**Override settings required for each agent:**
- Agent Settings → Security → Allow client to override: **System prompt** ✓ and **First message** ✓

---

## API Routes

### Voice / Agent
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/agent/session` | Get signed URL + system prompt for a session |
| POST | `/api/agent/conversation-log` | Store conversation metadata |
| POST | `/api/agent/webhook` | Receive ElevenLabs post-call transcript |

### Tasks
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tasks/today` | Today's task list |
| POST | `/api/tasks` | Create task (auto-detects category) |
| PATCH | `/api/tasks/:id` | Update task text or category |
| PATCH | `/api/tasks/:id/complete` | Toggle completion |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/validate` | Check vagueness, return suggestion + TTS audio |

### Insights
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/patterns` | Streak, missed days, persona, category streaks |
| GET | `/api/history` | 14-day history with per-day task breakdown |
| GET | `/api/voice-personas` | List of 4 personas |

### Check-in (audio)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/checkin/morning` | Generate morning briefing audio |
| POST | `/api/checkin/evening` | Generate evening reflection audio |

---

## Database Schema

Managed via Drizzle ORM. Schema: `lib/db/src/schema/index.ts`

**`tasks`** — today's commitments
```
id, text, date, completed, category, created_at
```

**`conversation_logs`** — one row per voice session
```
id, conversation_id, voice_persona, voice_persona_label,
started_at, ended_at, duration_seconds, disconnect_reason,
mode (checkin|review), transcript, created_at
```

**`daily_summaries`** — end-of-day snapshot (written by close-day flow)
```
id, date, total_tasks, completed_tasks, completion_rate,
voice_persona_used, had_checkin, summary_text, overall_status,
closed_at, closure_source, updated_at
```

**`voice_personas`** — persona config (optional, can also use env vars directly)
```
id, key, label, description, condition, elevenlabs_voice_id, elevenlabs_agent_id
```

**`checkins`** — morning/evening audio briefings
```
id, date, type, script, voice_persona_key, created_at
```

---

## Category Detection

Tasks are auto-tagged into: `health`, `work`, `learning`, `mindset`.

Logic in `tasks.ts` → `detectCategory()`:
1. Keyword scoring (multi-word phrases score higher)
2. Levenshtein fuzzy fallback for misspellings (distance ≤ 1)
3. Default: `work` if no match

---

## Key Commands

```bash
# Install (run first)
pnpm install

# Start both servers
./start.sh
# API: http://localhost:8080  Frontend: http://localhost:5173

# Push DB schema
pnpm --filter @workspace/db run push

# Seed 10 days of demo data
pnpm --filter @workspace/scripts run seed-demo

# Regenerate API client after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Type check all packages
pnpm run typecheck
```

---

## Setup Guide

See [SETUP.md](./SETUP.md) for full clone-and-run instructions including ElevenLabs agent configuration.

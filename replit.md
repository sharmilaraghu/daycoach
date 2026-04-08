# DayCoach

## Overview

A voice-powered daily accountability app for the ElevenLabs + Replit hackathon. Users set tasks, check them off, and get adaptive AI voice coaching from one of four persona agents using ElevenLabs Conversational AI. The coach adapts based on behavioral patterns — warm on streaks, firm when slipping, celebratory on perfect days.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/daycoach) at `/`
- **API framework**: Express 5 (artifacts/api-server) at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Voice**: ElevenLabs Conversational AI SDK (`@11labs/react`) + TTS + Voice Design API

## Voice Personas (ElevenLabs Conversational AI)

Four agents configured in ElevenLabs dashboard. Agent IDs stored as env vars:
- `ELEVENLABS_AGENT_SUNNY` — Sunny (warm, encouraging — streak ≥ 2 days)
- `ELEVENLABS_AGENT_COACH` — Coach (calm but firm — missed 1-2 days)
- `ELEVENLABS_AGENT_COMMANDER` — Commander (blunt, no excuses — missed 3+ days)
- `ELEVENLABS_AGENT_CHAMPION` — Champion (celebratory — 100% completion)

Sessions use dynamic system prompt + first message injected as SDK overrides. Connection forced to WebSocket (`connectionType: "websocket"`).

## ElevenLabs Features Used

1. **Conversational AI** — live voice conversations with 4 distinct agent personas
2. **Client Tools** — agents can call `complete_task(task_id)` and `add_task(text)` during conversation, updating the UI in real-time
3. **Post-call Webhook** — `POST /api/agent/webhook` receives transcript after call ends; configure in ElevenLabs dashboard → Webhooks
4. **Voice Design API** — `createVoicePreviews()` / `saveVoiceFromPreview()` in `elevenlabs.ts`
5. **TTS** — `generateSpeech()` for vague task coaching tips on task add

## Session Modes

- **checkin** (default): Morning focus-setting or evening reflection. System prompt + first message adapted to time of day.
- **review**: Task Review mode — agent walks through all tasks, flags vague/duplicate ones, can complete/add tasks by voice.

## DB Tables

- `tasks` — daily task records (text, date, completed, category). Category auto-detected from task text.
- `checkins` — morning/evening checkin records with script + persona
- `voice_personas` — ElevenLabs voice IDs for each persona
- `daily_summaries` — per-day aggregates for history view
- `conversation_logs` — logs each conversation session (persona, duration, disconnect reason, mode, transcript)

## Category System

Tasks are automatically tagged into one of 4 categories via keyword detection:
- **Health** — gym, run, yoga, swim, nutrition, etc.
- **Work** — email, meeting, report, code, deploy, etc.
- **Learning** — read, study, course, practice, research, etc.
- **Mindset** — journal, meditate, gratitude, reflect, breathe, etc.

Each category has its own streak counter shown on the dashboard. Pattern insights are generated per-category based on which days of the week tasks tend to be missed.

## Demo Mode

A server-side toggle (`POST /api/demo/toggle`) that simulates a "missed days" state by forcing the Commander persona, without clearing any data. Accessible via the Demo Mode toggle on the home screen.

## Seed Data

Run `scripts/node_modules/.bin/tsx scripts/src/seed-demo.ts` to populate 10 days of realistic demo data with mixed completion records across all 4 categories. This creates visible streaks, a broken streak in health/work, and clear pattern insights.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Secrets

- `ELEVENLABS_API_KEY` — ElevenLabs API key for Voice Design + TTS
- `SESSION_SECRET` — Express session secret
- `DATABASE_URL` — PostgreSQL connection string

## Webhook Setup (ElevenLabs Dashboard)

To enable post-call transcripts:
1. Go to ElevenLabs dashboard → each Agent → Webhooks
2. Set URL to: `https://<your-replit-app-domain>/api/agent/webhook`
3. Enable event: `conversation.ended`

## Audio

Generated audio is stored in-memory (1h TTL) and served at `/api/audio/:uuid`. The frontend plays it via an Audio element when a vague task is flagged.

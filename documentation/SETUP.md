# Setup and Deployment

## What You Need

- Node.js 24
- pnpm
- PostgreSQL
- ElevenLabs account
- Replit project for deployment

## Required Environment Variables

```bash
DATABASE_URL=
SESSION_SECRET=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_SUNNY=
ELEVENLABS_AGENT_COACH=
ELEVENLABS_AGENT_COMMANDER=
ELEVENLABS_AGENT_CHAMPION=
```

## Local Setup

```bash
pnpm install
pnpm --filter @workspace/db run push
./start.sh
```

If you want demo data:

```bash
pnpm --filter @workspace/scripts run seed-demo
```

## ElevenLabs Checklist

For each coach agent in ElevenLabs:

1. Create or select the agent
2. Save the agent ID in the matching environment variable
3. Enable **Client Tools**
4. Add the webhook URL
5. If you want private-agent sessions, make sure signed URL generation is configured correctly

## Client Tools To Register

- `complete_task`
- `add_task`

These tools let the coach update the app while the conversation is happening.

## Webhook Setup

Set the webhook URL to:

```text
https://<your-domain>/api/agent/webhook
```

Enable:

- `conversation.ended`

## Current Voice Flow

The app currently supports two live voice session styles:

- `checkin`: morning or evening coaching based on time of day
- `review`: task review with live add/complete actions

Session prompts are generated server-side and injected into ElevenLabs at runtime.

## Replit Deployment Notes

- Put all secrets in the Replit Secrets panel
- Make sure the backend is reachable publicly for ElevenLabs webhooks
- Confirm your app is using the correct production domain in webhook setup
- The frontend runs with `PORT` and `BASE_PATH`; `start.sh` uses `PORT=5173 BASE_PATH=/` locally
- Test one full conversation after deploy:
  - start a session
  - trigger a task action
  - end the conversation
  - confirm the transcript webhook lands successfully

## Useful Commands

```bash
pnpm run build
pnpm run typecheck
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

## More Detail

For the full technical breakdown, see [PROJECT_REFERENCE.md](/Users/sharmila/Documents/Projects/DayCoach/documentation/PROJECT_REFERENCE.md).

# DayCoach — Judges Guide

> A voice accountability coach that adapts to how you've been showing up — and can update your task list while you're talking to it.

---

## What it does

DayCoach turns a task list into a live voice conversation. The coach knows your history, adapts its tone based on your streak, and takes real actions in the app during the call.

The core insight: most productivity apps help you capture tasks. DayCoach focuses on the harder part — following through.

---

## Key features to evaluate

### 1. Adaptive voice coaching (4 personas)

The app selects a coaching persona automatically — users never choose manually.

| Persona | Triggered when | Tone |
|---|---|---|
| **Sunny** | Morning — streak of 2+ days | Warm, encouraging |
| **Coach** | Morning — missed 1–2 days | Calm, direct |
| **Commander** | Morning — missed 3+ days | Blunt, no excuses |
| **Champion** | Evening — completed every task today | Hype, celebratory |

Evening sessions use a different logic: the persona is driven by **today's completion rate** (100% → Champion, ≥70% → Sunny, ≥40% → Coach, <40% → Commander).

### 2. Live task actions during conversation

During a voice session the coach can:
- **Complete a task** — "mark my run as done" → checkbox ticks in the UI in real time
- **Add a task** — "add: run 5km before 9am" → appears in the list during the call
- **Edit a task** — "update gym to 30 min strength training" → task text rewrites live
- **Delete a task** — "remove the meeting task" → coach confirms by name then deletes

These use ElevenLabs **client tools** — the agent calls a browser-side function that hits the API and updates React state in real time.

### 3. Intelligent coaching behaviour

The system prompt is built server-side at session start and injected via the ElevenLabs SDK overrides. It includes:

- **Off-topic guardrails** — per-persona redirect language; one calm warning for abusive input
- **Contextual specificity nudging** — when a task is vague, the coach asks a domain-specific follow-up (fitness → duration/distance, work → deliverable, learning → material/quantity)
- **Duplicate detection** — before adding a task, the coach checks for intent overlap in the existing list
- **Session close instruction** — graceful wrap-up with a one-sentence summary
- **Time-of-day awareness** — late morning sessions add urgency appropriate to the persona
- **Category balance nudge** — if all tasks are one category, the coach gently mentions balance

### 4. Task quality enforcement

When a task is added (voice or text):
- Vague input is flagged ("workout", "study", "work")
- A specific suggestion is returned with spoken TTS audio
- The coach refuses to add vague tasks mid-session and asks for specifics first

### 5. Smart category detection

Tasks are automatically tagged into 4 categories: **Health, Work, Learning, Mindset**. Uses keyword scoring + Levenshtein fuzzy matching (handles misspellings like "excercise" → Health).

### 6. History with per-day task breakdown

The History tab shows 14 days. Each day is expandable to show individual tasks with completion state and category colour coding.

### 7. Post-call transcript storage

After each voice session ElevenLabs fires a webhook to the API which stores the full transcript linked to the conversation log.

---

## ElevenLabs integration points

| Feature | How it's used |
|---|---|
| Conversational AI | Live coaching sessions (Start My Day, End My Day, Review Tasks) |
| Client tools | `complete_task`, `add_task`, `update_task`, `delete_task` fire during conversation |
| System prompt overrides | Full context injected at session start — persona, tasks, stats, mode |
| Post-call webhook | Transcript stored after session ends |
| TTS | Spoken coaching tip on vague task detection |

---

## Best demo flow (5 minutes)

**1. Show the home screen**
- Point out today's coach name and the reason it was selected (shown under the name)
- Show the compact category streak chips
- Note the task list and progress bar

**2. Start a morning check-in**
- Tap **Start My Day**
- Speak a vague task ("add workout") — coach asks a fitness-specific follow-up
- Speak a specific task ("add: run 5km before 9am") — task appears in the list live

**3. Live task actions**
- Say "mark [task name] as done" → checkbox ticks in real time
- Say "remove [task]" → coach confirms by name, then deletes it

**4. Show task vagueness detection (manual)**
- Type a vague task like "study" in the input box
- App surfaces a suggestion and plays a short audio coaching tip

**5. Show the History tab**
- Tap any day to expand its task list
- Show category dots and completion state per task

**6. Show the Guide tab**
- Walk through the 4 coach cards and their trigger conditions
- Point out the voice command reference

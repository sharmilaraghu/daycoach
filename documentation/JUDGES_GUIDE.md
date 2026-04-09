# DayCoach — Judges Guide

## What It Does

DayCoach is a voice-powered daily accountability app. It connects you with an AI coach that knows your task history, adapts its tone based on your streak, and can update your task list mid-conversation.

The core insight: most productivity apps help you capture tasks. DayCoach focuses on the harder part — following through.

---

## Key Features to Evaluate

### 1. Adaptive voice coaching (4 personas)

The app selects a coaching persona automatically based on behavior patterns:

| Persona | Triggered when | Tone |
|---|---|---|
| **Sunny** | Healthy streak (2+ days) | Warm, encouraging |
| **Coach** | 1–2 missed days | Direct, calm |
| **Commander** | 3+ missed days | Blunt, no excuses |
| **Champion** | 100% done today | Hype, celebratory |

The persona selection happens server-side at session start — the user doesn't choose it.

### 2. Live task actions during conversation

During a voice session, the coach can:
- **Mark a task complete** — "mark my run as done" → task checks off in the UI immediately
- **Add a task** — "add: finish the report by 4pm" → appears in the list during the call
- **Edit a task** — "update gym to 30 min strength training" → task text rewrites live
- **Delete a task** — "remove the meeting task" → coach confirms by name then deletes

These are ElevenLabs **client tools** — the agent calls a function in the browser, which hits the API and updates state in real time.

### 3. Task quality enforcement

When adding a task — voice or text — the app:
- Detects vague input ("workout", "study", "work")
- Returns a specific suggestion with spoken audio feedback (ElevenLabs TTS)
- The voice coach also refuses to add vague tasks mid-session and asks for specifics first

### 4. Smart category detection

Tasks are automatically tagged into 4 categories: **Health, Work, Learning, Mindset**. Uses keyword scoring + Levenshtein fuzzy matching (handles misspellings like "excercise" → Health).

### 5. History with per-day task breakdown

The History tab shows 14 days of data. Each day is expandable to show the individual tasks with completion state and category tags.

### 6. Post-call transcript storage

After each voice session, ElevenLabs fires a webhook to the API which stores the full transcript linked to the conversation log.

---

## Best Demo Flow (5 minutes)

**1. Show the home screen**
- Point out today's coach name and the streak counter
- Show the categorized task list
- Note the progress bar

**2. Start a morning check-in**
- Tap **Start My Day**
- Speak a vague task ("add workout") — the coach asks a domain-specific follow-up ("Run or strength? For how long?")
- Speak a specific task ("add: run 5km before 9am") — coach adds it, task appears in the list instantly

**3. Live task actions via voice**
- Say "mark [task name] as done" → checkbox ticks in real time
- Say "remove [task]" → coach confirms by name, then deletes it
- Say "update gym to 30 min strength training" → task text rewrites live

**4. Show task vagueness detection (manual)**
- Type a vague task like "study" in the input box
- The app surfaces a suggestion and plays a short audio coaching tip

**5. Show the History tab**
- Tap on any day to expand its task list
- Show how the categories and completion states are preserved

**6. Show the Guide tab**
- Walk through the 4 coaches and their trigger conditions
- Point out the voice command reference

---

## ElevenLabs Integration Points

| Feature | Where used |
|---|---|
| Conversational AI | Live coaching sessions (`Start My Day`, `End My Day`, `Review Tasks`) |
| Client Tools | `complete_task`, `add_task`, `update_task`, `delete_task` fire during conversation |
| Post-call Webhook | Transcript stored after session ends |
| TTS (text-to-speech) | Spoken coaching tip on vague task detection |

---

## One-Line Pitch

> DayCoach is a voice accountability coach that adapts to how you've been showing up — and can update your task list while you're talking to it.

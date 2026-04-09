import { Router } from "express";
import { db } from "@workspace/db";
import { dailySummariesTable, tasksTable, voicePersonasTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  CloseTodaySummaryBody,
  CreateTaskBody,
  CompleteTaskParams,
  CompleteTaskBody,
  DeleteTaskParams,
  UpdateTaskBody,
  UpdateTaskParams,
  ValidateTaskBody,
} from "@workspace/api-zod";
import { generateSpeech, isElevenLabsConfigured } from "../lib/elevenlabs";
import { selectVoicePersona } from "../lib/voicePersonaSelector";
import { storeAudio } from "../lib/audioStore";
import { logger } from "../lib/logger";

const router = Router();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const VAGUE_KEYWORDS = new Set([
  "work", "study", "exercise", "gym", "read", "relax", "rest", "clean",
  "eat", "sleep", "write", "code", "email", "meeting", "research", "think",
  "plan", "prepare", "practice", "learn", "train", "run", "walk", "cook",
  "shop", "call", "review", "check", "fix", "do", "stuff", "things", "misc",
  "tasks", "errands", "chores", "admin", "work out", "work up", "workout",
  "meditate", "meditation", "journal", "journaling", "stretch", "stretching",
  "laundry", "dishes", "shopping", "cooking", "studying", "exercising",
  "running", "walking", "reading", "writing", "sleeping", "eating",
]);

const EXAMPLE_MAP: Record<string, string> = {
  work: "Complete the Q2 report for my manager",
  study: "Study chapter 5 of calculus for 45 minutes",
  exercise: "Run 3km at the park",
  gym: "Do 3 sets of bench press and squats",
  read: "Read 20 pages of Atomic Habits",
  write: "Write 500 words for my blog post",
  code: "Fix the login bug on the dashboard",
  email: "Reply to 5 overdue client emails",
  clean: "Clean the kitchen and bathroom",
  eat: "Prep healthy lunches for the week",
  sleep: "Be in bed by 10:30 PM",
  run: "Run 5km before 8 AM",
  walk: "Walk 8000 steps today",
  cook: "Make a healthy dinner from scratch",
  research: "Research 3 competitors for the product pitch",
  plan: "Plan next week's schedule in my calendar",
  practice: "Practice guitar for 30 minutes",
  learn: "Complete 2 lessons in the Spanish course",
  call: "Call Mom and catch up for 20 minutes",
  train: "Complete full-body workout at the gym",
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  health: [
    "run", "running", "gym", "workout", "work out", "exercise", "walk", "walking", "jog",
    "jogging", "bike", "cycling", "swim", "swimming", "yoga", "stretch",
    "health", "meditate", "meditation", "sleep", "eat", "diet", "nutrition",
    "cook", "cooking", "meal", "protein", "water", "hydrate", "steps",
    "fitness", "cardio", "lift", "weight", "squat", "bench", "deadlift",
    "pull-up", "push-up", "plank", "hiit", "pilates", "crossfit", "trainer",
  ],
  learning: [
    "read", "reading", "study", "studying", "learn", "learning", "course",
    "book", "chapter", "lesson", "tutorial", "practice", "skill", "research",
    "write", "writing", "essay", "paper", "notes", "review", "memorize",
    "flashcard", "podcast", "video", "lecture", "class", "school", "college",
    "university", "exam", "test", "quiz", "language", "spanish", "french",
    "german", "code", "coding", "programming", "algorithm", "math", "calculus",
    "science", "history", "art", "music", "instrument", "guitar", "piano",
  ],
  mindset: [
    "journal", "journaling", "meditate", "meditation", "gratitude", "reflect",
    "reflection", "mindful", "mindfulness", "breathe", "breathing", "affirmation",
    "visualize", "visualization", "therapy", "coach", "mindset", "habit",
    "routine", "intention", "goal", "plan", "planning", "prioritize",
    "declutter", "organize", "tidy", "self-care", "selfcare", "rest", "relax",
    "nature", "walk outside", "gratitude list", "happiness",
  ],
  work: [
    "email", "meeting", "call", "report", "presentation", "project",
    "client", "deadline", "coding", "review", "design",
    "strategy", "proposal", "invoice", "budget", "hire", "interview",
    "slack", "zoom", "teams", "office", "colleague", "manager", "team",
    "sprint", "ticket", "pull request", "deploy", "ship", "launch",
    "business", "sales", "marketing", "campaign", "analytics", "dashboard",
    "document", "spreadsheet", "excel", "powerpoint", "slides",
  ],
};

/**
 * Match text against a keyword using whole-word boundary detection.
 * Multi-word phrases are matched as substrings (they're already specific enough).
 */
function matchesKeyword(lower: string, kw: string): boolean {
  if (kw.includes(" ")) {
    return lower.includes(kw);
  }
  const re = new RegExp(`\\b${kw.replace(/[-]/g, "\\$&")}\\b`);
  return re.test(lower);
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = { health: 0, learning: 0, mindset: 0, work: 0 };

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (matchesKeyword(lower, kw)) {
        scores[cat] += kw.split(" ").length;
      }
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] > 0) return best[0];

  // Fuzzy fallback — handles misspellings when no exact keyword matched
  const inputWords = lower.split(/\s+/).filter((w) => w.length >= 5);
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.includes(" ") || kw.length < 5) continue;
      for (const word of inputWords) {
        if (levenshtein(word, kw) <= 1) {
          scores[cat] += 0.5;
        }
      }
    }
  }

  const fuzzyBest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return fuzzyBest[1] > 0 ? fuzzyBest[0] : "work";
}

function detectVague(text: string): { isVague: boolean; suggestion: string | null } {
  const trimmed = text.trim().toLowerCase();
  const words = trimmed.split(/\s+/);

  if (VAGUE_KEYWORDS.has(trimmed)) {
    const example = EXAMPLE_MAP[trimmed] || `Try being specific — e.g., "${trimmed} for 30 minutes"`;
    return {
      isVague: true,
      suggestion: `"${text.trim()}" is a bit broad. Try something specific like: "${example}"`,
    };
  }

  if (words.length <= 2) {
    const matchedWord = words.find((w) => VAGUE_KEYWORDS.has(w));
    if (matchedWord) {
      const example = EXAMPLE_MAP[matchedWord] || `"${text.trim()} for 30 minutes"`;
      return {
        isVague: true,
        suggestion: `Be more specific! Instead of "${text.trim()}", try: "${example}"`,
      };
    }
  }

  if (words.length === 1 && trimmed.length >= 3 && trimmed.length <= 20) {
    return {
      isVague: true,
      suggestion: `"${text.trim()}" needs more detail. Add specifics: how long, how much, or where?`,
    };
  }

  return { isVague: false, suggestion: null };
}

async function getActiveVoiceId(): Promise<string | null> {
  try {
    const today = todayDate();
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i + 1));
      return d.toISOString().slice(0, 10);
    });

    const [todayTasks, historyTasks] = await Promise.all([
      db.select().from(tasksTable).where(eq(tasksTable.date, today)),
      db.select().from(tasksTable).where(inArray(tasksTable.date, last7Dates)),
    ]);

    const tasksByDate = new Map<string, typeof historyTasks>();
    for (const task of historyTasks) {
      if (!tasksByDate.has(task.date)) tasksByDate.set(task.date, []);
      tasksByDate.get(task.date)!.push(task);
    }

    let missedDaysLast7 = 0;
    let currentStreak = 0;
    for (const date of last7Dates) {
      const dayTasks = tasksByDate.get(date) ?? [];
      if (dayTasks.length === 0 || dayTasks.filter((t) => t.completed).length === 0) missedDaysLast7++;
    }
    for (const date of last7Dates) {
      const dayTasks = tasksByDate.get(date) ?? [];
      if (dayTasks.filter((t) => t.completed).length > 0) currentStreak++;
      else break;
    }

    const todayCompleted = todayTasks.filter((t) => t.completed).length;
    const { key: personaKey } = selectVoicePersona({
      missedDaysLast7,
      currentStreak,
      todayCompleted,
      todayTotal: todayTasks.length,
      isEvening: false,
    });

    const personas = await db.select().from(voicePersonasTable).where(eq(voicePersonasTable.key, personaKey));
    return personas[0]?.elevenLabsVoiceId ?? null;
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function detectDuplicate(text: string, existingTexts: string[]): string | null {
  const n = normalize(text);
  if (n.length < 3) return null;
  for (const existing of existingTexts) {
    const e = normalize(existing);
    if (e === n) return existing;
    if (e.startsWith(n) || n.startsWith(e)) return existing;
  }
  return null;
}

// POST /api/tasks/validate — must be before /tasks/:id routes
router.post("/tasks/validate", async (req, res) => {
  const parsed = ValidateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text } = parsed.data;

  const today = todayDate();
  const todayTasks = await db.select().from(tasksTable).where(eq(tasksTable.date, today));
  const existingTexts = todayTasks.map((t) => t.text);
  const duplicateOf = detectDuplicate(text, existingTexts);

  if (duplicateOf) {
    res.json({
      isVague: true,
      suggestion: `You already have "${duplicateOf}" — is this a duplicate? Edit to make it different or save it anyway.`,
      audioUrl: null,
    });
    return;
  }

  const { isVague, suggestion } = detectVague(text);

  if (!isVague || !suggestion) {
    res.json({ isVague: false, suggestion: null, audioUrl: null });
    return;
  }

  let audioUrl: string | null = null;
  if (isElevenLabsConfigured()) {
    try {
      const voiceId = await getActiveVoiceId();
      if (voiceId) {
        const coachingText = suggestion.replace(/"/g, "").replace(/'/g, "");
        const audioBuffer = await generateSpeech(voiceId, coachingText);
        const audioId = storeAudio(audioBuffer);
        audioUrl = `/api/audio/${audioId}`;
      }
    } catch (err) {
      logger.warn({ err }, "Failed to generate coaching audio, returning text-only feedback");
    }
  }

  res.json({ isVague: true, suggestion, audioUrl });
});

// GET /api/tasks/today
router.get("/tasks/today", async (req, res) => {
  const today = todayDate();
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.date, today))
    .orderBy(tasksTable.createdAt);
  res.json(tasks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

// POST /api/tasks
router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const category = detectCategory(parsed.data.text);
  const [task] = await db
    .insert(tasksTable)
    .values({ text: parsed.data.text, date: todayDate(), category })
    .returning();
  res.status(201).json({ ...task, createdAt: task.createdAt.toISOString() });
});

// PATCH /api/tasks/:id/complete
router.patch("/tasks/:id/complete", async (req, res) => {
  const params = CompleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  const body = CompleteTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [updated] = await db
    .update(tasksTable)
    .set({ completed: body.data.completed })
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const params = UpdateTaskParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: { text?: string; completed?: boolean; category?: string } = {};
  if (body.data.text !== undefined) {
    updates.text = body.data.text;
    updates.category = body.data.category ?? detectCategory(body.data.text);
  }
  if (body.data.completed !== undefined) {
    updates.completed = body.data.completed;
  }
  if (body.data.category !== undefined) {
    updates.category = body.data.category;
  }

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// PATCH /api/daily-summary/today/close
router.patch("/daily-summary/today/close", async (req, res) => {
  const parsed = CloseTodaySummaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = todayDate();
  const todayTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.date, today));
  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const totalTasks = todayTasks.length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const [summary] = await db
    .insert(dailySummariesTable)
    .values({
      date: today,
      totalTasks,
      completedTasks,
      completionRate,
      voicePersonaUsed: "sunny",
      hadCheckin: true,
      summaryText: parsed.data.summaryText,
      overallStatus: parsed.data.overallStatus,
      closureSource: parsed.data.closureSource ?? "voice_agent",
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dailySummariesTable.date,
      set: {
        totalTasks,
        completedTasks,
        completionRate,
        summaryText: parsed.data.summaryText,
        overallStatus: parsed.data.overallStatus,
        closureSource: parsed.data.closureSource ?? "voice_agent",
        closedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json({
    date: summary.date,
    totalTasks: summary.totalTasks,
    completedTasks: summary.completedTasks,
    completionRate: summary.completionRate,
    voicePersonaUsed: summary.voicePersonaUsed,
    hadCheckin: summary.hadCheckin,
    summaryText: summary.summaryText,
    overallStatus: summary.overallStatus,
    closedAt: summary.closedAt?.toISOString() ?? null,
    closureSource: summary.closureSource,
  });
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const params = DeleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));
  res.json({ success: true });
});

export default router;

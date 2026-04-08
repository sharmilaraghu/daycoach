import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, dailySummariesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PERSONA_DEFINITIONS, selectVoicePersona } from "../lib/voicePersonaSelector";

const router = Router();

let demoMode = false;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const CATEGORIES = [
  { key: "health", label: "Health" },
  { key: "work", label: "Work" },
  { key: "learning", label: "Learning" },
  { key: "mindset", label: "Mindset" },
] as const;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Generate a short pattern insight for a category based on its streak and
 * a histogram of day-of-week misses (days with category tasks but no completions).
 */
function generateCategoryInsight(
  label: string,
  streak: number,
  missedDOW: Record<number, number>,
): string {
  const topMissedEntries = Object.entries(missedDOW)
    .map(([dow, count]) => ({ dow: Number(dow), count }))
    .sort((a, b) => b.count - a.count);

  const topMiss = topMissedEntries[0];

  if (streak === 0) {
    return `Your ${label} streak broke — today's a great day to restart.`;
  }

  if (streak >= 7) {
    return `Perfect week in ${label} — outstanding consistency!`;
  }

  if (streak >= 5) {
    return `${label} is one of your strongest habits right now!`;
  }

  if (topMiss && topMiss.count >= 2) {
    const dayName = DAY_NAMES[topMiss.dow];
    const isWeekend = topMiss.dow === 0 || topMiss.dow === 6;
    if (isWeekend) {
      return `You tend to skip ${label} on ${dayName}s — try a lighter goal on weekends.`;
    }
    return `${dayName}s are your weak spot for ${label} — schedule it earlier that day.`;
  }

  return `Solid ${label} consistency — aim to hit it every day this week.`;
}

// POST /api/demo/toggle
router.post("/demo/toggle", (_req, res) => {
  demoMode = !demoMode;
  res.json({ demoMode });
});

// GET /api/patterns
router.get("/patterns", async (req, res) => {
  const today = todayDate();

  const allTasks = await db.select().from(tasksTable);

  // Today's tasks
  const todayTasks = allTasks.filter((t) => t.date === today);
  const todayCompleted = todayTasks.filter((t) => t.completed).length;
  const todayTotal = todayTasks.length;

  // Last 7 calendar days excluding today
  const last7Dates = Array.from({ length: 7 }, (_, i) => dateString(i + 1));

  // Missed days (days in last 7 with no completions)
  let missedDaysLast7 = 0;
  for (const date of last7Dates) {
    const dayCompleted = allTasks.filter((t) => t.date === date && t.completed).length;
    const dayTotal = allTasks.filter((t) => t.date === date).length;
    if (dayTotal === 0 || dayCompleted === 0) missedDaysLast7++;
  }

  // Current streak: consecutive days (including today if it has completions) counting back
  let currentStreak = 0;
  for (let i = 0; i < 30; i++) {
    const date = dateString(i);
    const dayCompleted = allTasks.filter((t) => t.date === date && t.completed).length;
    if (dayCompleted > 0) {
      currentStreak++;
    } else if (i > 0) {
      break; // only break if we've gone past today (i=0 with 0 is fine)
    }
  }

  // Longest streak over last 90 days
  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < 90; i++) {
    const date = dateString(i);
    const dayCompleted = allTasks.filter((t) => t.date === date && t.completed).length;
    if (dayCompleted > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Completion rate last 7 days
  const last7Tasks = allTasks.filter((t) => last7Dates.includes(t.date));
  const completionRateLast7 =
    last7Tasks.length > 0
      ? last7Tasks.filter((t) => t.completed).length / last7Tasks.length
      : 0;

  // Total tasks completed ever
  const totalTasksCompleted = allTasks.filter((t) => t.completed).length;

  // Category streaks and insights
  const categoryStreaks = CATEGORIES.map(({ key: cat, label }) => {
    // Streak: consecutive days with at least one completed task in this category (last 30 days)
    let catStreak = 0;
    for (let i = 0; i < 30; i++) {
      const date = dateString(i);
      const catCompleted = allTasks.filter(
        (t) => t.date === date && t.category === cat && t.completed,
      ).length;
      if (catCompleted > 0) {
        catStreak++;
      } else {
        break;
      }
    }

    // Missed-day-of-week histogram: which weekday has the most skipped category tasks
    // A "miss" is a day that has category tasks but none were completed (last 14 days, excluding today)
    const missedDOW: Record<number, number> = {};
    for (let i = 1; i <= 14; i++) {
      const date = dateString(i);
      const dayDate = new Date(date + "T00:00:00");
      const catTasks = allTasks.filter((t) => t.date === date && t.category === cat);
      const catCompleted = catTasks.filter((t) => t.completed).length;
      if (catTasks.length > 0 && catCompleted === 0) {
        const dow = dayDate.getDay();
        missedDOW[dow] = (missedDOW[dow] ?? 0) + 1;
      }
    }

    const insight = generateCategoryInsight(label, catStreak, missedDOW);
    return { category: cat, label, streak: catStreak, insight };
  });

  // Active voice persona (demo mode forces commander)
  const patternData = {
    missedDaysLast7: demoMode ? 4 : missedDaysLast7,
    currentStreak: demoMode ? 0 : currentStreak,
    todayCompleted,
    todayTotal,
    isEvening: new Date().getHours() >= 17,
  };
  const { key: activeVoicePersona, reason: activeVoicePersonaReason } =
    selectVoicePersona(patternData);
  const personaDef = PERSONA_DEFINITIONS.find((p) => p.key === activeVoicePersona)!;

  res.json({
    currentStreak,
    longestStreak,
    missedDaysLast7,
    completionRateLast7,
    activeVoicePersona,
    activeVoicePersonaLabel: personaDef.label,
    activeVoicePersonaReason,
    totalTasksCompleted,
    todayCompleted,
    todayTotal,
    categoryStreaks,
    demoMode,
  });
});

// GET /api/history
router.get("/history", async (req, res) => {
  const last14Dates = Array.from({ length: 14 }, (_, i) => dateString(i));

  const results = [];
  for (const date of last14Dates) {
    const dayTasks = await db.select().from(tasksTable).where(eq(tasksTable.date, date));
    const completed = dayTasks.filter((t) => t.completed).length;
    const total = dayTasks.length;
    const completionRate = total > 0 ? completed / total : 0;

    const summaries = await db
      .select()
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.date, date))
      .limit(1);

    results.push({
      date,
      totalTasks: total,
      completedTasks: completed,
      completionRate,
      voicePersonaUsed: summaries[0]?.voicePersonaUsed ?? "sunny",
      hadCheckin: summaries[0]?.hadCheckin ?? false,
    });
  }

  res.json(results);
});

// GET /api/voice-personas
router.get("/voice-personas", async (req, res) => {
  res.json(
    PERSONA_DEFINITIONS.map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
      condition: p.condition,
    })),
  );
});

export default router;

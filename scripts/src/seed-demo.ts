/**
 * Demo data seeder
 * Run: pnpm tsx scripts/seed-demo.ts
 *
 * Inserts 10 days of realistic task history across all 4 categories
 * with a mixed completion record to produce visible streaks and insights.
 */
import { db, tasksTable } from "@workspace/db";
import { sql } from "drizzle-orm";

type Category = "health" | "work" | "learning" | "mindset";

interface SeedTask {
  text: string;
  category: Category;
  completed: boolean;
}

function getDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const HISTORY: Array<{ daysAgo: number; tasks: SeedTask[] }> = [
  // Today — a few already completed, one pending
  {
    daysAgo: 0,
    tasks: [
      { text: "Run 4km at the park before work", category: "health", completed: true },
      { text: "Complete Q2 marketing report draft", category: "work", completed: true },
      { text: "Read 20 pages of Atomic Habits", category: "learning", completed: false },
      { text: "Write morning gratitude journal — 5 things", category: "mindset", completed: true },
    ],
  },
  // Yesterday — all completed
  {
    daysAgo: 1,
    tasks: [
      { text: "30-minute home workout (HIIT)", category: "health", completed: true },
      { text: "Review pull request from Sarah and leave comments", category: "work", completed: true },
      { text: "Complete 2 lessons on Spanish on Duolingo", category: "learning", completed: true },
      { text: "5-minute breathing meditation before lunch", category: "mindset", completed: true },
    ],
  },
  // 2 days ago — all completed
  {
    daysAgo: 2,
    tasks: [
      { text: "Walk 10,000 steps throughout the day", category: "health", completed: true },
      { text: "Prepare slides for Friday product demo", category: "work", completed: true },
      { text: "Study chapter 3 of the Python course", category: "learning", completed: true },
      { text: "Reflect on the week in a journal entry", category: "mindset", completed: true },
    ],
  },
  // 3 days ago — all completed
  {
    daysAgo: 3,
    tasks: [
      { text: "Swim 20 laps at the community pool", category: "health", completed: true },
      { text: "Write project scoping doc for new feature", category: "work", completed: true },
      { text: "Read 15 pages of Deep Work by Cal Newport", category: "learning", completed: true },
      { text: "Evening walk in nature — no phone", category: "mindset", completed: true },
    ],
  },
  // 4 days ago — health and work skipped (mindset + learning done)
  {
    daysAgo: 4,
    tasks: [
      { text: "Morning yoga — 20 minutes", category: "health", completed: false },
      { text: "Finalize Q1 budget spreadsheet", category: "work", completed: false },
      { text: "Watch 2 lecture videos on machine learning", category: "learning", completed: true },
      { text: "Write 3 affirmations for the week ahead", category: "mindset", completed: true },
    ],
  },
  // 5 days ago — all completed
  {
    daysAgo: 5,
    tasks: [
      { text: "Cycle 10km on the trail", category: "health", completed: true },
      { text: "Reply to 8 pending client emails", category: "work", completed: true },
      { text: "Complete 3 lessons on Coursera data course", category: "learning", completed: true },
      { text: "Practice 10-minute mindfulness before bed", category: "mindset", completed: true },
    ],
  },
  // 6 days ago — all completed
  {
    daysAgo: 6,
    tasks: [
      { text: "Full-body strength training at the gym", category: "health", completed: true },
      { text: "Write first draft of blog post on team culture", category: "work", completed: true },
      { text: "Read 20 pages of The Lean Startup", category: "learning", completed: true },
      { text: "Set intentions for the week — 3 key goals", category: "mindset", completed: true },
    ],
  },
  // 7 days ago — health only skipped (broke health streak on Sunday)
  {
    daysAgo: 7,
    tasks: [
      { text: "Run 5km before breakfast", category: "health", completed: false },
      { text: "Update team on project milestones via Slack", category: "work", completed: true },
      { text: "Study chapter 2 of Python crash course", category: "learning", completed: true },
      { text: "Do a Sunday brain dump — clear mental clutter", category: "mindset", completed: true },
    ],
  },
  // 8 days ago — all completed
  {
    daysAgo: 8,
    tasks: [
      { text: "20-min HIIT session at home", category: "health", completed: true },
      { text: "Prepare agenda for Monday standup meeting", category: "work", completed: true },
      { text: "Practice 30 minutes of guitar", category: "learning", completed: true },
      { text: "Gratitude journal — 5 things I am proud of", category: "mindset", completed: true },
    ],
  },
  // 9 days ago — mindset and learning skipped
  {
    daysAgo: 9,
    tasks: [
      { text: "Walk 8000 steps during lunch break", category: "health", completed: true },
      { text: "Fix critical login bug on the dashboard", category: "work", completed: true },
      { text: "Review flashcards on Spanish vocabulary", category: "learning", completed: false },
      { text: "Evening meditation before sleep", category: "mindset", completed: false },
    ],
  },
];

async function main() {
  console.log("Clearing existing tasks...");
  await db.execute(sql`TRUNCATE TABLE tasks RESTART IDENTITY`);

  let totalInserted = 0;
  for (const day of HISTORY) {
    const date = getDate(day.daysAgo);
    for (const task of day.tasks) {
      await db.insert(tasksTable).values({
        text: task.text,
        date,
        category: task.category,
        completed: task.completed,
      });
      totalInserted++;
    }
    console.log(`Seeded ${day.tasks.length} tasks for ${date} (${day.daysAgo} days ago)`);
  }

  console.log(`\nDone! Inserted ${totalInserted} tasks across ${HISTORY.length} days.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

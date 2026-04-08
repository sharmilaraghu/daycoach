import { Router } from "express";
import { logger } from "../lib/logger";
import { GetAgentSessionBody, LogConversationEndBody } from "@workspace/api-zod";
import { db, conversationLogsTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { getConvAiSignedUrl } from "../lib/elevenlabs";

const router = Router();

const AGENT_ID_MAP: Record<string, string | undefined> = {
  sunny: process.env.ELEVENLABS_AGENT_SUNNY,
  coach: process.env.ELEVENLABS_AGENT_COACH,
  commander: process.env.ELEVENLABS_AGENT_COMMANDER,
  champion: process.env.ELEVENLABS_AGENT_CHAMPION,
};

type TaskRef = { id: number; text: string; completed: boolean; category?: string | null };

function buildTaskList(tasks: TaskRef[]): string {
  if (tasks.length === 0) return "No tasks set yet today.";
  return tasks
    .map((t) => {
      const status = t.completed ? "done" : "pending";
      const cat = t.category ? ` [${t.category}]` : "";
      return `  #${t.id}${cat}: "${t.text}" — ${status}`;
    })
    .join("\n");
}

function buildClientToolsInstruction(tasks: TaskRef[]): string {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return "";
  const ids = pending.map((t) => `#${t.id} ("${t.text}")`).join(", ");
  return `
You have two live tools available during this conversation:
- complete_task(task_id: number) — marks a task done in the app instantly. Pending task IDs: ${ids}
- add_task(text: string) — adds a new task to today's list.

Always confirm before calling a tool ("Want me to mark that as done?"). After the tool runs, briefly acknowledge ("Done, marked that complete.").`;
}

function buildSystemPrompt(
  personaKey: string,
  currentStreak: number,
  todayCompleted: number,
  todayTotal: number,
  missedDaysLast7: number,
  tasks: TaskRef[],
  isEvening: boolean,
  mode: "checkin" | "review",
): string {
  const completionRate = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
  const sessionType = mode === "review"
    ? "TASK REVIEW SESSION"
    : (isEvening ? "EVENING CHECK-IN" : "MORNING CHECK-IN");

  const personaCore: Record<string, string> = {
    sunny: "You are Sunny, the warm and encouraging life coach inside DayCoach. You're genuine, upbeat, and celebratory without being over the top. Celebrate every win, guide gently when struggling, remind users that showing up matters more than perfection.",
    coach: "You are Coach, the calm but direct personal trainer inside DayCoach. Hold users accountable without being harsh. Acknowledge setbacks briefly, then focus on today. No fluff — expect results, but stay fair.",
    commander: "You are Commander, the strict military-style accountability voice inside DayCoach. Blunt precision — no excuses. Push them to act NOW. One brief acknowledgment of the past, then forward. You're tough because you want them to succeed.",
    champion: "You are Champion, the celebratory hype coach inside DayCoach. You sound like a sports announcer at a championship — genuinely thrilled and contagiously positive. Celebrate hard, ask about wins, help them set the intention to keep going.",
  };

  const base = personaCore[personaKey] ?? "You are a DayCoach accountability coach. Help the user reflect on their goals and stay on track.";

  const context = [
    `--- SESSION: ${sessionType} ---`,
    `Streak: ${currentStreak} day${currentStreak !== 1 ? "s" : ""} | Today: ${todayCompleted}/${todayTotal} (${completionRate}%) | Missed last 7: ${missedDaysLast7}`,
    ``,
    `TODAY'S TASKS:`,
    buildTaskList(tasks),
    buildClientToolsInstruction(tasks),
    ``,
    `Keep responses to 2-3 sentences. Be conversational, direct, and persona-consistent.`,
  ].filter((l) => l !== undefined).join("\n");

  if (mode === "review") {
    const reviewInstruction = `

TASK REVIEW MODE: Walk through today's task list with the user.
1. Read each pending task and ask if the wording is clear and specific.
2. Flag vague tasks (single words, generic terms like "work", "gym") and suggest specific rewrites.
3. Spot duplicates and mention them.
4. Use add_task to add improved versions when the user agrees. They can delete the old one.
5. Keep it conversational — not a monotone recitation.
Start by telling them how many tasks you see and which ones look questionable.`;
    return `${base}${reviewInstruction}\n\n${context}`;
  }

  if (isEvening) {
    const eveningInstruction = `

EVENING CHECK-IN MODE:
1. Acknowledge what they completed (reference their actual tasks by name).
2. If they missed tasks, address it briefly — hold accountability but don't dwell.
3. Ask one reflective question (what went well, or what they'd do differently tomorrow).
4. If they completed everything, celebrate appropriately for your persona.
This is a wind-down, not a planning session. Keep it warm and brief.`;
    return `${base}${eveningInstruction}\n\n${context}`;
  }

  return `${base}\n\n${context}`;
}

function buildFirstMessage(
  personaKey: string,
  currentStreak: number,
  todayCompleted: number,
  todayTotal: number,
  tasks: TaskRef[],
  isEvening: boolean,
  mode: "checkin" | "review",
): string {
  const pending = tasks.filter((t) => !t.completed);

  if (mode === "review") {
    if (tasks.length === 0) return "You haven't set any tasks yet today. Let's set some together — what's on your plate?";
    if (pending.length === 0) return `All ${tasks.length} tasks are done — incredible! Want to add anything for tomorrow, or shall we call it a win?`;
    return `Alright, let's review your ${tasks.length} task${tasks.length !== 1 ? "s" : ""} for today. I see ${pending.length} still pending. Let me walk through them with you.`;
  }

  if (isEvening) {
    const allDone = todayCompleted === todayTotal && todayTotal > 0;
    const someDone = todayCompleted > 0 && !allDone;
    switch (personaKey) {
      case "sunny":
        if (allDone) return `Hey! You finished everything today — ${todayCompleted} out of ${todayTotal}. That's a great day. How are you feeling?`;
        if (someDone) return `Hey! You got ${todayCompleted} of ${todayTotal} done today. Real progress. What got in the way of the rest?`;
        return `Hey, how did today go? I'm here to listen — no judgment, just reflection.`;
      case "coach":
        if (allDone) return `${todayCompleted} of ${todayTotal} tasks done. Full completion. How did execution feel today?`;
        if (someDone) return `End of day. ${todayCompleted} of ${todayTotal} tasks completed. What happened with the other ${todayTotal - todayCompleted}?`;
        return `Day's over. How did it actually go? Be honest.`;
      case "commander":
        if (allDone) return `Mission complete. ${todayCompleted} of ${todayTotal} tasks executed. Brief debrief — what was your biggest obstacle today?`;
        if (someDone) return `Stand down. ${todayCompleted} of ${todayTotal} completed. ${todayTotal - todayCompleted} outstanding. Report what happened.`;
        return `Day over. What did you actually accomplish? Be specific.`;
      case "champion":
        if (allDone) return `PERFECT DAY! Every single task DONE — ${todayCompleted} for ${todayTotal}! That is CHAMPIONSHIP behavior! Tell me what felt amazing!`;
        if (someDone) return `You showed up today! ${todayCompleted} tasks done is REAL progress. Let's talk about what went great!`;
        return `Hey champion! Day's wrapping up — let's talk about what happened. Every day teaches us something!`;
      default:
        return `Good evening! How did your day go? Let's reflect on what you accomplished.`;
    }
  }

  switch (personaKey) {
    case "sunny":
      if (currentStreak >= 3) return `Hey! ${currentStreak} days in a row — you're building something real here. How's today going for you?`;
      if (currentStreak >= 1) return `Hey! Good to see you showing up. You're on a ${currentStreak}-day streak. What's on your mind today?`;
      return `Hey there! Great to see you checking in. How are you feeling about today?`;
    case "coach":
      if (todayTotal === 0) return `Alright. You're here, but you haven't set any tasks yet. Let's fix that — what are you committing to today?`;
      if (todayCompleted === todayTotal && todayTotal > 0) return `${todayCompleted} of ${todayTotal} tasks done. Good execution. What's next?`;
      return `You've got ${todayTotal} task${todayTotal !== 1 ? "s" : ""} — ${todayCompleted} done. What's in the way of the rest?`;
    case "commander":
      if (todayCompleted === todayTotal && todayTotal > 0) return `All ${todayTotal} tasks done. Acceptable. What's the plan for tomorrow?`;
      if (todayTotal === 0) return `No tasks set. That ends now. What are you doing today — specifics.`;
      return `${todayCompleted} of ${todayTotal} done. ${todayTotal - todayCompleted} outstanding. What's the situation?`;
    case "champion":
      if (todayCompleted === todayTotal && todayTotal > 0) return `EVERY task completed — that is a PERFECT day! I want to hear everything. What felt best?`;
      if (tasks.length > 0) return `You're in motion — ${todayCompleted} of ${todayTotal} done! Let's talk about finishing strong. What's left?`;
      return `You showed up today — that's already a win. Let's make it count. What are we crushing?`;
    default:
      return `Hi! Let's check in on your goals. How's your day going?`;
  }
}

// POST /api/agent/session
router.post("/agent/session", async (req, res) => {
  const parsed = GetAgentSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    currentStreak,
    todayCompleted,
    todayTotal,
    missedDaysLast7,
    activeVoicePersona,
    activeVoicePersonaLabel,
    taskTexts,
    tasks: tasksRaw,
    isEvening = false,
    mode = "checkin",
  } = parsed.data;

  const personaKey = activeVoicePersona;
  const agentId = AGENT_ID_MAP[personaKey];

  if (!agentId) {
    logger.warn({ personaKey }, "No agent ID configured for persona");
    res.json({
      signedUrl: null,
      agentId: null,
      systemPrompt: null,
      firstMessage: null,
      voicePersona: personaKey,
      voicePersonaLabel: activeVoicePersonaLabel,
      available: false,
    });
    return;
  }

  const tasks: TaskRef[] = tasksRaw
    ?? taskTexts.map((text, i) => ({ id: i, text, completed: false }));

  const systemPrompt = buildSystemPrompt(
    personaKey,
    currentStreak,
    todayCompleted,
    todayTotal,
    missedDaysLast7,
    tasks,
    isEvening,
    mode,
  );

  const firstMessage = buildFirstMessage(
    personaKey,
    currentStreak,
    todayCompleted,
    todayTotal,
    tasks,
    isEvening,
    mode,
  );

  logger.info({ personaKey, currentStreak, todayCompleted, todayTotal, isEvening, mode }, "Agent session provisioned");

  let signedUrl: string | null = null;
  try {
    signedUrl = await getConvAiSignedUrl(agentId);
  } catch (err) {
    logger.warn({ err, agentId }, "Failed to get signed URL — falling back to public agentId");
  }

  res.json({
    signedUrl,
    agentId,
    systemPrompt,
    firstMessage,
    voicePersona: personaKey,
    voicePersonaLabel: activeVoicePersonaLabel,
    available: true,
  });
});

// POST /api/agent/conversation-log
router.post("/agent/conversation-log", async (req, res) => {
  const parsed = LogConversationEndBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { voicePersona, voicePersonaLabel, startedAt, durationSeconds, disconnectReason, mode } = parsed.data;

  try {
    await db.insert(conversationLogsTable).values({
      voicePersona,
      voicePersonaLabel,
      startedAt: new Date(startedAt),
      endedAt: new Date(),
      durationSeconds: durationSeconds ?? null,
      disconnectReason: disconnectReason ?? null,
      mode: mode ?? "checkin",
    });

    logger.info({ voicePersona, durationSeconds, disconnectReason, mode }, "Conversation log recorded");
    res.json({ logged: true });
  } catch (err) {
    logger.error({ err }, "Failed to record conversation log");
    res.status(500).json({ logged: false });
  }
});

// POST /api/agent/webhook — ElevenLabs post-call webhook
// Configure this URL in your ElevenLabs agent dashboard under Webhooks
// URL: https://<your-replit-domain>/api/agent/webhook
router.post("/agent/webhook", async (req, res) => {
  const body = req.body as {
    type?: string;
    event_timestamp?: number;
    data?: {
      conversation_id?: string;
      agent_id?: string;
      status?: string;
      transcript?: Array<{ role: string; message: string }>;
      metadata?: Record<string, unknown>;
    };
  };

  logger.info({ eventType: body.type, conversationId: body.data?.conversation_id }, "ElevenLabs webhook received");

  try {
    if (body.type === "conversation.ended" && body.data?.transcript && body.data.transcript.length > 0) {
      const lines = body.data.transcript
        .map((t) => `${t.role === "agent" ? "Coach" : "You"}: ${t.message}`)
        .join("\n");

      await db
        .update(conversationLogsTable)
        .set({ transcript: lines })
        .where(isNull(conversationLogsTable.transcript));

      logger.info({ conversationId: body.data.conversation_id, lines: body.data.transcript.length }, "Transcript stored from webhook");
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Failed to handle webhook");
    res.json({ received: true });
  }
});

export default router;

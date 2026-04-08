/**
 * Voice Persona Definitions
 * Each persona corresponds to a different ElevenLabs voice designed
 * via the Voice Design API.
 */
export interface PersonaDef {
  key: string;
  label: string;
  description: string;
  condition: string;
  voiceDesignPrompt: string;
  sampleText: string;
}

export const PERSONA_DEFINITIONS: PersonaDef[] = [
  {
    key: "sunny",
    label: "Sunny",
    description: "Warm, encouraging life coach who celebrates every small win",
    condition: "You're on a streak — keep going!",
    voiceDesignPrompt:
      "A warm, nurturing woman in her early 40s with a gentle American accent. She sounds like a loving life coach — encouraging, genuine, and slightly upbeat without being over the top. Her voice has a natural smile in it.",
    sampleText:
      "Good morning! You've been showing up consistently and it's really paying off. Let's make today another great one. What are we focusing on?",
  },
  {
    key: "coach",
    label: "Coach",
    description: "Calm but direct personal trainer who expects more from you",
    condition: "You missed a day — time to refocus",
    voiceDesignPrompt:
      "A calm, authoritative man in his late 30s with a measured American accent. He sounds like a no-nonsense personal trainer — firm but fair, direct without being harsh. He expects results and communicates that clearly.",
    sampleText:
      "Alright, listen up. You missed yesterday, and that's behind us now. Today we move forward. Set your tasks and let's get to work.",
  },
  {
    key: "commander",
    label: "Commander",
    description: "Firm military-style voice for when you've been slipping",
    condition: "You've missed multiple days — accountability time",
    voiceDesignPrompt:
      "A strong, commanding older man with a deep voice and sharp military diction. He sounds like a senior drill sergeant — no-nonsense, blunt, and serious. He doesn't accept excuses but genuinely wants you to succeed.",
    sampleText:
      "Two days. Two days you didn't show up. That ends today. You are going to sit down, set your tasks, and complete them. No excuses. Move.",
  },
  {
    key: "champion",
    label: "Champion",
    description: "Celebratory hype voice for when you've crushed your goals",
    condition: "You completed every task today — you earned this",
    voiceDesignPrompt:
      "An energetic, enthusiastic sports announcer in his 30s with a big, warm American voice. He sounds like he's announcing a championship victory — genuinely excited, celebratory, and contagiously positive.",
    sampleText:
      "THAT is what I'm talking about! Every. Single. Task. Done. You absolutely crushed it today. This is what consistency looks like — remember this feeling!",
  },
];

export interface PatternData {
  missedDaysLast7: number;
  currentStreak: number;
  todayCompleted: number;
  todayTotal: number;
  isEvening: boolean;
}

/**
 * Select which voice persona to use based on user patterns.
 * Priority: champion > sunny > coach > commander
 */
export function selectVoicePersona(data: PatternData): { key: string; reason: string } {
  const { missedDaysLast7, currentStreak, todayCompleted, todayTotal, isEvening } = data;

  // Champion: evening check-in AND completed all tasks (at least 1)
  if (isEvening && todayTotal > 0 && todayCompleted === todayTotal) {
    return { key: "champion", reason: "You completed every task today!" };
  }

  // Sunny: on a streak of 2+ days and not too many missed days
  if (currentStreak >= 2 && missedDaysLast7 <= 1) {
    return { key: "sunny", reason: `You're on a ${currentStreak}-day streak!` };
  }

  // Commander: missed 3+ days in last 7
  if (missedDaysLast7 >= 3) {
    return {
      key: "commander",
      reason: `You've missed ${missedDaysLast7} days this week — accountability time.`,
    };
  }

  // Coach: missed 1-2 days
  if (missedDaysLast7 >= 1) {
    return {
      key: "coach",
      reason: `You missed ${missedDaysLast7} day${missedDaysLast7 > 1 ? "s" : ""} recently — let's refocus.`,
    };
  }

  // Default to sunny (new user or perfect record)
  return { key: "sunny", reason: "Welcome to DayCoach — let's build great habits!" };
}

/**
 * Generate a morning briefing script for the user.
 */
export function generateMorningScript(
  personaKey: string,
  currentStreak: number,
  missedDaysLast7: number,
): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  switch (personaKey) {
    case "champion":
      return `Good morning! It is ${today}. You've been on fire lately — absolutely crushing it. Let's keep that energy going. Add your tasks for today, and let's make it another perfect day.`;

    case "sunny":
      if (currentStreak > 0) {
        return `Good morning! Happy ${today}. You've shown up ${currentStreak} day${currentStreak > 1 ? "s" : ""} in a row — that kind of consistency is how big things get done. I'm proud of you. Now let's set some intentions for today. What are we working on?`;
      }
      return `Good morning and welcome! Today is ${today}. I'm so glad you're here. The best time to build a great habit is right now. Let's set your first tasks and get this day started on a strong note.`;

    case "coach":
      return `Good morning. ${today}. You missed a day — that happens. What matters is that you're here now. No time to dwell on it. Set your tasks, commit to them, and let's get to work.`;

    case "commander":
      return `Morning. ${today}. You've been absent ${missedDaysLast7} day${missedDaysLast7 > 1 ? "s" : ""} this week. I don't want to hear why. I want to see what you do today. Set your tasks. Make them count. That's an order.`;

    default:
      return `Good morning! Today is ${today}. Let's set your tasks and make it a productive day.`;
  }
}

/**
 * Generate an evening recap script.
 */
export function generateEveningScript(
  personaKey: string,
  completedTasks: number,
  totalTasks: number,
  taskTexts: string[],
): string {
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const pendingCount = totalTasks - completedTasks;

  if (totalTasks === 0) {
    switch (personaKey) {
      case "coach":
      case "commander":
        return `End of day check-in. You didn't set any tasks today. That's a problem. Tomorrow, start your morning by setting at least three things you want to accomplish. Don't let another day go by without intention.`;
      default:
        return `Hey! It's the end of the day. You didn't set any tasks today — that's okay, everyone has off days. Tomorrow morning, try setting even just two or three goals. Small steps add up. See you then!`;
    }
  }

  const doneList =
    taskTexts.length > 0
      ? `You completed: ${taskTexts.slice(0, 3).join(", ")}${taskTexts.length > 3 ? ", and more" : ""}.`
      : "";

  switch (personaKey) {
    case "champion":
      return `INCREDIBLE! You finished the day with a perfect score — ${completedTasks} out of ${totalTasks} tasks done! ${doneList} That is what a champion looks like. Go rest, you earned it. See you tomorrow for more.`;

    case "sunny":
      if (completionRate === 1) {
        return `What a day! You completed all ${totalTasks} of your tasks. ${doneList} I knew you could do it. That feeling you have right now? That's what consistency feels like. See you bright and early tomorrow!`;
      } else if (completionRate >= 0.5) {
        return `Good effort today! You finished ${completedTasks} out of ${totalTasks} tasks. ${doneList} You made solid progress. ${pendingCount} task${pendingCount > 1 ? "s" : ""} didn't get done — and that's okay. Tomorrow is a fresh start. Rest up!`;
      } else {
        return `Hey, today was a tough one — only ${completedTasks} out of ${totalTasks} tasks completed. That's alright. What matters is you're still here, checking in. Tomorrow, let's start fresh. Maybe set fewer, more focused tasks. You've got this.`;
      }

    case "coach":
      if (completionRate === 1) {
        return `${completedTasks} for ${totalTasks}. Good. ${doneList} That's what I'm looking for. Consistent execution. Tomorrow, raise the bar a little. I'll be here.`;
      } else if (completionRate >= 0.5) {
        return `${completedTasks} done, ${pendingCount} left behind. ${doneList} You got over halfway — that's something, but it's not enough. Figure out what slowed you down. Come back tomorrow ready to fix it.`;
      } else {
        return `${completedTasks} out of ${totalTasks}. Not acceptable. ${doneList} You need to figure out what's getting in the way. Tomorrow, I want to see better. Set realistic goals and actually chase them.`;
      }

    case "commander":
      if (completionRate === 1) {
        return `${completedTasks} tasks. All of them. Done. ${doneList} Now THAT is what I expect. Every day, this standard. No excuses, no shortcuts. Report back tomorrow.`;
      } else if (completionRate >= 0.5) {
        return `${completedTasks} out of ${totalTasks}. You left ${pendingCount} on the table. ${doneList} Half measures win half battles. Tomorrow — no slacking. Complete what you start.`;
      } else {
        return `${completedTasks} out of ${totalTasks}. That is not a number I'm proud of. ${doneList} This stops now. Tomorrow you will set your tasks and you will complete them. Is that understood?`;
      }

    default:
      return `Day's done! You completed ${completedTasks} out of ${totalTasks} tasks. ${doneList} See you tomorrow!`;
  }
}

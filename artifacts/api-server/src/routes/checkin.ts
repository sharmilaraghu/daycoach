import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, checkinsTable, voicePersonasTable, dailySummariesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createVoicePreviews,
  saveVoiceFromPreview,
  generateSpeech,
  isElevenLabsConfigured,
} from "../lib/elevenlabs";
import {
  PERSONA_DEFINITIONS,
  selectVoicePersona,
  generateMorningScript,
  generateEveningScript,
} from "../lib/voicePersonaSelector";
import { storeAudio } from "../lib/audioStore";
import { logger } from "../lib/logger";

const router = Router();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ensure all voice personas exist in the DB and have ElevenLabs voice IDs.
 * Creates voices via Voice Design API if missing.
 */
async function ensureVoicePersonas(): Promise<Map<string, string>> {
  const voiceMap = new Map<string, string>();

  for (const def of PERSONA_DEFINITIONS) {
    const existing = await db
      .select()
      .from(voicePersonasTable)
      .where(eq(voicePersonasTable.key, def.key))
      .limit(1);

    if (existing.length > 0 && existing[0].elevenLabsVoiceId) {
      voiceMap.set(def.key, existing[0].elevenLabsVoiceId);
      continue;
    }

    // Upsert base record
    if (existing.length === 0) {
      await db.insert(voicePersonasTable).values({
        key: def.key,
        label: def.label,
        description: def.description,
        condition: def.condition,
        elevenLabsVoiceId: null,
      });
    }

    if (!isElevenLabsConfigured()) {
      logger.warn({ key: def.key }, "ElevenLabs not configured, skipping voice creation");
      continue;
    }

    try {
      logger.info({ key: def.key }, "Creating ElevenLabs voice via Voice Design API");
      const previews = await createVoicePreviews(def.voiceDesignPrompt, def.sampleText);
      if (previews.length === 0) throw new Error("No previews returned");
      const preview = previews[0];
      const voiceId = await saveVoiceFromPreview(
        `DayCoach - ${def.label}`,
        def.voiceDesignPrompt,
        preview.generated_voice_id,
      );
      await db
        .update(voicePersonasTable)
        .set({ elevenLabsVoiceId: voiceId })
        .where(eq(voicePersonasTable.key, def.key));
      voiceMap.set(def.key, voiceId);
      logger.info({ key: def.key, voiceId }, "Voice created and saved");
    } catch (err) {
      logger.error({ err, key: def.key }, "Failed to create ElevenLabs voice");
    }
  }

  return voiceMap;
}

/**
 * Get user patterns for persona selection.
 */
async function getUserPatternData(isEvening: boolean) {
  const today = todayDate();
  const todayTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.date, today));
  const todayCompleted = todayTasks.filter((t) => t.completed).length;
  const todayTotal = todayTasks.length;

  // Get last 7 days summaries
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    return d.toISOString().slice(0, 10);
  });

  let missedDaysLast7 = 0;
  let currentStreak = 0;

  for (const date of last7Dates) {
    const dayTasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.date, date));
    const dayCompleted = dayTasks.filter((t) => t.completed).length;
    if (dayTasks.length === 0 || dayCompleted === 0) {
      missedDaysLast7++;
      if (currentStreak === 0) {
        // streak broken
      }
    } else if (currentStreak === last7Dates.indexOf(date)) {
      currentStreak++;
    }
  }

  // Recalculate streak properly
  currentStreak = 0;
  for (const date of last7Dates) {
    const dayTasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.date, date));
    const dayCompleted = dayTasks.filter((t) => t.completed).length;
    if (dayCompleted > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { missedDaysLast7, currentStreak, todayCompleted, todayTotal, isEvening };
}

// POST /api/checkin/morning
router.post("/checkin/morning", async (req, res) => {
  try {
    const patternData = await getUserPatternData(false);
    const { key: personaKey, reason } = selectVoicePersona(patternData);

    const persona = PERSONA_DEFINITIONS.find((p) => p.key === personaKey)!;
    const script = generateMorningScript(
      personaKey,
      patternData.currentStreak,
      patternData.missedDaysLast7,
    );

    // Get or create voice IDs
    const voiceMap = await ensureVoicePersonas();
    const voiceId = voiceMap.get(personaKey);

    let audioUrl = "";
    if (voiceId && isElevenLabsConfigured()) {
      const audioBuffer = await generateSpeech(voiceId, script);
      const audioId = storeAudio(audioBuffer);
      audioUrl = `/api/audio/${audioId}`;
    } else {
      audioUrl = "";
    }

    // Save checkin record
    const today = todayDate();
    await db.insert(checkinsTable).values({
      date: today,
      type: "morning",
      script,
      voicePersonaKey: personaKey,
    });

    // Update daily summary
    const todayTasks = await db.select().from(tasksTable).where(eq(tasksTable.date, today));
    await db
      .insert(dailySummariesTable)
      .values({
        date: today,
        totalTasks: todayTasks.length,
        completedTasks: todayTasks.filter((t) => t.completed).length,
        completionRate:
          todayTasks.length > 0
            ? todayTasks.filter((t) => t.completed).length / todayTasks.length
            : 0,
        voicePersonaUsed: personaKey,
        hadCheckin: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dailySummariesTable.date,
        set: {
          voicePersonaUsed: personaKey,
          hadCheckin: true,
          updatedAt: new Date(),
        },
      });

    res.json({
      script,
      audioUrl,
      voicePersona: personaKey,
      voicePersonaLabel: persona.label,
    });
  } catch (err) {
    req.log.error({ err }, "Morning checkin failed");
    res.status(500).json({ error: "Checkin failed" });
  }
});

// POST /api/checkin/evening
router.post("/checkin/evening", async (req, res) => {
  try {
    const today = todayDate();
    const todayTasks = await db.select().from(tasksTable).where(eq(tasksTable.date, today));
    const completedTasks = todayTasks.filter((t) => t.completed);
    const patternData = await getUserPatternData(true);
    const { key: personaKey } = selectVoicePersona(patternData);

    const persona = PERSONA_DEFINITIONS.find((p) => p.key === personaKey)!;
    const script = generateEveningScript(
      personaKey,
      completedTasks.length,
      todayTasks.length,
      completedTasks.map((t) => t.text),
    );

    const voiceMap = await ensureVoicePersonas();
    const voiceId = voiceMap.get(personaKey);

    let audioUrl = "";
    if (voiceId && isElevenLabsConfigured()) {
      const audioBuffer = await generateSpeech(voiceId, script);
      const audioId = storeAudio(audioBuffer);
      audioUrl = `/api/audio/${audioId}`;
    }

    await db.insert(checkinsTable).values({
      date: today,
      type: "evening",
      script,
      voicePersonaKey: personaKey,
    });

    const completionRate =
      todayTasks.length > 0 ? completedTasks.length / todayTasks.length : 0;

    await db
      .insert(dailySummariesTable)
      .values({
        date: today,
        totalTasks: todayTasks.length,
        completedTasks: completedTasks.length,
        completionRate,
        voicePersonaUsed: personaKey,
        hadCheckin: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dailySummariesTable.date,
        set: {
          totalTasks: todayTasks.length,
          completedTasks: completedTasks.length,
          completionRate,
          hadCheckin: true,
          updatedAt: new Date(),
        },
      });

    res.json({
      script,
      audioUrl,
      voicePersona: personaKey,
      voicePersonaLabel: persona.label,
    });
  } catch (err) {
    req.log.error({ err }, "Evening checkin failed");
    res.status(500).json({ error: "Checkin failed" });
  }
});

export default router;

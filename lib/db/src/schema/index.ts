import { pgTable, serial, text, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  completed: boolean("completed").notNull().default(false),
  category: text("category").notNull().default("work"), // 'health' | 'work' | 'learning' | 'mindset'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const checkinsTable = pgTable("checkins", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  type: text("type").notNull(), // 'morning' | 'evening'
  script: text("script").notNull(),
  voicePersonaKey: text("voice_persona_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true, createdAt: true });
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkinsTable.$inferSelect;

export const voicePersonasTable = pgTable("voice_personas", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  condition: text("condition").notNull(),
  elevenLabsVoiceId: text("elevenlabs_voice_id"),
  elevenLabsAgentId: text("elevenlabs_agent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoicePersonaSchema = createInsertSchema(voicePersonasTable).omit({ id: true, createdAt: true });
export type InsertVoicePersona = z.infer<typeof insertVoicePersonaSchema>;
export type VoicePersona = typeof voicePersonasTable.$inferSelect;

export const dailySummariesTable = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // YYYY-MM-DD
  totalTasks: integer("total_tasks").notNull().default(0),
  completedTasks: integer("completed_tasks").notNull().default(0),
  completionRate: real("completion_rate").notNull().default(0),
  voicePersonaUsed: text("voice_persona_used").notNull().default("sunny"),
  hadCheckin: boolean("had_checkin").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailySummarySchema = createInsertSchema(dailySummariesTable).omit({ id: true });
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type DailySummary = typeof dailySummariesTable.$inferSelect;

export const conversationLogsTable = pgTable("conversation_logs", {
  id: serial("id").primaryKey(),
  voicePersona: text("voice_persona").notNull(),
  voicePersonaLabel: text("voice_persona_label").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").defaultNow().notNull(),
  durationSeconds: integer("duration_seconds"),
  disconnectReason: text("disconnect_reason"),
  mode: text("mode").default("checkin"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationLogSchema = createInsertSchema(conversationLogsTable).omit({ id: true, createdAt: true });
export type InsertConversationLog = z.infer<typeof insertConversationLogSchema>;
export type ConversationLog = typeof conversationLogsTable.$inferSelect;

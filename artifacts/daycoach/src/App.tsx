import { useState, useEffect, useRef, useCallback } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Home as HomeIcon,
  History as HistoryIcon,
  Mic2,
  User,
  Loader2,
  Check,
  Trash2,
  Pencil,
  Plus,
  Sparkles,
  PhoneOff,
  Lightbulb,
  X,
  ClipboardList,
  Heart,
  Briefcase,
  BookOpen,
  Brain,
  FlaskConical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isAfter, setHours, setMinutes, isToday, parseISO } from "date-fns";
import { useConversation, type SessionConfig } from "@11labs/react";

import {
  useGetTodayTasks,
  useCreateTask,
  useCompleteTask,
  useDeleteTask,
  useGetPatterns,
  useGetHistory,
  useGetVoicePersonas,
  useValidateTask,
  useGetAgentSession,
  useLogConversationEnd,
  useToggleDemoMode,
  useUpdateTask,
  useCloseTodaySummary,
  getGetTodayTasksQueryKey,
  getGetPatternsQueryKey,
  getGetHistoryQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  health: {
    icon: Heart,
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    borderColor: "border-rose-400/20",
  },
  work: {
    icon: Briefcase,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
  },
  learning: {
    icon: BookOpen,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
  },
  mindset: {
    icon: Brain,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
};

// ─── ConversationOverlay ──────────────────────────────────────────────────────

function ConversationOverlay({
  personaLabel,
  mode,
  status,
  isSpeaking,
  onEnd,
}: {
  personaLabel: string;
  mode: "checkin" | "review";
  status: string;
  isSpeaking: boolean;
  onEnd: () => void;
}) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const modeLabel = mode === "review" ? "Task Review" : "Live Conversation";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/97 backdrop-blur-md"
    >
      <div className="flex flex-col items-center gap-10 w-full max-w-sm px-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-medium tracking-widest uppercase text-primary">{modeLabel}</p>
          <h2 className="text-2xl font-semibold">{personaLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {isConnecting ? "Connecting…" : isSpeaking ? "Speaking" : isConnected ? "Listening" : ""}
          </p>
        </div>

        <div className="relative flex items-center justify-center w-36 h-36">
          {isConnecting && (
            <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          )}

          {isConnected && !isSpeaking && (
            <>
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-primary/20"
                  style={{ width: 56 + i * 24, height: 56 + i * 24 }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
              <div className="relative z-10 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <Mic2 className="w-6 h-6 text-primary-foreground" />
              </div>
            </>
          )}

          {isConnected && isSpeaking && (
            <div className="flex items-center gap-1.5">
              {[0.4, 0.8, 1.2, 0.9, 0.5, 0.7, 1.1].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-primary"
                  animate={{ height: [`${h * 16}px`, `${h * 48}px`, `${h * 16}px`] }}
                  transition={{ duration: 0.5 + h * 0.3, repeat: Infinity, delay: i * 0.07 }}
                />
              ))}
            </div>
          )}
        </div>

        {mode === "review" && isConnected && (
          <p className="text-xs text-center text-muted-foreground px-4">
            Your coach can mark tasks complete and add new ones as you talk.
          </p>
        )}

        <Button
          variant="outline"
          size="lg"
          className="rounded-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onEnd}
          data-testid="button-end-conversation"
        >
          <PhoneOff className="w-4 h-4" />
          End Conversation
        </Button>
      </div>
    </motion.div>
  );
}

// ─── VagueSuggestion ─────────────────────────────────────────────────────────

function VagueSuggestion({
  suggestion,
  audioUrl,
  onSaveOriginal,
  onDismiss,
}: {
  suggestion: string;
  audioUrl: string | null;
  onSaveOriginal: () => void;
  onDismiss: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play().catch(() => {});
    }
    return () => { audioRef.current?.pause(); };
  }, [audioUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 p-3 rounded-xl bg-primary/8 border border-primary/20 space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/90 leading-snug">{suggestion}</p>
          <button onClick={onDismiss} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-2 pl-6">
          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={onDismiss}>
            Edit
          </Button>
          <Button size="sm" className="h-7 text-xs rounded-lg" onClick={onSaveOriginal}>
            Save anyway
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center h-14 px-6 gap-1">
          {[
            { href: "/", icon: HomeIcon, label: "Today", id: "home" },
            { href: "/history", icon: HistoryIcon, label: "History", id: "history" },
            { href: "/voices", icon: Mic2, label: "Guide", id: "voices" },
          ].map(({ href, icon: Icon, label, id }) => (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto w-full py-8 px-6">{children}</main>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home() {
  const { data: tasks, isLoading: tasksLoading } = useGetTodayTasks();
  const { data: patterns, isLoading: patternsLoading } = useGetPatterns();

  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const validateTask = useValidateTask();
  const getAgentSession = useGetAgentSession();
  const logConversationEnd = useLogConversationEnd();
  const closeTodaySummary = useCloseTodaySummary();
  const toggleDemoMode = useToggleDemoMode();

  const { toast } = useToast();

  const [vagueSuggestion, setVagueSuggestion] = useState<{
    suggestion: string;
    audioUrl: string | null;
    pendingText: string;
  } | null>(null);

  const [convActive, setConvActive] = useState(false);
  const [convMode, setConvMode] = useState<"checkin" | "review">("checkin");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const convStartedAt = useRef<Date | null>(null);
  const convPersonaRef = useRef<{ persona: string; personaLabel: string; mode: string } | null>(null);

  const invalidateTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetTodayTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPatternsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
  }, []);

  const conversation = useConversation({
    clientTools: {
      complete_task: async (params: { task_id: number }) => {
        const taskId = Number(params.task_id);
        const task = tasks?.find((t) => t.id === taskId);
        return new Promise<string>((resolve) => {
          completeTask.mutate(
            { id: taskId, data: { completed: true } },
            {
              onSuccess: () => {
                invalidateTasks();
                toast({
                  title: "Task completed!",
                  description: task ? `"${task.text}" marked as done.` : "Task marked as done.",
                });
                resolve("Task marked as complete.");
              },
              onError: () => resolve("Could not mark task complete — please try manually."),
            },
          );
        });
      },
      add_task: async (params: { text: string }) => {
        return new Promise<string>((resolve) => {
          createTask.mutate(
            { data: { text: params.text } },
            {
              onSuccess: () => {
                invalidateTasks();
                toast({ title: "Task added!", description: `"${params.text}" added to today.` });
                resolve("Task added successfully.");
              },
              onError: () => resolve("Could not add task — please try manually."),
            },
          );
        });
      },
      delete_task: async (params: { task_id: number }) => {
        const taskId = Number(params.task_id);
        const task = tasks?.find((t) => t.id === taskId);
        return new Promise<string>((resolve) => {
          deleteTask.mutate(
            { id: taskId },
            {
              onSuccess: () => {
                invalidateTasks();
                toast({
                  title: "Task removed",
                  description: task ? `"${task.text}" deleted.` : "Task deleted.",
                });
                resolve("Task deleted.");
              },
              onError: () => resolve("Could not delete task — please try manually."),
            },
          );
        });
      },
      update_task: async (params: { task_id: number; text: string }) => {
        const taskId = Number(params.task_id);
        return new Promise<string>((resolve) => {
          updateTask.mutate(
            { id: taskId, data: { text: params.text } },
            {
              onSuccess: () => {
                invalidateTasks();
                toast({ title: "Task updated", description: `Updated to "${params.text}".` });
                resolve("Task updated.");
              },
              onError: () => resolve("Could not update task — please try manually."),
            },
          );
        });
      },
    },
    onConnect: () => {},
    onDisconnect: (details) => {
      setConvActive(false);
      const started = convStartedAt.current;
      const persona = convPersonaRef.current;
      if (started && persona) {
        const durationSeconds = Math.round((Date.now() - started.getTime()) / 1000);
        logConversationEnd.mutate({
          data: {
            voicePersona: persona.persona,
            voicePersonaLabel: persona.personaLabel,
            startedAt: started.toISOString(),
            durationSeconds,
            disconnectReason: details?.reason ?? null,
            mode: persona.mode as "checkin" | "review",
          },
        });
        if (persona.mode === "review") {
          const total = patterns?.todayTotal ?? 0;
          const completed = patterns?.todayCompleted ?? 0;
          const rate = total > 0 ? completed / total : 0;
          const overallStatus = rate >= 0.8 ? "great" : rate >= 0.4 ? "partial" : "missed";
          const summaryText = `Completed ${completed} of ${total} tasks today (${Math.round(rate * 100)}%).`;
          closeTodaySummary.mutate({
            data: { summaryText, overallStatus, closureSource: "voice_agent" },
          });
        }
      }
      convStartedAt.current = null;
      convPersonaRef.current = null;
      invalidateTasks();
    },
    onError: (err) => {
      console.error("Conversation error", err);
      toast({ title: "Voice connection failed", variant: "destructive" });
      setConvActive(false);
    },
  });

  const formSchema = z.object({ text: z.string().min(1).max(500) });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { text: "" },
  });

  const doCreateTask = useCallback((text: string) => {
    createTask.mutate({ data: { text } }, {
      onSuccess: () => {
        form.reset();
        setVagueSuggestion(null);
        invalidateTasks();
      },
      onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
    });
  }, [createTask, form, toast, invalidateTasks]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    validateTask.mutate({ data: { text: values.text } }, {
      onSuccess: (result) => {
        if (result.isVague && result.suggestion) {
          setVagueSuggestion({
            suggestion: result.suggestion,
            audioUrl: result.audioUrl ?? null,
            pendingText: values.text,
          });
        } else {
          doCreateTask(values.text);
        }
      },
      onError: () => doCreateTask(values.text),
    });
  };

  const handleToggleTask = (id: number, completed: boolean) => {
    completeTask.mutate({ id, data: { completed: !completed } }, {
      onSuccess: () => invalidateTasks(),
    });
  };

  const handleDeleteTask = (id: number) => {
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatternsQueryKey() });
      },
    });
  };

  const handleEditSave = (id: number) => {
    const trimmed = editingText.trim();
    if (trimmed && trimmed !== tasks?.find((t) => t.id === id)?.text) {
      updateTask.mutate({ id, data: { text: trimmed } }, {
        onSuccess: () => invalidateTasks(),
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      });
    }
    setEditingTaskId(null);
  };

  const now = new Date();
  const isEvening = isAfter(now, setMinutes(setHours(now, 17), 0));

  const handleDemoToggle = () => {
    toggleDemoMode.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPatternsQueryKey() });
      },
    });
  };

  async function startConversation(mode: "checkin" | "review") {
    if (conversation.status === "connecting" || conversation.status === "connected") return;
    if (!patterns) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({
        title: "Microphone access required",
        description: "Please allow microphone access to talk to your coach.",
        variant: "destructive",
      });
      return;
    }

    const structuredTasks = tasks?.map((t) => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      category: (t as { category?: string }).category ?? null,
    })) ?? [];

    getAgentSession.mutate(
      {
        data: {
          currentStreak: patterns.currentStreak,
          todayCompleted: patterns.todayCompleted,
          todayTotal: patterns.todayTotal,
          missedDaysLast7: patterns.missedDaysLast7,
          activeVoicePersona: patterns.activeVoicePersona,
          activeVoicePersonaLabel: patterns.activeVoicePersonaLabel,
          taskTexts: tasks?.map((t) => t.text) ?? [],
          tasks: structuredTasks,
          isEvening,
          mode,
        },
      },
      {
        onSuccess: async (session) => {
          if (!session.available || !session.agentId) {
            toast({
              title: "Coach unavailable",
              description: "Could not connect to voice coach right now.",
              variant: "destructive",
            });
            return;
          }
          setConvActive(true);
          setConvMode(mode);
          convStartedAt.current = new Date();
          convPersonaRef.current = {
            persona: session.voicePersona,
            personaLabel: session.voicePersonaLabel,
            mode,
          };
          try {
            const agentOverrides = {
              agent: {
                ...(session.systemPrompt ? { prompt: { prompt: session.systemPrompt } } : {}),
                ...(session.firstMessage ? { firstMessage: session.firstMessage } : {}),
              },
            };
            const sessionOptions: SessionConfig = session.signedUrl
              ? { signedUrl: session.signedUrl, overrides: agentOverrides }
              : { agentId: session.agentId!, connectionType: "websocket", overrides: agentOverrides };
            await conversation.startSession(sessionOptions);
          } catch (err) {
            console.error(err);
            setConvActive(false);
            convStartedAt.current = null;
            convPersonaRef.current = null;
            toast({ title: "Failed to start conversation", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Failed to connect to coach", variant: "destructive" }),
      },
    );
  }

  const handleCheckin = () => startConversation("checkin");
  const handleReview = () => startConversation("review");

  const handleEndConversation = async () => {
    try { await conversation.endSession(); } catch {}
    setConvActive(false);
  };

  const isCheckinPending = getAgentSession.isPending;
  const taskCount = tasks?.length ?? 0;

  if (tasksLoading || patternsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const completionPercent = patterns?.todayTotal
    ? Math.round((patterns.todayCompleted / patterns.todayTotal) * 100)
    : 0;

  return (
    <div className="space-y-7">
      <AnimatePresence>
        {convActive && (
          <ConversationOverlay
            personaLabel={patterns?.activeVoicePersonaLabel ?? "Coach"}
            mode={convMode}
            status={conversation.status}
            isSpeaking={conversation.isSpeaking}
            onEnd={handleEndConversation}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {isEvening ? "Good evening" : "Good morning"}.
        </h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          {format(now, "EEEE, MMMM d")}
          {patterns?.currentStreak !== undefined && patterns.currentStreak > 0 && (
            <span className="flex items-center text-primary text-xs font-medium bg-primary/10 px-2 py-0.5 rounded-full">
              <Sparkles size={10} className="mr-1" />
              {patterns.currentStreak} day streak
            </span>
          )}
        </p>
      </header>

      {/* Coach Card */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Your coach today</p>
              <p className="text-lg font-semibold">{patterns?.activeVoicePersonaLabel ?? "—"}</p>
              {patterns?.activeVoicePersonaReason && (
                <p className="text-xs text-muted-foreground mt-0.5">{(patterns as { activeVoicePersonaReason?: string }).activeVoicePersonaReason}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleCheckin}
              disabled={isCheckinPending || !patterns}
              className="w-full rounded-xl h-11 text-sm font-medium gap-1.5"
              data-testid={`button-checkin-${isEvening ? "evening" : "morning"}`}
            >
              {isCheckinPending && convMode === "checkin" ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <Mic2 className="w-4 h-4" />
                  {isEvening ? "End My Day" : "Start My Day"}
                </>
              )}
            </Button>

            {taskCount >= 2 && (
              <Button
                onClick={handleReview}
                disabled={isCheckinPending || !patterns}
                variant="outline"
                className="w-full rounded-xl h-9 text-xs font-medium gap-1.5"
                data-testid="button-review-tasks"
              >
                {isCheckinPending && convMode === "review" ? (
                  <Loader2 className="animate-spin w-3.5 h-3.5" />
                ) : (
                  <>
                    <ClipboardList className="w-3.5 h-3.5" />
                    Review Tasks with Coach
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Streaks — compact row */}
      {patterns?.categoryStreaks && patterns.categoryStreaks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {patterns.categoryStreaks.map((cs) => {
            const cfg = CATEGORY_CONFIG[cs.category] ?? {
              icon: Sparkles,
              color: "text-primary",
              bgColor: "bg-primary/10",
              borderColor: "border-primary/20",
            };
            const Icon = cfg.icon;
            return (
              <div
                key={cs.category}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${cfg.bgColor} ${cfg.borderColor}`}
                data-testid={`category-streak-${cs.category}`}
                title={cs.insight}
              >
                <Icon className={`w-3 h-3 ${cfg.color}`} />
                <span className={cfg.color}>{cs.label}</span>
                <span className="text-muted-foreground font-normal">{cs.streak}d</span>
              </div>
            );
          })}
        </div>
      )}


      {/* Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Today's Commitments</h2>
          {patterns?.todayTotal !== undefined && patterns.todayTotal > 0 && (
            <span className="text-xs text-muted-foreground">
              {patterns.todayCompleted}/{patterns.todayTotal}
            </span>
          )}
        </div>

        {patterns?.todayTotal !== undefined && patterns.todayTotal > 0 && (
          <Progress value={completionPercent} className="h-1" />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="relative flex items-center">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input
                        placeholder="Add a commitment..."
                        className="pr-12 h-11 bg-muted/40 border-transparent rounded-xl focus-visible:ring-primary/50"
                        {...field}
                        disabled={createTask.isPending || validateTask.isPending}
                        data-testid="input-new-task"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 w-9 h-9 rounded-lg"
                disabled={!form.watch("text") || createTask.isPending || validateTask.isPending}
                data-testid="button-add-task"
              >
                {createTask.isPending || validateTask.isPending ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>

            <AnimatePresence>
              {vagueSuggestion && (
                <VagueSuggestion
                  suggestion={vagueSuggestion.suggestion}
                  audioUrl={vagueSuggestion.audioUrl}
                  onSaveOriginal={() => doCreateTask(vagueSuggestion.pendingText)}
                  onDismiss={() => setVagueSuggestion(null)}
                />
              )}
            </AnimatePresence>
          </form>
        </Form>

        <div className="space-y-2">
          {tasks?.length === 0 ? (
            <div className="text-center p-8 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
              No commitments yet. What's one thing you'll do today?
            </div>
          ) : (
            <AnimatePresence>
              {tasks?.map((task) => {
                const taskCategory = ("category" in task && task.category) ? task.category as string : null;
                const catCfg = taskCategory ? (CATEGORY_CONFIG[taskCategory] ?? null) : null;
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
                      task.completed
                        ? "bg-muted/20 border-border/30 opacity-50"
                        : "bg-card border-border"
                    }`}
                    data-testid={`task-item-${task.id}`}
                  >
                    {/* Category dot */}
                    {catCfg && (
                      <div className={`w-2 h-2 rounded-full shrink-0 ${catCfg.color.replace("text-", "bg-").replace("/40","")}`} title={taskCategory ?? ""} />
                    )}

                    <button
                      onClick={() => handleToggleTask(task.id, task.completed)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                      data-testid={`button-toggle-task-${task.id}`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                          task.completed
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-muted-foreground/30"
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            className="text-sm bg-transparent border-b border-primary outline-none w-full"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => handleEditSave(task.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(task.id);
                              if (e.key === "Escape") setEditingTaskId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={`text-sm truncate block ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                            {task.text}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Hover-only actions */}
                    {!task.completed && editingTaskId !== task.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setEditingTaskId(task.id); setEditingText(task.text); }}
                        data-testid={`button-edit-task-${task.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteTask(task.id)}
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

type HistoryDay = {
  date: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  voicePersonaUsed: string;
  hadCheckin: boolean;
  tasks?: { id: number; text: string; completed: boolean; category: string }[];
};

function History() {
  const { data: history, isLoading } = useGetHistory();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-1/3" />
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const days = (history ?? []) as HistoryDay[];

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground text-sm mt-1">Your last 14 days.</p>
      </header>
      <div className="space-y-2">
        {days.map((day) => {
          const date = parseISO(day.date);
          const isTodayDate = isToday(date);
          const percent = day.totalTasks > 0 ? day.completedTasks / day.totalTasks : 0;
          const isOpen = expanded === day.date;
          const hasTasks = (day.tasks?.length ?? 0) > 0;
          return (
            <div
              key={day.date}
              className="rounded-xl bg-card border border-border overflow-hidden"
              data-testid={`history-item-${day.date}`}
            >
              <button
                className="w-full flex items-center gap-4 p-4 text-left"
                onClick={() => hasTasks && setExpanded(isOpen ? null : day.date)}
                disabled={!hasTasks}
              >
                <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-muted/40 shrink-0">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase leading-none">{format(date, "MMM")}</span>
                  <span className="text-base font-bold leading-tight">{format(date, "d")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {isTodayDate ? "Today" : format(date, "EEEE, MMM d")}
                    {day.hadCheckin && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Mic2 className="w-2.5 h-2.5 mr-0.5" />
                        Coached
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {day.totalTasks === 0 ? "No commitments" : `${day.completedTasks} of ${day.totalTasks} done`}
                  </p>
                </div>
                {day.totalTasks > 0 && (
                  <div
                    className="w-10 h-10 rounded-full border-[3px] flex items-center justify-center text-[10px] font-semibold shrink-0"
                    style={{ borderColor: `color-mix(in srgb, hsl(var(--primary)) ${percent * 100}%, hsl(var(--border)))` }}
                  >
                    {Math.round(percent * 100)}%
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isOpen && day.tasks && day.tasks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-0 space-y-1.5 border-t border-border/40">
                      {day.tasks.map((task) => {
                        const catCfg = CATEGORY_CONFIG[task.category] ?? {
                          icon: Sparkles, color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/20",
                        };
                        const CatIcon = catCfg.icon;
                        return (
                          <div key={task.id} className="flex items-center gap-2 py-1">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${task.completed ? "bg-primary text-primary-foreground" : "border border-muted-foreground/30"}`}>
                              {task.completed && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </div>
                            <span className={`text-xs flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
                            <CatIcon className={`w-3 h-3 shrink-0 ${catCfg.color} opacity-60`} />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {days.length === 0 && (
          <div className="text-center p-10 text-muted-foreground text-sm">No history yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── Guide ────────────────────────────────────────────────────────────────────

const PERSONA_META: Record<string, { color: string; trigger: string; tone: string }> = {
  sunny:     { color: "text-amber-400 bg-amber-400/10 border-amber-400/20",   trigger: "Streak of 2+ days",        tone: "Warm & encouraging" },
  coach:     { color: "text-blue-400 bg-blue-400/10 border-blue-400/20",      trigger: "Missed 1–2 days recently", tone: "Calm & direct" },
  commander: { color: "text-red-400 bg-red-400/10 border-red-400/20",         trigger: "Missed 3+ days",           tone: "Strict & no-excuses" },
  champion:  { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", trigger: "Completed every task today", tone: "Celebratory & hype" },
};

const VOICE_COMMANDS = [
  { cmd: '"Mark [task] as done"',            desc: "Checks off a task in real time" },
  { cmd: '"Add: run 5km before 8am"',        desc: "Adds a specific task to today's list" },
  { cmd: '"Remove [task]"',                  desc: "Deletes a task after confirmation" },
  { cmd: '"Update [task] to [new text]"',    desc: "Rewrites a task to be more specific" },
  { cmd: '"What is left for today?"',         desc: "Coach summarises your pending tasks" },
];

function Voices() {
  const { data: voices, isLoading } = useGetVoicePersonas();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-1/3" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Guide</h1>
        <p className="text-muted-foreground text-sm mt-1">How DayCoach works and what to say.</p>
      </header>

      {/* How it works */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">How it works</h2>
        <div className="space-y-2">
          {[
            { step: "1", text: "Tap Start My Day to open a live voice session with your coach. Speak naturally — they can hear you." },
            { step: "2", text: "Your coach adds, edits, or checks off tasks during the conversation. Changes appear in your list in real time." },
            { step: "3", text: "Tap End My Day in the evening to reflect on what you completed. Your coach adapts to how the day went." },
          ].map(({ step, text }) => (
            <div key={step} className="flex gap-3 p-3.5 rounded-xl bg-card border border-border">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coach personas */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your coaches</h2>
        <p className="text-xs text-muted-foreground">DayCoach selects your coach automatically — you don't pick one.</p>
        <div className="space-y-2">
          {voices?.map((voice) => {
            const meta = PERSONA_META[voice.key] ?? { color: "text-primary bg-primary/10 border-primary/20", trigger: "", tone: "" };
            return (
              <div key={voice.key} className="flex items-center gap-4 p-3.5 rounded-xl bg-card border border-border" data-testid={`voice-card-${voice.key}`}>
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Mic2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{voice.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${meta.color}`}>{meta.tone}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Triggered when: {meta.trigger}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Voice commands */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Voice commands</h2>
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {VOICE_COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-start gap-3 px-4 py-3 bg-card">
              <code className="text-xs text-primary font-mono bg-primary/8 px-2 py-0.5 rounded shrink-0">{cmd}</code>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Task categories</h2>
        <p className="text-xs text-muted-foreground">Tasks are automatically tagged based on their content.</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className={`flex items-center gap-2 p-3 rounded-xl border ${cfg.bgColor} ${cfg.borderColor}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-xs font-medium capitalize ${cfg.color}`}>{key}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/history" component={History} />
      <Route path="/voices" component={Voices} />
      <Route component={() => (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <h1 className="text-4xl font-bold">404</h1>
          <Link href="/" className="text-primary hover:underline text-sm">Go home</Link>
        </div>
      )} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Shell>
            <Router />
          </Shell>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Mic,
  PhoneOff,
  Radio,
  RefreshCcw,
  Send,
  Volume2,
  WandSparkles,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";
import {
  type ConversationTurn,
  type RealtimeState,
  useLearnRealtimeConversation,
} from "@/features/learn/use-learn-realtime-conversation";
import { cn } from "@/lib/utils";

type Review = {
  status: "ready" | "almost_there" | "practice_once_more";
  score: number;
  strength: string;
  improvement: string;
  pronunciationNote: string | null;
  evidenceSummary: {
    observed: string[];
    missing: string[];
    nextFocus: string;
    benchmarkFocus: string | null;
    followUpResponsesObserved: number;
    followUpResponsesRequired: number;
  };
  highlights: Array<{
    turnIndex: number;
    youSaid: string;
    tryInstead: string;
    why: string;
  }>;
  turns: Array<{
    turnIndex: number;
    speaker: "ai" | "student";
    text: string;
    inlineCorrections: Array<{
      span: string;
      suggestion: string;
      reason: string;
    }>;
  }>;
  vocabulary: Array<{
    term: string;
    definition: string;
    translation: string;
  }>;
};

type SessionView = {
  id: string;
  status: string;
  interactionMode: "text" | "voice";
  deliveryMode?: "text_chat" | "realtime_voice";
  retryOfSessionId?: string | null;
  turns: Array<{
    turnIndex: number;
    speaker: "ai" | "student";
    text: string;
    coaching?: ConversationTurn["coaching"];
    disposition?: ConversationTurn["disposition"];
    countsTowardProgress?: boolean;
    reasonCode?: ConversationTurn["reasonCode"];
  }>;
  review?: Review | null;
};

type StartMissionResponse = {
  sessionId: string;
  deliveryMode: "text_chat" | "realtime_voice";
  openingTurn: string;
  resumeState: {
    turns: ConversationTurn[];
  };
};

type LearnSpeakingMissionProps = {
  unitSlug: string;
  unitTitle: string;
  unitOrder: number;
  canDoStatement: string;
  performanceTask: string;
  mission: {
    scenarioTitle: string;
    scenarioSetup: string;
    counterpartRole: string;
    openingQuestion: string;
    warmupPrompts: string[];
    targetPhrases: string[];
    followUpPrompts: string[];
    successCriteria: string[];
    modelExample: string;
    isBenchmark: boolean;
    requiredTurns: number;
    minimumFollowUpResponses: number;
    benchmarkFocus: string[];
  };
  plan: "free" | "pro";
  voiceEnabled: boolean;
  progressStatus: "locked" | "unlocked" | "completed";
  initialSession: SessionView | null;
  savedReview: Review | null;
  completionEndpoint: string;
  fallbackHref?: string;
};

function statusLabel(status: Review["status"]) {
  if (status === "ready") return "Ready";
  if (status === "almost_there") return "Almost there";
  return "Practice once more";
}

function statusDescription(status: Review["status"]) {
  if (status === "ready") return "You completed the mission clearly enough to move on.";
  if (status === "almost_there") {
    return "You can continue now, but one more clean pass would make the language feel stronger.";
  }

  return "A quick retry is the best next move before you continue to writing.";
}

function reviewToneClasses(status: Review["status"]) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50/80 text-emerald-900";
  if (status === "almost_there") return "border-amber-200 bg-amber-50/80 text-amber-900";
  return "border-primary/15 bg-primary/5 text-foreground";
}

function normalizePhrase(value: string) {
  return value.trim().toLowerCase();
}

function countSubstantiveFollowUpResponses(turns: ConversationTurn[]) {
  return turns
    .filter((turn) => turn.speaker === "student" && turn.countsTowardProgress !== false)
    .slice(1)
    .filter((turn) => turn.text.trim().split(/\s+/).filter(Boolean).length >= 5).length;
}

function getCounterpartLabel(counterpartRole: string) {
  switch (counterpartRole) {
    case "teacher":
      return "Teacher";
    case "classmate":
      return "Classmate";
    case "interviewer":
      return "Interviewer";
    case "customer":
      return "Customer";
    case "cashier":
      return "Cashier";
    case "staff_member":
      return "Staff";
    case "manager":
      return "Manager";
    case "audience_member":
      return "Audience";
    default:
      return "Partner";
  }
}

function getRealtimeStateCopy(state: RealtimeState) {
  switch (state) {
    case "connecting":
      return "Connecting";
    case "ready":
      return "Live now";
    case "listening":
      return "Listening";
    case "still_listening":
      return "Still listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "didnt_catch_that":
      return "Didn't catch that";
    case "noisy_room":
      return "Noisy room";
    case "error":
      return "Connection issue";
    default:
      return "Ready";
  }
}

function getStatusCue({
  canFinish,
  studentTurnCount,
  isVoiceSession,
  textFallbackEnabled,
  realtimeState,
}: {
  canFinish: boolean;
  studentTurnCount: number;
  isVoiceSession: boolean;
  textFallbackEnabled: boolean;
  realtimeState: RealtimeState;
}) {
  if (canFinish) return "Ready for feedback";
  if (isVoiceSession && !textFallbackEnabled) {
    if (realtimeState === "connecting") return "Connecting";
    if (realtimeState === "listening") return "Listening";
    if (realtimeState === "still_listening") return "Still listening";
    if (realtimeState === "thinking") return "Thinking";
    if (realtimeState === "speaking") return "Speaking";
    if (realtimeState === "didnt_catch_that") return "Didn't catch that";
    if (realtimeState === "noisy_room") return "Noisy room";
  }
  if (studentTurnCount === 0) return "Start with one clear idea";
  if (studentTurnCount === 1) return "Keep going";
  return "One more thought";
}

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function LearnSpeakingMission({
  unitSlug,
  unitTitle,
  unitOrder,
  canDoStatement,
  mission,
  plan,
  voiceEnabled,
  progressStatus,
  initialSession,
  savedReview,
  completionEndpoint,
  fallbackHref = "/app/learn",
}: LearnSpeakingMissionProps) {
  const defaultStartMode = plan === "pro" && voiceEnabled ? "voice" : "text";
  const initialReview = savedReview ?? initialSession?.review ?? null;
  const initialPhase: "brief" | "conversation" | "feedback" =
    progressStatus === "completed" && initialReview
      ? "feedback"
      : initialSession?.status === "active"
        ? "conversation"
        : initialSession?.status === "completed" && initialReview
          ? "feedback"
          : "brief";
  const initialDeliveryMode =
    initialSession?.deliveryMode ??
    (initialSession?.interactionMode === "voice" ? "realtime_voice" : "text_chat");

  const [phase, setPhase] = useState<"brief" | "conversation" | "feedback">(initialPhase);
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [deliveryMode, setDeliveryMode] = useState<"text_chat" | "realtime_voice">(
    initialDeliveryMode
  );
  const [textFallbackEnabled, setTextFallbackEnabled] = useState(
    initialDeliveryMode === "text_chat"
  );
  const [turns, setTurns] = useState<ConversationTurn[]>(
    initialSession?.turns.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
      coaching: turn.coaching,
      disposition: turn.disposition,
      countsTowardProgress: turn.countsTowardProgress,
      reasonCode: turn.reasonCode,
    })) ?? []
  );
  const [review, setReview] = useState<Review | null>(initialReview);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const counterpartLabel = getCounterpartLabel(mission.counterpartRole);
  const isVoiceSession = deliveryMode === "realtime_voice";
  const requiredTurns = mission.requiredTurns;
  const studentTurnCount = useMemo(
    () =>
      turns.filter((turn) => turn.speaker === "student" && turn.countsTowardProgress !== false)
        .length,
    [turns]
  );
  const substantiveFollowUps = useMemo(
    () => countSubstantiveFollowUpResponses(turns),
    [turns]
  );
  const canFinish =
    studentTurnCount >= requiredTurns &&
    substantiveFollowUps >= mission.minimumFollowUpResponses;
  const statusCue = getStatusCue({
    canFinish,
    studentTurnCount,
    isVoiceSession,
    textFallbackEnabled,
    realtimeState: "idle",
  });
  const reviewPrimaryAction = review?.status === "practice_once_more" ? "retry" : "continue";
  const { pending: completing, error: completionError, completionState, complete } =
    useLearnActivityCompletion({
      endpoint: completionEndpoint,
      fallbackHref,
      activityType: "speaking",
      unitTitle,
    });

  const {
    liveConnected,
    realtimeState,
    ambientNoise,
    repairNotice,
    lastQuestion,
    startLiveConversation,
    closeLiveConnection,
    syncTranscript,
    requestRepeatedQuestion,
  } = useLearnRealtimeConversation({
    sessionId,
    turns,
    setTurns,
    openingQuestion: mission.openingQuestion,
    setError,
    onFallbackToText: (message) => {
      setTextFallbackEnabled(true);
      setNotice(message);
    },
  });

  const liveStatusCue = getStatusCue({
    canFinish,
    studentTurnCount,
    isVoiceSession,
    textFallbackEnabled,
    realtimeState,
  });

  useEffect(() => {
    if (phase !== "feedback") return;

    let cancelled = false;

    async function loadSavedPhrases() {
      try {
        const response = await fetch("/api/v1/speak/phrases");
        const payload = (await response.json()) as {
          items?: Array<{ phraseText?: string | null }>;
        };

        if (!response.ok || !Array.isArray(payload.items) || cancelled) {
          return;
        }

        setSavedPhrases(
          payload.items
            .map((item) => item.phraseText?.trim().toLowerCase() ?? "")
            .filter(Boolean)
        );
      } catch {
        // Ignore phrase refresh failures.
      }
    }

    void loadSavedPhrases();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  async function handleStart(mode: "text" | "voice") {
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/learn/curriculum/speaking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitSlug, interactionMode: mode }),
      });
      const payload = (await response.json()) as
        | StartMissionResponse
        | { error?: { message?: string } };

      if (!response.ok || !("sessionId" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error?.message ?? "Unable to start this mission."
            : "Unable to start this mission."
        );
      }

      setSessionId(payload.sessionId);
      setDeliveryMode(payload.deliveryMode);
      setTextFallbackEnabled(payload.deliveryMode === "text_chat");
      setTurns(
        payload.deliveryMode === "realtime_voice"
          ? []
          : payload.resumeState.turns.length > 0
            ? payload.resumeState.turns
            : [{ speaker: "ai", text: payload.openingTurn }]
      );
      setReview(null);
      setInput("");
      setPhase("conversation");

      if (payload.deliveryMode === "realtime_voice") {
        setPending(false);
        await startLiveConversation({
          sessionIdOverride: payload.sessionId,
          autoFallback: true,
        });
        return;
      }
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Unable to start this mission."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleResumeLiveVoice() {
    setTextFallbackEnabled(false);
    setNotice(null);
    await startLiveConversation();
  }

  async function handleSendText() {
    if (!sessionId || input.trim().length < 2) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/learn/curriculum/speaking/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, studentInput: { text: input.trim() } }),
      });
      const payload = (await response.json()) as
        | { aiResponseText: string; studentTranscriptText?: string | null }
        | { error?: { message?: string } };

      if (!response.ok || !("aiResponseText" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error?.message ?? "Unable to send your reply."
            : "Unable to send your reply."
        );
      }

      const transcript = payload.studentTranscriptText?.trim() || input.trim();
      setTurns((current) => [
        ...current,
        { speaker: "student", text: transcript },
        { speaker: "ai", text: payload.aiResponseText },
      ]);
      setInput("");
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : "Unable to send your reply.");
    } finally {
      setPending(false);
    }
  }

  async function handleFinishMission() {
    if (!sessionId) return;

    setPending(true);
    setError(null);

    try {
      if (isVoiceSession) {
        if (liveConnected) {
          await closeLiveConnection({ syncTranscriptBeforeClose: true });
        } else {
          await syncTranscript(turns);
        }
      }

      const response = await fetch("/api/v1/learn/curriculum/speaking/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, unitSlug }),
      });
      const payload = (await response.json()) as Review | { error?: { message?: string } };

      if (!response.ok || !("status" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error?.message ?? "Unable to open feedback."
            : "Unable to open feedback."
        );
      }

      setReview(payload);
      setPhase("feedback");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Unable to open feedback.");
    } finally {
      setPending(false);
    }
  }

  async function handleContinue() {
    if (!review) return;

    await complete({
      unitSlug,
      activityType: "speaking",
      score: review.score,
      responsePayload: {
        sessionId,
        interactionMode: isVoiceSession ? "voice" : "text",
        missionReview: review,
      },
    });
  }

  async function handleSavePhrase(term: string, translationText?: string) {
    const normalizedTerm = normalizePhrase(term);
    if (!sessionId || savedPhrases.includes(normalizedTerm)) return;

    try {
      await fetch(`/api/v1/speak/session/${sessionId}/phrases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phraseText: term, translationText }),
      });
      setSavedPhrases((current) => [...current, normalizedTerm]);
    } catch {
      setError("Unable to save that phrase right now.");
    }
  }

  function insertPhrase(phrase: string) {
    setInput((current) => (current.trim() ? `${current.trim()} ${phrase}` : phrase));
  }

  if (completionState) {
    return <LearnActivityTransition state={completionState} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-border/70 bg-card/95 px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" className="rounded-full px-3">
            <Link href="/app/learn/roadmap">
              <ArrowLeft className="size-4" />
              Back to roadmap
            </Link>
          </Button>
          <Badge
            variant="outline"
            className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
          >
            Unit {unitOrder}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Speaking mission
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {phase === "conversation" ? liveStatusCue : statusCue}
        </p>
      </div>

      {phase === "brief" ? (
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-6 px-6 py-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Brief</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {mission.scenarioTitle}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {mission.scenarioSetup}
              </p>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Your goal
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground">{canDoStatement}</p>
              </div>
              {mission.isBenchmark && mission.benchmarkFocus.length > 0 ? (
                <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                    Hold the idea longer
                  </p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {mission.benchmarkFocus[0]}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {mission.targetPhrases.length > 0 ? (
                <Accordion type="single" collapsible>
                  <AccordionItem value="phrases" className="rounded-[1.25rem] border border-border/70 px-4">
                    <AccordionTrigger className="py-3 text-sm font-semibold text-foreground hover:no-underline">
                      Helpful phrases
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-wrap gap-2 pb-4">
                      {mission.targetPhrases.map((phrase) => (
                        <Badge
                          key={phrase}
                          variant="outline"
                          className="rounded-full border-secondary/20 bg-secondary/5 px-3 py-1 text-foreground"
                        >
                          {phrase}
                        </Badge>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}

              <Accordion type="single" collapsible>
                <AccordionItem value="example" className="rounded-[1.25rem] border border-border/70 px-4">
                  <AccordionTrigger className="py-3 text-sm font-semibold text-foreground hover:no-underline">
                    See example
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-7 text-muted-foreground">
                    {mission.modelExample}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {mission.warmupPrompts.length > 0 ? (
                <Accordion type="single" collapsible>
                  <AccordionItem value="warmup" className="rounded-[1.25rem] border border-border/70 px-4">
                    <AccordionTrigger className="py-3 text-sm font-semibold text-foreground hover:no-underline">
                      Warm up first if you want
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4 text-sm leading-7 text-muted-foreground">
                      {mission.warmupPrompts.map((prompt) => (
                        <p key={prompt}>{prompt}</p>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </div>

            {error ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-border/70 bg-background/75 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Start one short conversation.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answer naturally, stay in the scenario, and add one clear supporting detail.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="rounded-full px-6"
                  onClick={() => handleStart(defaultStartMode)}
                  disabled={pending}
                >
                  {pending ? "Starting..." : "Start conversation"}
                </Button>

                {defaultStartMode === "voice" ? (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => handleStart("text")}
                    disabled={pending}
                  >
                    Use keyboard instead
                  </Button>
                ) : (
                  <Button variant="ghost" className="rounded-full" onClick={() => speakText(mission.openingQuestion)}>
                    <Volume2 className="size-4" />
                    Hear the first question
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "conversation" ? (
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-5 px-6 py-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                    {mission.isBenchmark ? "Benchmark conversation" : "Conversation"}
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {mission.scenarioTitle}
                  </h1>
                </div>

                {isVoiceSession && !textFallbackEnabled ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={realtimeState === "error" ? "destructive" : "outline"}
                      className="rounded-full px-3 py-1"
                    >
                      <Radio className="mr-1 size-3.5" />
                      {getRealtimeStateCopy(realtimeState)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      Room: {ambientNoise === "very_noisy" ? "Very noisy" : ambientNoise === "noisy" ? "Noisy" : "Quiet"}
                    </Badge>
                  </div>
                ) : (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Chat-style text
                  </Badge>
                )}
              </div>

              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                {mission.scenarioSetup}
              </p>
            </div>

            <div className="max-h-[30rem] space-y-3 overflow-auto rounded-[1.8rem] border border-border/70 bg-background/95 p-4">
              {turns.map((turn, index) => {
                const isLatestAI =
                  turn.speaker === "ai" &&
                  index === turns.map((entry) => entry.speaker).lastIndexOf("ai");

                return (
                  <div
                    key={`${turn.speaker}-${index}`}
                    className={cn(
                      "max-w-[88%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm",
                      turn.speaker === "student"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-card text-foreground ring-1 ring-border/60",
                      isLatestAI && "ring-primary/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={cn(
                          "text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                          turn.speaker === "student"
                            ? "text-primary-foreground/75"
                            : "text-secondary"
                        )}
                      >
                        {turn.speaker === "student" ? "You" : counterpartLabel}
                      </p>
                      {turn.speaker === "ai" ? (
                        <button
                          type="button"
                          onClick={() => speakText(turn.text)}
                          className="inline-flex items-center gap-1 rounded-full text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
                        >
                          <Volume2 className="size-3" />
                          Replay
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2">{turn.text}</p>
                    {turn.speaker === "student" && turn.coaching ? (
                      <div
                        className={cn(
                          "mt-3 rounded-2xl border px-3 py-2 text-xs",
                          turn.countsTowardProgress === false
                            ? "border-amber-200 bg-amber-50/80 text-amber-950"
                            : "border-border/70 bg-background/70 text-foreground"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                            {turn.coaching.label}
                          </Badge>
                          <span>{turn.coaching.note}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {pending ? (
                <div className="max-w-[88%] rounded-[1.5rem] bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/60">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-secondary">
                    {counterpartLabel}
                  </p>
                  <p className="mt-2">Thinking about the next reply...</p>
                </div>
              ) : null}
            </div>

            {notice ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {notice}
              </p>
            ) : null}

            {repairNotice ? (
              <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Recovery</p>
                <p className="mt-1 text-muted-foreground">{repairNotice}</p>
                {lastQuestion ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last question: <span className="font-medium text-foreground">{lastQuestion}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="space-y-4 rounded-[1.8rem] border border-border/70 bg-background/75 px-5 py-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isVoiceSession && !textFallbackEnabled ? "Keep the conversation going" : "Your next reply"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {canFinish
                    ? "You can wrap up now or add one more thought before you open feedback."
                    : mission.isBenchmark && mission.minimumFollowUpResponses > 0
                      ? "Answer naturally, then stay with the follow-up questions long enough to prove the skill."
                      : "Answer naturally and keep the scene moving."}
                </p>
              </div>

              {isVoiceSession && !textFallbackEnabled ? (
                <div className="flex flex-wrap items-center gap-3">
                  {liveConnected ? (
                    <Button variant="outline" onClick={() => closeLiveConnection({ syncTranscriptBeforeClose: true })}>
                      <PhoneOff className="size-4" />
                      Pause voice
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="rounded-full px-6"
                      onClick={() => startLiveConversation()}
                      disabled={realtimeState === "connecting"}
                    >
                      <Mic className="size-4" />
                      {realtimeState === "connecting"
                        ? "Connecting voice..."
                        : turns.length > 1
                          ? "Reconnect live voice"
                          : "Start live conversation"}
                    </Button>
                  )}

                  {repairNotice ? (
                    <Button variant="outline" onClick={requestRepeatedQuestion}>
                      <RefreshCcw className="size-4" />
                      Say that again
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={async () => {
                      if (liveConnected) {
                        await closeLiveConnection({ syncTranscriptBeforeClose: true });
                      }
                      setTextFallbackEnabled(true);
                      setNotice("Live voice is paused. You can keep going by typing.");
                    }}
                  >
                    Type instead
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Type your reply."
                    className="rounded-[1.3rem] bg-background/95"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                      {isVoiceSession ? (
                        <Button
                          variant="ghost"
                          className="rounded-full"
                          onClick={handleResumeLiveVoice}
                          disabled={realtimeState === "connecting"}
                        >
                          <Mic className="size-4" />
                          {realtimeState === "connecting"
                            ? "Connecting voice..."
                            : "Try live voice again"}
                        </Button>
                      ) : null}
                    </div>
                    <Button
                      className="rounded-full px-5"
                      onClick={handleSendText}
                      disabled={pending || !sessionId || input.trim().length < 2}
                    >
                      <Send className="size-4" />
                      {pending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              )}

              <Accordion type="single" collapsible>
                <AccordionItem value="help" className="rounded-[1.25rem] border border-border/70 px-4">
                  <AccordionTrigger className="py-3 text-sm font-semibold text-foreground hover:no-underline">
                    Need help?
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    {mission.targetPhrases.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {mission.targetPhrases.map((phrase) => (
                          <button
                            key={phrase}
                            type="button"
                            onClick={() => insertPhrase(phrase)}
                            className="rounded-full border border-secondary/20 bg-secondary/5 px-3 py-1 text-sm text-foreground transition hover:border-secondary/35 hover:bg-secondary/10"
                          >
                            {phrase}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="space-y-2 text-sm leading-7 text-muted-foreground">
                      <p>{mission.modelExample}</p>
                      <p>
                        First question: <span className="text-foreground">{mission.openingQuestion}</span>
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] border border-border/70 bg-background/80 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{liveStatusCue}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canFinish
                    ? "Open feedback whenever you are ready."
                    : "Stay in the conversation and respond one idea at a time."}
                </p>
              </div>
              {canFinish ? (
                <Button size="lg" className="rounded-full px-6" onClick={handleFinishMission} disabled={pending}>
                  See feedback
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "feedback" && review ? (
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-5 px-6 py-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full px-3 py-1", reviewToneClasses(review.status))}>
                  {statusLabel(review.status)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Feedback
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {review.status === "ready"
                  ? "You are ready to keep moving."
                  : review.status === "almost_there"
                    ? "You are close. One clean fix will help."
                    : "Tighten this once, then move on."}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {statusDescription(review.status)}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.6rem] border border-border/70 bg-background/75 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Keep doing this
                </p>
                <p className="mt-3 text-sm leading-7 text-foreground">{review.strength}</p>
              </div>
              <div className="rounded-[1.6rem] border border-border/70 bg-background/75 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Improve next
                </p>
                <p className="mt-3 text-sm leading-7 text-foreground">{review.improvement}</p>
              </div>
            </div>

            {(review.evidenceSummary.observed.length > 0 || review.evidenceSummary.benchmarkFocus) ? (
              <div className="rounded-[1.6rem] border border-border/70 bg-background/75 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Evidence from this conversation
                </p>
                {review.evidenceSummary.observed.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.evidenceSummary.observed.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-full px-3 py-1">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Next focus: <span className="text-foreground">{review.evidenceSummary.nextFocus}</span>
                </p>
                {review.evidenceSummary.benchmarkFocus ? (
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Benchmark focus:{" "}
                    <span className="text-foreground">{review.evidenceSummary.benchmarkFocus}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {review.pronunciationNote ? (
              <div className="rounded-[1.6rem] border border-border/70 bg-muted/10 px-5 py-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <WandSparkles className="size-4 text-primary" />
                  Pronunciation note
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {review.pronunciationNote}
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Highlighted moments</p>
              <div className="space-y-3">
                {review.highlights.map((highlight) => (
                  <div
                    key={`${highlight.turnIndex}-${highlight.youSaid}`}
                    className="rounded-[1.6rem] border border-border/70 bg-background/80 px-5 py-5"
                  >
                    <Badge variant="outline" className="rounded-full border-secondary/20 bg-secondary/5 px-3 py-1 text-foreground">
                      Turn {highlight.turnIndex}
                    </Badge>
                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1.1fr]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">You said</p>
                        <p className="mt-2 text-sm leading-7 text-foreground">{highlight.youSaid}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Try this</p>
                        <p className="mt-2 text-sm leading-7 text-foreground">{highlight.tryInstead}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Why</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{highlight.why}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {review.vocabulary.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Save useful phrases</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {review.vocabulary.map((item) => {
                    const normalizedTerm = normalizePhrase(item.term);
                    const isSaved = savedPhrases.includes(normalizedTerm);

                    return (
                      <button
                        key={item.term}
                        type="button"
                        onClick={() => handleSavePhrase(item.term, item.translation)}
                        disabled={!sessionId && !isSaved}
                        className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4 py-4 text-left transition hover:border-primary/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{item.term}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.definition}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {isSaved ? "Saved" : sessionId ? "Save" : "Unavailable"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Accordion type="single" collapsible>
              <AccordionItem value="transcript" className="rounded-[1.5rem] border border-border/70 px-5">
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
                  See full transcript
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-5">
                  {review.turns.map((turn) => (
                    <div key={turn.turnIndex} className="rounded-[1.25rem] bg-muted/12 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                        {turn.speaker === "student" ? "You" : counterpartLabel}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">{turn.text}</p>
                      {turn.inlineCorrections.map((correction) => (
                        <p key={`${turn.turnIndex}-${correction.span}`} className="mt-2 text-xs text-muted-foreground">
                          Change &quot;{correction.span}&quot; to &quot;{correction.suggestion}&quot; - {correction.reason}
                        </p>
                      ))}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {error || completionError ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error ?? completionError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] border border-border/70 bg-background/80 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {reviewPrimaryAction === "continue"
                    ? "You can keep moving now."
                    : "One retry is the best next move."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewPrimaryAction === "continue"
                    ? "Save this mission and continue into writing when you are ready."
                    : "Retry with the highlighted fixes while the conversation is still fresh."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {progressStatus === "completed" ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="size-4" />
                    Speaking already saved
                  </div>
                ) : reviewPrimaryAction === "continue" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleStart(isVoiceSession && !textFallbackEnabled ? "voice" : "text")}
                      disabled={pending || completing}
                    >
                      <RefreshCcw className="size-4" />
                      Try again
                    </Button>
                    <Button
                      size="lg"
                      className="rounded-full px-6"
                      onClick={handleContinue}
                      disabled={pending || completing}
                    >
                      {completing ? "Saving..." : "Continue to writing"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="accent"
                      className="rounded-full px-6"
                      onClick={() => handleStart(isVoiceSession && !textFallbackEnabled ? "voice" : "text")}
                      disabled={pending || completing}
                    >
                      <RefreshCcw className="size-4" />
                      Try again
                    </Button>
                    <Button variant="outline" onClick={handleContinue} disabled={pending || completing}>
                      Continue anyway
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

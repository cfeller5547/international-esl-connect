"use client";

import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SpeakMissionDetails, type SpeakWordAnnotation, normalizeSpeakTurnSignals, deriveWordAnnotations, type SpeakSessionReview, type SpeakTranscriptTurn } from "@/lib/speak";

function normalizePhrase(value: string) {
  return value.trim().toLowerCase();
}

function coachingToneClasses(turn: SpeakTranscriptTurn) {
  const signals = normalizeSpeakTurnSignals(turn.coaching?.signals);

  if (signals.grammarIssue) {
    return "border-amber-200 bg-amber-50/85 text-amber-950";
  }

  if (signals.fluencyIssue) {
    return "border-sky-200 bg-sky-50/85 text-sky-950";
  }

  if (signals.vocabOpportunity) {
    return "border-emerald-200 bg-emerald-50/85 text-emerald-950";
  }

  return "border-border/70 bg-card/90 text-foreground";
}

function repairToneClasses(turn: SpeakTranscriptTurn) {
  if (turn.disposition === "noise_or_unintelligible") {
    return "border-amber-200 bg-amber-50/80 text-amber-950";
  }

  return "border-border/70 bg-muted/35 text-foreground";
}

function getReviewStatusCopy(
  status: SpeakSessionReview["status"],
  mode: SpeakMissionDetails["mode"]
) {
  if (mode === "free_speech") {
    switch (status) {
      case "practice_once_more":
        return {
          label: "Keep it going",
          description:
            "You got the conversation moving. One more round with fuller answers will make it feel easier.",
        };
      case "almost_there":
        return {
          label: "Good session",
          description:
            "You kept the conversation going. The next gain comes from adding a little more detail.",
        };
      default:
        return {
          label: "You kept it going",
          description:
            "This conversation gave you useful language you can carry into the next one.",
        };
    }
  }

  switch (status) {
    case "practice_once_more":
      return {
        label: "One more round",
        description: "You have the core idea. One more conversation with fuller answers will make it stick.",
      };
    case "almost_there":
      return {
        label: "Almost there",
        description: "You kept the conversation moving. The next gain comes from adding a little more detail.",
      };
    default:
      return {
        label: "Ready to build on",
        description: "This session gave you useful language you can carry into the next conversation.",
      };
  }
}

// ── Annotated text renderer ──────────────────────────────────────────────

function AnnotatedText({ text, annotations }: { text: string; annotations: SpeakWordAnnotation[] }) {
  const [activeAnnotation, setActiveAnnotation] = useState<SpeakWordAnnotation | null>(null);

  if (annotations.length === 0) {
    return <span>{text}</span>;
  }

  const segments: Array<{ text: string; annotation?: SpeakWordAnnotation }> = [];
  let cursor = 0;

  for (const ann of annotations) {
    if (ann.startIndex > cursor) {
      segments.push({ text: text.slice(cursor, ann.startIndex) });
    }
    segments.push({ text: text.slice(ann.startIndex, ann.endIndex), annotation: ann });
    cursor = ann.endIndex;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return (
    <span className="relative">
      {segments.map((seg, i) =>
        seg.annotation ? (
          <span key={i} className="relative inline">
            <button
              type="button"
              onClick={() => setActiveAnnotation(activeAnnotation?.startIndex === seg.annotation!.startIndex ? null : seg.annotation!)}
              className={`border-b-2 cursor-pointer transition-colors ${
                seg.annotation.type === "grammar"
                  ? "border-amber-400/70 hover:border-amber-400 hover:bg-amber-400/10"
                  : seg.annotation.type === "vocabulary"
                    ? "border-emerald-400/70 hover:border-emerald-400 hover:bg-emerald-400/10"
                    : "border-sky-400/70 hover:border-sky-400 hover:bg-sky-400/10"
              } rounded-sm px-0.5 -mx-0.5`}
            >
              {seg.text}
            </button>
            <AnimatePresence>
              {activeAnnotation?.startIndex === seg.annotation!.startIndex ? (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs line-through text-muted-foreground">{seg.annotation!.original}</span>
                      <span className="text-xs text-foreground">→</span>
                      <span className="text-xs font-semibold text-emerald-600">{seg.annotation!.correction}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{seg.annotation!.reason}</p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}

// ── Mission objective bar ────────────────────────────────────────────────

export function MissionObjectiveBar({
  scenarioSetup,
  objective,
  targetPhrases,
  spokenText,
}: {
  scenarioSetup?: string | null;
  objective?: string | null;
  targetPhrases?: string[];
  spokenText: string;
}) {
  if (!scenarioSetup && !objective && (!targetPhrases || targetPhrases.length === 0)) return null;

  const lowerSpoken = spokenText.toLowerCase();

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 space-y-2.5">
      {/* Scenario context — always visible so the student knows what's happening */}
      {scenarioSetup ? (
        <p className="text-sm text-foreground leading-relaxed">
          <span className="font-semibold">📍 Scenario: </span>
          {scenarioSetup}
        </p>
      ) : null}

      {/* Mission objective */}
      {objective ? (
        <p className="text-sm text-foreground">
          <span className="font-semibold">🎯 Goal: </span>
          {objective}
        </p>
      ) : null}

      {/* Target phrases with live tracking */}
      {targetPhrases && targetPhrases.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-muted-foreground">Try to use:</span>
          {targetPhrases.map((phrase) => {
            const hit = lowerSpoken.includes(phrase.toLowerCase());
            return (
              <span
                key={phrase}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
                  hit
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 shadow-sm"
                    : "bg-background/80 text-muted-foreground border border-border/50"
                }`}
              >
                {hit ? <CheckCircle2 className="size-3" /> : null}
                &ldquo;{phrase}&rdquo;
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Illustration mapping — ordered by specificity (longer/more specific keywords first)
const ILLUSTRATION_RULES: Array<{ keywords: string[]; path: string }> = [
  { keywords: ["coffee", "cafe", "latte", "barista", "drink order"], path: "/illustrations/speak/coffee-shop.svg" },
  { keywords: ["order", "food", "snack", "counter", "sandwich", "restaurant", "menu"], path: "/illustrations/speak/coffee-shop.svg" },
  { keywords: ["meet", "introduce", "greeting", "hello", "hi ", "first day", "classmate"], path: "/illustrations/speak/meet-someone.svg" },
  { keywords: ["direction", "lost", "library", "navigate", "where is", "find the", "map"], path: "/illustrations/speak/directions.svg" },
  { keywords: ["class", "teacher", "office hour", "school", "presentation", "discussion", "homework", "assignment"], path: "/illustrations/speak/classroom.svg" },
];

export function getMissionIllustration(title: string): string {
  const lower = title.toLowerCase();
  for (const rule of ILLUSTRATION_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.path;
  }
  return "/illustrations/speak/free-talk.svg";
}

// Color themes per scene type for the session atmosphere
const SCENE_THEMES: Record<string, { bg: string; accent: string; glow: string }> = {
  "/illustrations/speak/coffee-shop.svg": { bg: "from-amber-950/90 to-orange-950/80", accent: "text-amber-400", glow: "bg-amber-500/10" },
  "/illustrations/speak/meet-someone.svg": { bg: "from-blue-950/90 to-indigo-950/80", accent: "text-sky-400", glow: "bg-sky-500/10" },
  "/illustrations/speak/directions.svg": { bg: "from-cyan-950/90 to-teal-950/80", accent: "text-teal-400", glow: "bg-teal-500/10" },
  "/illustrations/speak/classroom.svg": { bg: "from-indigo-950/90 to-violet-950/80", accent: "text-violet-400", glow: "bg-violet-500/10" },
  "/illustrations/speak/free-talk.svg": { bg: "from-slate-950/90 to-slate-900/80", accent: "text-primary", glow: "bg-primary/10" },
};

export function SpeakSceneVisualizer({
  scenarioTitle,
  turnCount,
  isLive = false,
  isSpeaking = false,
  isThinking = false,
}: {
  scenarioTitle: string;
  turnCount: number;
  isLive?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
}) {
  const illustrationPath = useMemo(() => getMissionIllustration(scenarioTitle), [scenarioTitle]);
  const theme = SCENE_THEMES[illustrationPath] ?? SCENE_THEMES["/illustrations/speak/free-talk.svg"]!;

  return (
    <div className="relative w-full overflow-hidden">
      {/* Scene illustration — fills header area */}
      <div className="relative h-44 sm:h-52 md:h-56">
        <img
          src={illustrationPath}
          alt={scenarioTitle}
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {/* Gradient overlay matching scene mood */}
        <div className={`absolute inset-0 bg-gradient-to-t ${theme.bg}`} />

        {/* Scene title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-lg sm:text-2xl">
            {scenarioTitle}
          </h2>
          {turnCount > 0 ? (
            <p className="mt-1 text-xs text-white/60">
              {turnCount} {turnCount === 1 ? "turn" : "turns"} so far
            </p>
          ) : null}
        </div>

        {/* AI state indicator — prominent, centered */}
        {isLive ? (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
            <AIOrb state={isSpeaking ? "speaking" : isThinking ? "thinking" : "listening"} />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/80 drop-shadow-md">
              {isSpeaking ? "Speaking" : isThinking ? "Thinking..." : "Listening"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Cinematic AI Orb ─────────────────────────────────────────────────────

export function AIOrb({
  state,
}: {
  state: "listening" | "thinking" | "speaking";
}) {
  const getColors = () => {
    switch (state) {
      case "speaking":
        return {
          core: "bg-primary",
          glow: "bg-primary/50",
          ring: "border-primary/40",
        };
      case "thinking":
        return {
          core: "bg-amber-400",
          glow: "bg-amber-400/50",
          ring: "border-amber-400/40",
        };
      case "listening":
      default:
        return {
          core: "bg-emerald-400",
          glow: "bg-emerald-400/40",
          ring: "border-emerald-400/30",
        };
    }
  };

  const colors = getColors();

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Outer pulsing glow */}
      <motion.div
        animate={{
          scale: state === "speaking" ? [1, 1.5, 1] : state === "thinking" ? [1, 1.2, 1] : [1, 1.3, 1],
          opacity: state === "speaking" ? [0.4, 0.8, 0.4] : [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: state === "speaking" ? 0.8 : state === "thinking" ? 1.5 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute inset-0 rounded-full blur-xl ${colors.glow}`}
      />
      
      {/* Middle rotating/pulsing ring */}
      <motion.div
        animate={{
          scale: state === "speaking" ? [0.85, 1.15, 0.85] : [0.95, 1.05, 0.95],
          rotate: state === "thinking" ? 360 : 0,
        }}
        transition={{
          scale: { duration: state === "speaking" ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
        }}
        className={`absolute inset-2 rounded-full border-2 border-dashed ${colors.ring}`}
      />

      {/* Core orb */}
      <motion.div
        animate={{
          scale: state === "speaking" ? [0.8, 1.2, 0.8] : [0.9, 1, 0.9],
        }}
        transition={{
          duration: state === "speaking" ? 0.4 : 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`relative w-10 h-10 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] ${colors.core} flex items-center justify-center overflow-hidden`}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 to-white/40 mix-blend-overlay" />
        <div className="absolute top-1 right-2 w-3 h-3 rounded-full bg-white/60 blur-[2px]" />
      </motion.div>
    </div>
  );
}

// ── Cinematic visual-novel components ────────────────────────────────────

export function getSceneTheme(scenarioTitle: string) {
  const illustrationPath = getMissionIllustration(scenarioTitle);
  return {
    illustrationPath,
    ...(SCENE_THEMES[illustrationPath] ?? SCENE_THEMES["/illustrations/speak/free-talk.svg"]!),
  };
}

export function SpeakSceneBackground({
  scenarioTitle,
  isLive = false,
  isSpeaking = false,
  isThinking = false,
}: {
  scenarioTitle: string;
  isLive?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
}) {
  const { illustrationPath, bg, glow } = useMemo(
    () => getSceneTheme(scenarioTitle),
    [scenarioTitle]
  );

  return (
    <div className="absolute inset-0" aria-hidden>
      <img
        src={illustrationPath}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {/* Scene mood gradient */}
      <div className={`absolute inset-0 bg-gradient-to-t ${bg} opacity-70`} />
      {/* Bottom darkness to anchor dialogue — kept light so the scene breathes */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

      {/* Ambient AI state glow integrated into the scene */}
      <AnimatePresence>
        {isLive && isSpeaking ? (
          <motion.div
            key="speak-glow"
            initial={{ opacity: 0 }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.12, 0.28, 0.12] }}
            exit={{ opacity: 0 }}
            transition={{
              scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.5 },
            }}
            className={`absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-72 h-72 rounded-full ${glow} blur-[80px]`}
          />
        ) : isLive && isThinking ? (
          <motion.div
            key="think-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.06, 0.16, 0.06] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-56 h-56 bg-amber-500/15 rounded-full blur-[70px]"
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function SpeakCinematicObjectiveBar({
  objective,
  targetPhrases,
  spokenText,
}: {
  objective?: string | null;
  targetPhrases?: string[];
  spokenText: string;
}) {
  if (!objective && (!targetPhrases || targetPhrases.length === 0)) return null;

  const lowerSpoken = spokenText.toLowerCase();

  return (
    <div className="backdrop-blur-md bg-black/25 border-b border-white/[0.06] px-5 py-2.5 space-y-1.5">
      {objective ? (
        <p className="text-xs text-white/70 leading-snug truncate">
          <span className="font-bold text-white/90">Goal</span> {objective}
        </p>
      ) : null}

      {targetPhrases && targetPhrases.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {targetPhrases.map((phrase) => {
            const hit = lowerSpoken.includes(phrase.toLowerCase());
            return (
              <span
                key={phrase}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-300 ${
                  hit
                    ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/25"
                    : "bg-white/[0.06] text-white/40 border border-white/[0.08]"
                }`}
              >
                {hit ? <CheckCircle2 className="size-2.5" /> : null}
                &ldquo;{phrase}&rdquo;
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SpeakDialogueBox({
  turns,
  scenarioTitle,
  showCoaching = true,
  stateLabel,
  stateType,
  children,
}: {
  turns: SpeakTranscriptTurn[];
  scenarioTitle: string;
  showCoaching?: boolean;
  stateLabel?: string;
  stateType?: "listening" | "speaking" | "thinking" | "ready" | "error" | "idle";
  children?: ReactNode;
}) {
  const historyRef = useRef<HTMLDivElement>(null);
  const theme = useMemo(() => getSceneTheme(scenarioTitle), [scenarioTitle]);

  // Split turns: everything before the latest AI turn is history;
  // the latest AI turn + any student turn after it is the current exchange.
  const { history, currentAi, currentStudent } = useMemo(() => {
    if (turns.length === 0)
      return { history: [] as SpeakTranscriptTurn[], currentAi: null, currentStudent: null };

    let lastAiIdx = -1;
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].speaker === "ai") {
        lastAiIdx = i;
        break;
      }
    }

    if (lastAiIdx < 0) {
      return { history: [] as SpeakTranscriptTurn[], currentAi: null, currentStudent: null };
    }

    const studentAfter =
      lastAiIdx < turns.length - 1 && turns[turns.length - 1].speaker === "student"
        ? turns[turns.length - 1]
        : null;

    return {
      history: turns.slice(0, lastAiIdx),
      currentAi: turns[lastAiIdx],
      currentStudent: studentAfter,
    };
  }, [turns]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history.length]);

  return (
    <div className="rounded-t-[1.75rem] backdrop-blur-xl bg-black/50 border-t border-white/[0.08] shadow-[0_-12px_50px_rgba(0,0,0,0.5)]">
      {/* Collapsed history — tight faded strip, just enough to orient */}
      {history.length > 0 ? (
        <div
          ref={historyRef}
          className="max-h-12 overflow-y-auto overscroll-contain px-5 pt-2 pb-1 border-b border-white/[0.05] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black)]"
        >
          <div className="space-y-0.5">
            {history.map((turn) => (
              <div
                key={`h-${turn.speaker}-${turn.turnIndex}`}
                className="flex gap-1.5 text-[10px] leading-snug"
              >
                <span
                  className={`font-bold shrink-0 ${turn.speaker === "ai" ? theme.accent : "text-white/45"}`}
                >
                  {turn.speaker === "ai" ? "AI" : "You"}
                </span>
                <span className="text-white/30 line-clamp-1">{turn.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Current exchange */}
      <div className="px-5 pt-3 pb-2 space-y-2">
        {/* AI state indicator — inline, minimal */}
        {stateLabel ? (
          <div className="flex items-center gap-2">
            {stateType === "speaking" ? (
              <div className="flex gap-[3px] items-end h-3.5">
                {[0, 0.15, 0.3].map((delay) => (
                  <motion.div
                    key={delay}
                    animate={{ height: ["5px", "14px", "5px"] }}
                    transition={{
                      duration: 0.55,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay,
                    }}
                    className="w-[3px] rounded-full bg-primary"
                  />
                ))}
              </div>
            ) : stateType === "thinking" ? (
              <div className="flex gap-1 items-center">
                {[0, 0.2, 0.4].map((delay) => (
                  <motion.div
                    key={delay}
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay }}
                    className="w-1.5 h-1.5 bg-amber-400 rounded-full"
                  />
                ))}
              </div>
            ) : stateType === "listening" ? (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-2 h-2 bg-emerald-400 rounded-full"
              />
            ) : null}
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {stateLabel}
            </span>
          </div>
        ) : null}

        {/* Current AI dialogue — the prominent visual-novel text */}
        <AnimatePresence mode="wait">
          {currentAi ? (
            <motion.div
              key={currentAi.turnIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.accent} mb-1`}
              >
                AI
              </p>
              <p className="text-[15px] sm:text-[17px] text-white font-medium leading-[1.65]">
                {currentAi.text}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Student response — indented with left border */}
        <AnimatePresence>
          {currentStudent ? (
            <motion.div
              key={`s-${currentStudent.turnIndex}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="ml-3 pl-3 border-l-2 border-white/15"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-0.5">
                You
              </p>
              <p className="text-sm text-white/75 leading-relaxed">
                <AnnotatedText
                  text={currentStudent.text}
                  annotations={
                    currentStudent.annotations ?? deriveWordAnnotations(currentStudent.text)
                  }
                />
              </p>

              {/* Repair / coaching feedback */}
              {currentStudent.disposition &&
              currentStudent.disposition !== "accepted_answer" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/15 px-3 py-1.5 text-[11px] text-amber-200/90">
                  <span className="font-bold">
                    {currentStudent.coaching?.label ?? "Say that again"}
                  </span>
                  <span className="text-amber-200/60">
                    {currentStudent.coaching?.note ?? "That turn did not count."}
                  </span>
                </div>
              ) : showCoaching &&
                currentStudent.coaching &&
                (!currentStudent.disposition ||
                  currentStudent.disposition === "accepted_answer") ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-[11px] text-white/50">
                  <span className="font-semibold text-white/60">
                    {currentStudent.coaching.label}
                  </span>
                  <span>{currentStudent.coaching.note}</span>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Controls slot */}
      {children ? <div className="px-5 pb-4 pt-0.5">{children}</div> : null}
    </div>
  );
}

export function SpeakTranscriptPane({
  turns,
  compact = false,
  showCoaching = true,
}: {
  turns: SpeakTranscriptTurn[];
  compact?: boolean;
  showCoaching?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  if (turns.length === 0) {
    return null;
  }

  return (
    <div ref={scrollRef} className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 shadow-md max-h-[70vh] overflow-auto scroll-smooth">
      <div className="sticky top-0 z-10 bg-primary/5 backdrop-blur-sm px-5 py-3 border-b border-border/50 flex items-center justify-between">
         <span className="text-xs font-semibold uppercase tracking-widest text-primary">Conversation</span>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        {turns.map((turn) => (
          <div key={`${turn.speaker}-${turn.turnIndex}`}>
            {turn.speaker === "ai" ? (
              /* AI bubble — left-aligned */
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  <div className="rounded-2xl rounded-tl-md bg-muted/50 border border-border/50 px-4 py-3">
                    <p className="text-sm leading-relaxed text-foreground">{turn.text}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Student bubble — right-aligned with annotations */
              <div className="flex justify-end">
                <div className="max-w-[85%] space-y-2">
                  <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-3">
                    <p className="text-sm leading-relaxed text-primary-foreground">
                      <AnnotatedText
                        text={turn.text}
                        annotations={turn.annotations ?? deriveWordAnnotations(turn.text)}
                      />
                    </p>
                  </div>

                  {turn.disposition && turn.disposition !== "accepted_answer" ? (
                    <div className={`rounded-xl border px-3 py-2 text-xs ${repairToneClasses(turn)}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          {turn.coaching?.label ?? "Say that again"}
                        </Badge>
                        <span>
                          {turn.coaching?.note ?? "That turn did not count. Listen for the question again and answer it clearly."}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {showCoaching && turn.coaching && (!turn.disposition || turn.disposition === "accepted_answer") ? (
                    <div className={`rounded-xl border px-3 py-2 text-xs ${coachingToneClasses(turn)}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          {turn.coaching.label}
                        </Badge>
                        <span>{turn.coaching.note}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpeakCompletionCard({
  mission,
  counterpartLabel,
  review,
  studentTurnCount,
}: {
  mission: SpeakMissionDetails;
  counterpartLabel: string;
  review: SpeakSessionReview | null;
  studentTurnCount: number;
}) {
  const statusCopy = getReviewStatusCopy(review?.status ?? "ready", mission.mode);

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-card shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <CardContent className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3.5 py-1.5 text-sm font-bold text-primary shadow-sm">
            <Sparkles className="size-4" />
            Mission Cleared
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {mission.scenarioTitle}
            </h2>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              {statusCopy.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {mission.mode === "guided" ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                {counterpartLabel}
              </Badge>
            ) : null}
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 text-primary px-3 py-1 text-xs font-medium">
              {statusCopy.label}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary/80">
              {mission.mode === "free_speech" ? "What sounded natural" : "What landed"}
            </p>
            <p className="mt-2.5 text-sm font-medium text-foreground leading-relaxed">
              {review?.strength ?? "You stayed in the conversation and kept your ideas moving."}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Session snapshot
            </p>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{studentTurnCount}</span>
              <span className="text-sm font-medium text-muted-foreground">turns recorded</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Review the strongest language below and save anything you want to reuse.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SpeakReviewPanel({
  review,
  sessionId,
  mode,
}: {
  review: SpeakSessionReview;
  sessionId: string;
  mode: SpeakMissionDetails["mode"];
}) {
  const [savedPhrases, setSavedPhrases] = useState<Set<string>>(new Set());

  async function savePhrase(phraseText: string) {
    const response = await fetch(`/api/v1/speak/session/${sessionId}/phrases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phraseText,
        translationText: phraseText,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save that phrase.");
    }

    setSavedPhrases((current) => {
      const next = new Set(current);
      next.add(normalizePhrase(phraseText));
      return next;
    });
  }

  const highlights = review.highlights.slice(0, 3);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <Card className="border-border/70 bg-card shadow-sm overflow-hidden">
        <CardHeader className="space-y-3 bg-muted/10 pb-5 border-b border-border/40">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {mode === "free_speech" ? "Conversation takeaways" : "Coach summary"}
          </Badge>
          <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {mode === "free_speech"
              ? "What sounded natural and what to try next"
              : "What to keep and what to refine"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                {mode === "free_speech" ? "What sounded natural" : "What to keep"}
              </p>
              <p className="mt-2.5 text-sm font-medium text-foreground leading-relaxed">{review.strength}</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
                {mode === "free_speech" ? "Next thing to try" : "Next focus"}
              </p>
              <p className="mt-2.5 text-sm font-medium text-foreground leading-relaxed">{review.improvement}</p>
            </div>
          </div>

          {highlights.length > 0 ? (
            <div className="space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Key moments
              </p>
              <div className="grid gap-3">
                {highlights.map((highlight, index) => (
                  <div
                    key={`${highlight.turnIndex}-${index}`}
                    className="rounded-[1.5rem] border border-border/50 bg-muted/10 p-5"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Moment {index + 1}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="font-bold text-foreground">You said:</span> {highlight.youSaid}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      <span className="font-bold text-foreground">More natural:</span>{" "}
                      <span className="text-primary">{highlight.tryInstead}</span>
                    </p>
                    <p className="mt-3 text-sm text-foreground font-medium bg-background/50 p-3 rounded-xl border border-border/40">{highlight.why}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Accordion type="single" collapsible className="rounded-[1.5rem] border border-border/70 px-5 bg-muted/5">
            <AccordionItem value="snapshot" className="border-none">
              <AccordionTrigger className="py-4 text-sm font-bold hover:no-underline">
                <div className="space-y-1 text-left">
                  <p className="text-sm font-bold text-foreground">Conversation snapshot</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    Expand the transcript only if you want to inspect exact turns.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="space-y-3">
                  {review.turns.map((turn) => (
                    <div
                      key={`${turn.turnIndex}-${turn.speaker}`}
                      className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-sm"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {turn.speaker}
                      </p>
                      <p className="mt-2 text-sm text-foreground font-medium">{turn.text}</p>
                      {turn.inlineCorrections.slice(0, 1).map((correction) => (
                        <div
                          key={`${turn.turnIndex}-${correction.span}`}
                          className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground"
                        >
                          <span className="font-bold text-primary">Try:</span> {correction.suggestion}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-sm overflow-hidden">
        <CardHeader className="space-y-3 bg-muted/10 pb-5 border-b border-border/40">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Phrase bank
          </Badge>
          <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {mode === "free_speech" ? "Phrases to reuse" : "Keep these phrases for next time"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Save reusable language from the session, not single words.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {review.vocabulary.map((item) => {
            const isSaved = savedPhrases.has(normalizePhrase(item.term));

            return (
              <button
                key={item.term}
                type="button"
                onClick={() => void savePhrase(item.term)}
                disabled={isSaved}
                className="w-full rounded-[1.5rem] border border-border/70 bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-md disabled:cursor-default disabled:opacity-70 group shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="font-bold text-base text-foreground group-hover:text-primary transition-colors">{item.term}</p>
                    <p className="text-sm text-muted-foreground font-medium">{item.definition}</p>
                  </div>
                  <Badge variant={isSaved ? "default" : "outline"} className={`rounded-full px-3 py-1 ${!isSaved && "border-border/80 text-foreground group-hover:border-primary group-hover:text-primary"}`}>
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        Saved
                      </span>
                    ) : (
                      "Save"
                    )}
                  </Badge>
                </div>
              </button>
            );
          })}
          {review.vocabulary.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-sm text-muted-foreground text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-muted/20 rounded-full">
                  <Sparkles className="size-6 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="font-bold text-foreground">No reusable phrase surfaced this round.</p>
                  <p className="mt-1 max-w-xs mx-auto">
                    Finish another session with a few longer answers and this bank will get smarter.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

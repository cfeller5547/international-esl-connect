"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookText, Check, Mic, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AIOrb } from "@/features/speak/speak-session-ui";
import { Button } from "@/components/ui/button";
import { CoachAvatarRail } from "@/features/speak/coach-avatar-rail";
import { buildMissionCoachCue } from "@/features/speak/coach-cue-mapper";
import {
  buildSpeakTargetPhraseProgress,
  getSpeakCounterpartLabel,
  resolveSpeakMissionStageKey,
  type SpeakCoachCue,
  type SpeakMissionDetails,
  type SpeakMissionStageSpec,
  type SpeakSceneActor,
  type SpeakSceneBeat,
  type SpeakSceneProp,
  type SpeakSceneState,
  type SpeakTranscriptTurn,
} from "@/lib/speak";

export type SpeakLiveTone =
  | "idle"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "repair"
  | "resolved"
  | "error";

type SpeakMissionStageFrameProps = {
  mission: SpeakMissionDetails;
  turns: SpeakTranscriptTurn[];
  stateLabel: string;
  liveTone: SpeakLiveTone;
  studentTurnCount: number;
  onBack: () => void;
  topAction: ReactNode;
  primaryControl: ReactNode;
  secondaryControls?: ReactNode;
  transcriptOpen: boolean;
  onTranscriptToggle: () => void;
  transcriptDrawer: ReactNode;
  helpPrompt?: string | null;
  repairNotice?: string | null;
  coachSpeaking?: boolean;
  coachMouthPulseKey?: number;
  onCoachCueChange?: (cue: SpeakCoachCue | null) => void;
};

type SceneTheme = {
  shell: string;
  mist: string;
  accent: string;
  accentRing: string;
  rail: string;
};

const THEME_BY_STAGE = {
  coffee_shop: {
    shell: "bg-[radial-gradient(circle_at_top,#fff3d6_0%,#f6d39c_36%,#7a3c15_100%)]",
    mist: "from-amber-950/10 via-amber-900/5 to-orange-950/25",
    accent: "text-amber-100",
    accentRing: "border-amber-200/40 bg-amber-100/10",
    rail: "from-[#2a1306]/92 via-[#241107]/88 to-[#120a05]/94",
  },
  directions: {
    shell: "bg-[radial-gradient(circle_at_top,#d5f2ff_0%,#91d6f0_34%,#12344c_100%)]",
    mist: "from-sky-950/10 via-cyan-950/5 to-slate-950/30",
    accent: "text-sky-50",
    accentRing: "border-sky-200/40 bg-sky-100/10",
    rail: "from-[#102335]/92 via-[#0f2230]/88 to-[#0a1420]/94",
  },
  classroom: {
    shell: "bg-[radial-gradient(circle_at_top,#eef3ff_0%,#bccbff_38%,#30205f_100%)]",
    mist: "from-indigo-950/10 via-violet-950/5 to-slate-950/30",
    accent: "text-indigo-50",
    accentRing: "border-indigo-200/40 bg-indigo-100/10",
    rail: "from-[#1a1038]/92 via-[#180f34]/88 to-[#0e0b1b]/94",
  },
  open_conversation: {
    shell: "bg-[radial-gradient(circle_at_top,#edf7ff_0%,#bfd4ff_38%,#16325d_100%)]",
    mist: "from-primary/10 via-primary/5 to-slate-950/30",
    accent: "text-primary-foreground",
    accentRing: "border-primary/30 bg-primary/15",
    rail: "from-[#12284b]/92 via-[#112544]/88 to-[#0a1322]/94",
  },
  generic: {
    shell: "bg-[radial-gradient(circle_at_top,#eef3ff_0%,#d4dcf5_36%,#1f3348_100%)]",
    mist: "from-slate-950/10 via-slate-900/5 to-slate-950/35",
    accent: "text-slate-50",
    accentRing: "border-white/25 bg-white/10",
    rail: "from-[#111827]/92 via-[#111827]/88 to-[#0b1220]/94",
  },
} satisfies Record<string, SceneTheme>;

type CoachCue = {
  label: string;
  text: string;
  tone: "hint" | "repair" | "success" | "prompt";
};

function createStageSpec(mission: SpeakMissionDetails): SpeakMissionStageSpec {
  const stageKey = resolveSpeakMissionStageKey(mission.stageKey, mission.scenarioTitle);

  const beats: SpeakSceneBeat[] =
    mission.sceneBeats && mission.sceneBeats.length > 0
      ? mission.sceneBeats
      : stageKey === "coffee_shop"
        ? [
            {
              id: "mission_started",
              trigger: "mission_started",
              description: "Scene settles into a warm cafe counter.",
            },
            {
              id: "ai_opening",
              trigger: "ai_opening",
              description: "Barista slides the wrong iced drink across the counter.",
            },
            {
              id: "student_phrase_landed",
              trigger: "student_phrase_landed",
              description: "Mission chips light up as key repair language lands.",
            },
            {
              id: "mission_resolved",
              trigger: "mission_resolved",
              description: "The correct drink replaces the wrong one with a resolved reaction.",
            },
          ]
        : [
            {
              id: "mission_started",
              trigger: "mission_started",
              description: "The counterpart appears in a live speaking scene.",
            },
            {
              id: "student_phrase_landed",
              trigger: "student_phrase_landed",
              description: "Target language progress updates inside the mission HUD.",
            },
            {
              id: "mission_resolved",
              trigger: "mission_resolved",
              description: "The scene resolves once the learner completes the objective.",
            },
          ];

  return {
    sceneType: mission.sceneType ?? "cinematic_2d",
    stageKey,
    counterpartOnStage: true,
    beats,
  };
}

function buildSceneState(
  mission: SpeakMissionDetails,
  turns: SpeakTranscriptTurn[],
  liveTone: SpeakLiveTone
): SpeakSceneState {
  const spec = createStageSpec(mission);
  const targetPhraseProgress = buildSpeakTargetPhraseProgress(
    mission.targetPhrases,
    turns.filter((turn) => turn.speaker === "student").map((turn) => turn.text).join(" ")
  );
  const latestAiTurn = [...turns].reverse().find((turn) => turn.speaker === "ai");
  const latestStudentTurn = [...turns].reverse().find((turn) => turn.speaker === "student");
  const allAiText = turns
    .filter((turn) => turn.speaker === "ai")
    .map((turn) => turn.text.toLowerCase())
    .join(" ");
  const allStudentText = turns
    .filter((turn) => turn.speaker === "student")
    .map((turn) => turn.text.toLowerCase())
    .join(" ");
  const landedCount = targetPhraseProgress.filter((item) => item.state === "landed").length;
  const mentionsHotTea =
    allStudentText.includes("hot tea") ||
    (allStudentText.includes("tea") && !allStudentText.includes("iced coffee"));
  const explainsMixUp =
    allStudentText.includes("order") ||
    allStudentText.includes("ordered") ||
    allStudentText.includes("wrong") ||
    allStudentText.includes("not my") ||
    allStudentText.includes("iced coffee");
  const soundsPolite =
    allStudentText.includes("excuse me") ||
    allStudentText.includes("please") ||
    allStudentText.includes("sorry");

  const resolved =
    spec.stageKey === "coffee_shop"
      ? (mentionsHotTea && explainsMixUp && (soundsPolite || landedCount >= 2)) ||
        landedCount >= Math.min(3, Math.max(1, mission.targetPhrases.length))
      : landedCount >= Math.min(2, Math.max(1, mission.targetPhrases.length));

  const actorState =
    resolved
      ? "resolved"
      : liveTone === "speaking" || latestAiTurn?.turnIndex === turns.at(-1)?.turnIndex
        ? "speaking"
        : liveTone === "repair" || allAiText.includes("did you actually order")
          ? "confused"
          : liveTone === "ready" || liveTone === "listening" || liveTone === "thinking"
            ? "listening"
            : "idle";

  const actorRole =
    mission.counterpartRole ??
    (spec.stageKey === "coffee_shop"
      ? "barista"
      : spec.stageKey === "directions"
        ? "stranger"
        : spec.stageKey === "classroom"
          ? "teacher"
          : "conversation_partner");

  const actor: SpeakSceneActor = {
    id: "counterpart",
    role: actorRole,
    label: getSpeakCounterpartLabel(actorRole),
    state: actorState,
  };

  const props = (
    spec.stageKey === "coffee_shop"
      ? [
          {
            id: "wrong_drink",
            kind: "drink",
            state:
              resolved
                ? "hidden"
                : allAiText.includes("iced coffee") || allAiText.includes("here is your")
                  ? "wrong_drink_on_counter"
                  : "hidden",
            label: "Wrong iced drink",
          },
          {
            id: "correct_drink",
            kind: "drink",
            state: resolved ? "correct_drink_ready" : "hidden",
            label: "Hot tea",
          },
        ]
      : [
          {
            id: "anchor_prop",
            kind: spec.stageKey,
            state: "static",
            label: mission.scenarioTitle,
          },
        ]
  ) as SpeakSceneProp[];

  const subtitles = [
    latestAiTurn
      ? {
          speaker: "ai" as const,
          text: latestAiTurn.text,
          emphasis: "highlight" as const,
        }
      : null,
    latestStudentTurn
      ? {
          speaker: "student" as const,
          text: latestStudentTurn.text,
          emphasis: "normal" as const,
        }
      : null,
  ].filter(Boolean) as SpeakSceneState["subtitles"];

  return {
    spec,
    actor,
    props,
    subtitles,
    targetPhraseProgress,
    resolved,
  };
}

function PhraseChip({
  phrase,
  state,
}: {
  phrase: string;
  state: "unseen" | "attempted" | "landed";
}) {
  const classes =
    state === "landed"
      ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-50"
      : state === "attempted"
        ? "border-amber-200/45 bg-amber-100/15 text-amber-50"
        : "border-white/15 bg-white/5 text-white/65";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${classes}`}>
      {state === "landed" ? <Check className="size-3" /> : null}
      "{phrase}"
    </span>
  );
}

function MissionHud({
  mission,
  sceneState,
}: {
  mission: SpeakMissionDetails;
  sceneState: SpeakSceneState;
}) {
  const objective =
    mission.mode === "free_speech"
      ? mission.contextHint ?? "Talk naturally and keep the conversation moving."
      : mission.canDoStatement ?? mission.performanceTask ?? mission.scenarioSetup;

  return (
    <div className="absolute left-4 top-4 z-20 max-w-[32rem] rounded-[1.6rem] border border-white/12 bg-black/25 p-4 shadow-xl backdrop-blur-md sm:left-6 sm:top-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
        {mission.mode === "free_speech" ? "Live conversation" : "Mission"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {mission.scenarioTitle}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">{objective}</p>
      {sceneState.targetPhraseProgress.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {sceneState.targetPhraseProgress.slice(0, 3).map((item) => (
            <PhraseChip key={item.phrase} phrase={item.phrase} state={item.state} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildCoachCue({
  mission,
  sceneState,
  liveTone,
  helpPrompt,
  repairNotice,
  studentTurnCount,
}: {
  mission: SpeakMissionDetails;
  sceneState: SpeakSceneState;
  liveTone: SpeakLiveTone;
  helpPrompt?: string | null;
  repairNotice?: string | null;
  studentTurnCount: number;
}): CoachCue | null {
  if (repairNotice?.trim()) {
    return {
      label: "Try again",
      text: repairNotice.trim(),
      tone: "repair",
    };
  }

  if (helpPrompt?.trim()) {
    return {
      label: "Hint",
      text: helpPrompt.trim(),
      tone: "hint",
    };
  }

  if (sceneState.resolved) {
    return {
      label: "Nice correction",
      text:
        sceneState.spec.stageKey === "coffee_shop"
          ? "You fixed the order and got the hot tea."
          : "You completed the mission clearly. Keep that phrasing.",
      tone: "success",
    };
  }

  if (liveTone === "error") {
    return {
      label: "Reconnect",
      text: "The connection slipped. Reconnect when you are ready.",
      tone: "repair",
    };
  }

  if (liveTone === "ready" && studentTurnCount === 0) {
    return {
      label: "Start here",
      text:
        sceneState.spec.stageKey === "coffee_shop"
          ? "Tell the barista you ordered hot tea."
          : mission.mode === "guided"
            ? "Open with one short sentence that matches the mission goal."
            : "Answer naturally. I will stay out unless you need a hint.",
      tone: "prompt",
    };
  }

  return null;
}

function CoachCompanion({ cue }: { cue: CoachCue | null }) {
  const speaking = Boolean(cue);
  const bubbleClasses =
    cue?.tone === "repair"
      ? "border-amber-300/50 bg-amber-50/95 text-amber-950"
      : cue?.tone === "success"
        ? "border-emerald-300/40 bg-emerald-50/95 text-emerald-950"
        : "border-sky-200/45 bg-white/95 text-slate-950";

  return (
    <div className="flex w-[15rem] flex-col items-start">
      <div className="flex flex-col items-start gap-3">
        <AnimatePresence>
          {cue ? (
            <motion.div
              initial={{ opacity: 0, x: -18, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -12, y: 8 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className={`max-w-[14rem] rounded-[1.6rem] border px-4 py-3 shadow-xl backdrop-blur-md ${bubbleClasses}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {cue.label}
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed">{cue.text}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative h-44 w-28 self-center"
        >
          <div className="absolute bottom-1 left-3 h-6 w-24 rounded-full bg-black/12 blur-xl" />
          <div className="absolute left-[1.9rem] top-3 h-[4.6rem] w-[4.6rem] rounded-full bg-[#ffe8c9] shadow-md" />
          <div className="absolute left-[2.65rem] top-[2.6rem] flex gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/65" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/65" />
          </div>
          <motion.div
            className="absolute left-[2.95rem] top-[3.9rem] h-1.5 w-5 rounded-full bg-slate-900/55"
            animate={
              speaking
                ? {
                    scaleX: [1, 0.55, 1.15, 0.72, 1],
                    scaleY: [1, 1.35, 0.85, 1.25, 1],
                  }
                : { scaleX: 1, scaleY: 1 }
            }
            transition={{ duration: 0.7, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
            style={{ transformOrigin: "center center" }}
          />
          <div className="absolute left-[1.15rem] top-[5.15rem] h-[5.1rem] w-[5.7rem] rounded-t-[2rem] rounded-b-[1.25rem] bg-[#2d6ea9] shadow-lg" />
          <div className="absolute left-[1.8rem] top-[5.45rem] h-[4.35rem] w-[4.35rem] rounded-t-[1.6rem] rounded-b-[1rem] bg-[#4b92d1]" />
          <div className="absolute left-[1.55rem] top-[5rem] h-5 w-[4.8rem] rounded-full bg-[#5ca0df]" />
          <div className="absolute left-[0.55rem] top-[2.6rem] h-6 w-6 rounded-full border-[5px] border-slate-700/70 border-r-transparent" />
          <div className="absolute right-[0.4rem] top-[2.6rem] h-6 w-6 rounded-full border-[5px] border-slate-700/70 border-l-transparent" />
          <div className="absolute left-[0.95rem] top-[2rem] h-1 w-1.5 rounded-full bg-slate-700/70" />
          <div className="absolute right-[0.85rem] top-[2rem] h-1 w-1.5 rounded-full bg-slate-700/70" />
          <div className="absolute left-[0.15rem] top-[7.2rem] h-4 w-[3.8rem] rounded-full bg-[#ffe8c9] shadow-sm" />
          <div className="absolute right-[0.15rem] top-[7.2rem] h-4 w-[3.8rem] rounded-full bg-[#ffe8c9] shadow-sm" />
          <div className="absolute left-[1.55rem] top-[8.25rem] h-[2.6rem] w-[3.8rem] rounded-[1rem] border border-white/20 bg-slate-100/90 shadow-lg" />
          <div className="absolute left-[2.1rem] top-[8.85rem] h-1 w-[2.7rem] rounded-full bg-slate-300" />
          <div className="absolute left-[2.1rem] top-[9.5rem] h-1 w-[2rem] rounded-full bg-slate-200" />
          <div className="absolute left-[0.55rem] top-0 rounded-full border border-white/25 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
            Coach
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SubtitleRail({
  subtitles,
  theme,
}: {
  subtitles: SpeakSceneState["subtitles"];
  theme: SceneTheme;
}) {
  const primary = subtitles[0] ?? null;
  const secondary = subtitles[1] ?? null;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-gradient-to-t ${theme.rail} px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5`}
    >
      {primary ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
            {primary.speaker === "ai" ? "AI" : "You"}
          </p>
          <p className="max-w-4xl text-xl font-semibold leading-tight text-white sm:text-[1.9rem]">
            {primary.text}
          </p>
        </div>
      ) : null}
      {secondary ? (
        <p className="mt-3 text-sm text-white/72 sm:text-base">
          <span className="mr-2 font-semibold text-white/90">You:</span>
          {secondary.text}
        </p>
      ) : null}
    </div>
  );
}

function CoffeeShopScene({
  sceneState,
}: {
  sceneState: SpeakSceneState;
}) {
  const wrongDrink = sceneState.props.find((prop) => prop.id === "wrong_drink");
  const correctDrink = sceneState.props.find((prop) => prop.id === "correct_drink");
  const cupDelivered = wrongDrink?.state === "wrong_drink_on_counter";
  const cupResolved = correctDrink?.state === "correct_drink_ready";
  const actorSpeaking = sceneState.actor.state === "speaking";
  const actorConfused = sceneState.actor.state === "confused";
  const actorResolved = sceneState.actor.state === "resolved";

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffedd5_0%,#fdba74_36%,#7c2d12_100%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
        transition={{ duration: 16, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 18%, transparent 34%, transparent 100%)",
          backgroundSize: "180% 100%",
        }}
      />
      {[14, 48, 82].map((left, index) => (
        <motion.div
          key={`lamp-${left}`}
          className="absolute top-0 z-10"
          style={{ left: `${left}%` }}
          animate={{ y: [0, 2, 0] }}
          transition={{
            duration: 3.2 + index * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="mx-auto h-14 w-1 rounded-full bg-amber-900/35" />
          <div className="relative h-9 w-12 rounded-b-[1.25rem] rounded-t-sm bg-amber-950/75 shadow-lg">
            <div className="absolute inset-x-2 bottom-1 h-3 rounded-full bg-amber-100/55" />
          </div>
          <motion.div
            className="absolute left-1/2 top-10 h-28 w-24 -translate-x-1/2 rounded-full bg-amber-100/22 blur-2xl"
            animate={{ opacity: [0.3, 0.5, 0.3], scale: [0.95, 1.05, 0.95] }}
            transition={{
              duration: 2.6 + index * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      ))}
      <div className="absolute right-[8%] top-[8%] h-40 w-56 rounded-[2rem] border border-amber-700/25 bg-white/35 shadow-inner backdrop-blur-sm">
        <div className="absolute inset-x-5 top-10 h-1.5 rounded-full bg-amber-700/25" />
        <div className="absolute inset-x-5 top-20 h-1.5 rounded-full bg-amber-700/20" />
        <motion.div
          className="absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/12 to-transparent"
          animate={{ x: [-40, 180, -40] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="absolute right-[20%] top-[13%] z-10 h-4 w-20 rounded-full border border-emerald-100/25 bg-emerald-500/18 shadow-sm backdrop-blur-sm">
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-50/80">
          Open
        </div>
      </div>
      <div className="absolute left-[2%] top-[10%] h-56 w-96 rounded-[2.25rem] bg-[#402113]/80 shadow-2xl">
        <div className="space-y-6 px-10 pt-16">
          <div className="h-4 w-64 rounded-full bg-amber-100/25" />
          <div className="h-4 w-72 rounded-full bg-white/22" />
          <div className="h-4 w-44 rounded-full bg-white/16" />
        </div>
      </div>
      <div className="absolute left-[11%] top-[16%] z-10 h-3 w-44 rounded-full bg-[#6c3b21]/85 shadow-md" />
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={`shelf-cup-${index}`}
          className="absolute left-[12%] top-[13.4%] z-10 h-7 rounded-t-[0.75rem] rounded-b-[0.95rem] bg-amber-100/80 shadow-sm"
          style={{ width: index % 2 === 0 ? 18 : 22, marginLeft: index * 34 }}
          animate={{ y: [0, -1.5, 0] }}
          transition={{
            duration: 2.8 + index * 0.35,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-2 rounded-full bg-amber-50/95" />
        </motion.div>
      ))}
      <div className="absolute left-[15%] bottom-[29.8%] z-10 h-16 w-20 rounded-t-[1.4rem] rounded-b-[0.9rem] bg-slate-800/80 shadow-xl" />
      <div className="absolute left-[16.25%] bottom-[34%] z-10 h-9 w-12 rounded-[0.8rem] bg-slate-700/90" />
      <motion.div
        className="absolute left-[17.1%] bottom-[36.8%] z-10 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.65)]"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {[0, 1, 2].map((index) => (
        <motion.div
          key={`steam-${index}`}
          className="absolute left-[18.2%] bottom-[38.5%] z-10 h-16 w-6 rounded-full border border-white/0 bg-gradient-to-t from-white/0 via-white/22 to-white/0 blur-[1px]"
          style={{ marginLeft: index * 10 }}
          animate={{
            y: [0, -18, -28],
            x: [0, index % 2 === 0 ? -4 : 4, 0],
            opacity: [0, 0.55, 0],
          }}
          transition={{
            duration: 2.8 + index * 0.4,
            repeat: Infinity,
            ease: "easeOut",
            delay: index * 0.35,
          }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#5b260d]" />
      <div className="absolute inset-x-0 bottom-[29%] h-2 rounded-full bg-[#a04b1d]" />
      <div className="absolute left-[60%] bottom-[27.8%] z-10 h-14 w-20 rounded-[1.2rem] bg-amber-900/40 shadow-lg backdrop-blur-sm" />
      <div className="absolute left-[60.8%] bottom-[30.2%] z-10 h-10 w-16 rounded-[0.9rem] border border-amber-100/30 bg-white/12" />
      <div className="absolute left-[73%] bottom-[27.7%] z-10 h-12 w-12 rounded-full bg-emerald-950/45 shadow-lg" />
      <div className="absolute left-[74.2%] bottom-[31.2%] z-10 h-8 w-8 rounded-full bg-emerald-700/70" />
      <div className="absolute left-[74.5%] bottom-[34%] z-10 h-6 w-4 rounded-full bg-emerald-600/85" />
      <motion.div
        className="absolute left-[46%] top-[38%] h-10 w-10 rounded-full bg-amber-200/25 blur-2xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-[8%] bottom-[24%] z-10 h-24 w-14 rounded-t-[1.4rem] rounded-b-[1rem] bg-black/12 blur-md"
        animate={{ opacity: [0.14, 0.24, 0.14] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute right-[8%] bottom-[21%] z-20">
        <motion.div
          animate={
            actorSpeaking
              ? { y: [0, -4, 0], rotate: [0, 1.5, 0] }
              : actorResolved
                ? { scale: [1, 1.03, 1] }
                : { y: [0, -2, 0] }
          }
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative h-52 w-44"
        >
          <div className="absolute left-2 top-[7.8rem] h-12 w-36 rounded-full bg-black/14 blur-xl" />
          <div className="absolute left-[2.4rem] top-3 h-20 w-20 rounded-full bg-amber-100 shadow-sm" />
          <div className="absolute left-[3.35rem] top-[2.9rem] flex gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/60" />
          </div>
          <motion.div
            className="absolute left-[3.55rem] top-[4.25rem] h-1.5 w-5 rounded-full border-b border-slate-900/45"
            animate={
              actorSpeaking
                ? {
                    scaleX: [1, 0.55, 1.15, 0.7, 1],
                    scaleY: [1, 1.3, 0.85, 1.2, 1],
                  }
                : actorResolved
                  ? { scaleX: [1, 1.2, 1], scaleY: [1, 1, 1] }
                  : { scaleX: 1, scaleY: 1 }
            }
            transition={{
              duration: actorSpeaking ? 0.72 : 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ transformOrigin: "center center" }}
          />
          <div className="absolute left-3 top-[5.35rem] h-28 w-[7rem] rounded-t-[2.8rem] rounded-b-[1.3rem] bg-emerald-900 shadow-lg" />
          <div className="absolute left-[1.65rem] top-[6.35rem] h-16 w-[4.3rem] rounded-t-[1.7rem] rounded-b-[1rem] bg-emerald-800/95" />
          <div className="absolute left-[2.4rem] top-[5.95rem] h-9 w-[3.15rem] rounded-full bg-emerald-700/95" />
          <div className="absolute left-0 top-[7.1rem] h-5 w-[4.4rem] rounded-full bg-amber-100 shadow-sm" />
          <motion.div
            className="absolute left-[-1.75rem] top-[7.1rem] h-5 w-[8.3rem] origin-right rounded-full bg-amber-100 shadow-sm"
            animate={
              cupDelivered && !cupResolved
                ? { rotate: [-18, 2, 2], x: [0, 32, 32] }
                : cupResolved
                  ? { rotate: [0, -8, -2], x: [16, -4, -4] }
                  : { rotate: [0, 0, 0], x: [0, 0, 0] }
            }
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          <div className="absolute left-[6.7rem] top-[7.15rem] h-5 w-[3.7rem] rounded-full bg-amber-100 shadow-sm" />
        </motion.div>

        <AnimatePresence>
          {actorSpeaking ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -left-20 top-4 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md"
            >
              Speaking
            </motion.div>
          ) : null}
          {actorConfused ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="absolute -left-12 top-6 rounded-full border border-amber-200/30 bg-amber-100/12 px-3 py-2 text-sm text-amber-50 backdrop-blur-md"
            >
              ?
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="absolute left-[-0.5rem] top-[-0.75rem] rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md">
          Barista
        </div>
      </div>

      <AnimatePresence>
        {cupDelivered ? (
          <motion.div
            key={cupResolved ? "correct" : "wrong"}
            initial={{ x: cupResolved ? 160 : 260, y: -20, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className={`absolute bottom-[23%] z-20 ${cupResolved ? "right-[20%]" : "left-[18%]"}`}
          >
            <motion.div
              animate={
                cupResolved
                  ? { y: [0, -4, 0], boxShadow: ["0 0 0 rgba(16,185,129,0.0)", "0 0 28px rgba(16,185,129,0.35)", "0 0 0 rgba(16,185,129,0.0)"] }
                  : { y: [0, -2, 0] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className={`relative ${cupResolved ? "h-40 w-32" : "h-44 w-32"}`}
            >
              {cupResolved ? (
                <>
                  <div className="absolute left-[0.15rem] top-[1.35rem] h-7 w-28 rounded-full bg-black/10 blur-md" />
                  <div className="absolute left-[0.4rem] top-4 h-[5.5rem] w-[5.5rem] rounded-b-[1.8rem] rounded-t-[1.15rem] bg-amber-100/95 shadow-lg" />
                  <div className="absolute left-0 top-0 h-7 w-24 rounded-full bg-amber-50 shadow-sm" />
                  <div className="absolute right-[-1.1rem] top-8 h-12 w-12 rounded-full border-[7px] border-amber-50 border-l-transparent" />
                  <div className="absolute left-[0.9rem] top-3 h-4 w-10 rounded-full bg-white/35" />
                  <div className="absolute left-[0.9rem] top-[1.8rem] text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-900/65">
                    Tea
                  </div>
                  {[0, 1, 2].map((index) => (
                    <motion.div
                      key={`tea-steam-${index}`}
                      className="absolute left-[0.95rem] top-[-0.15rem] h-14 w-4 rounded-full bg-gradient-to-t from-white/0 via-white/35 to-white/0 blur-[1px]"
                      style={{ marginLeft: index * 8 }}
                      animate={{
                        y: [0, -14 - index * 2, -20 - index * 2],
                        x: [0, index % 2 === 0 ? -3 : 3, 0],
                        opacity: [0, 0.6, 0],
                      }}
                      transition={{
                        duration: 2.4 + index * 0.2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: index * 0.2,
                      }}
                    />
                  ))}
                </>
              ) : (
                <>
                  <div className="absolute left-0 top-5 h-32 w-28 rounded-b-[2rem] rounded-t-[1.25rem] bg-cyan-300/85" />
                  <div className="absolute left-[-0.2rem] top-0 h-8 w-32 rounded-full bg-cyan-400" />
                  <div className="absolute right-[-1.6rem] top-9 h-20 w-20 rounded-full border-8 border-cyan-400 border-l-transparent" />
                  <div className="absolute left-[1.1rem] top-4 h-5 w-14 rounded-full bg-white/28" />
                </>
              )}
              {cupResolved ? (
                <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-lg">
                  <Check className="size-4" />
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className="absolute left-[12%] bottom-[28%] flex gap-3"
        animate={{ opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-7 w-2 rounded-full bg-white/25" />
        <div className="h-10 w-2 rounded-full bg-white/15" />
      </motion.div>
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.div
          key={`dust-${index}`}
          className="absolute z-[5] h-2 w-2 rounded-full bg-white/12 blur-[1px]"
          style={{
            left: `${24 + index * 14}%`,
            top: `${18 + (index % 3) * 10}%`,
          }}
          animate={{
            y: [0, -14 - index * 2, 0],
            x: [0, index % 2 === 0 ? 6 : -6, 0],
            opacity: [0.12, 0.34, 0.12],
          }}
          transition={{
            duration: 7 + index * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function FallbackStage({
  sceneState,
}: {
  sceneState: SpeakSceneState;
}) {
  const stageKey = sceneState.spec.stageKey;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#eff6ff_0%,#c8d7ff_38%,#1e293b_100%)]" />
      <motion.div
        className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        animate={{ scale: [1, 1.1, 1], x: [0, 28, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-4rem] top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-slate-950/45" />
      <div className="absolute inset-x-0 bottom-[28%] h-px bg-white/12" />

      {stageKey === "directions" ? (
        <div className="absolute left-[10%] top-[22%] space-y-4">
          <div className="h-20 w-20 rounded-[1.5rem] border border-white/20 bg-slate-900/20" />
          <div className="h-14 w-40 rounded-[1.5rem] border border-white/15 bg-white/10" />
          <div className="h-2 w-40 rounded-full bg-white/20" />
        </div>
      ) : stageKey === "classroom" ? (
        <div className="absolute left-[10%] top-[18%] h-40 w-[38%] rounded-[2rem] border border-white/20 bg-white/20 shadow-inner" />
      ) : (
        <div className="absolute left-[12%] top-[22%] flex gap-4">
          <div className="h-20 w-20 rounded-[1.5rem] border border-white/20 bg-white/10" />
          <div className="h-28 w-28 rounded-full border border-white/20 bg-white/10" />
        </div>
      )}

      <div className="absolute right-[11%] bottom-[24%]">
        <motion.div
          animate={
            sceneState.actor.state === "speaking"
              ? { y: [0, -4, 0], scale: [1, 1.02, 1] }
              : sceneState.actor.state === "resolved"
                ? { scale: [1, 1.04, 1] }
                : { y: [0, -2, 0] }
          }
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100" />
          <div className="mx-auto mt-2 h-32 w-24 rounded-t-[2rem] rounded-b-[1.25rem] bg-primary/90" />
          <div className="absolute left-1/2 top-6 flex -translate-x-1/2 gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900/60" />
          </div>
          <motion.div
            className="absolute left-1/2 top-11 h-1.5 w-5 -translate-x-1/2 rounded-full bg-slate-900/50"
            animate={
              sceneState.actor.state === "speaking"
                ? {
                    scaleX: [1, 0.55, 1.15, 0.72, 1],
                    scaleY: [1, 1.35, 0.85, 1.25, 1],
                  }
                : { scaleX: 1, scaleY: 1 }
            }
            transition={{
              duration: 0.72,
              repeat: sceneState.actor.state === "speaking" ? Infinity : 0,
              ease: "easeInOut",
            }}
            style={{ transformOrigin: "center center" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function TranscriptDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%", y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: "100%", y: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 28 }}
            className="absolute inset-x-0 bottom-0 top-[18%] overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[28rem] sm:rounded-l-[2rem] sm:rounded-tr-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Transcript
                </p>
                <p className="mt-1 text-sm text-foreground">Conversation history and coaching</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="h-[calc(100%-5rem)] overflow-auto p-4 sm:p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function SpeakMissionStageFrame({
  mission,
  turns,
  stateLabel,
  liveTone,
  studentTurnCount,
  onBack,
  topAction,
  primaryControl,
  secondaryControls,
  transcriptOpen,
  onTranscriptToggle,
  transcriptDrawer,
  helpPrompt,
  repairNotice,
  coachSpeaking = false,
  coachMouthPulseKey = 0,
  onCoachCueChange,
}: SpeakMissionStageFrameProps) {
  const sceneState = useMemo(
    () => buildSceneState(mission, turns, liveTone),
    [liveTone, mission, turns]
  );
  const coachCue = useMemo(
    () =>
      buildMissionCoachCue({
        mission,
        sceneState,
        turns,
        liveTone,
        helpPrompt,
        repairNotice,
        studentTurnCount,
      }),
    [helpPrompt, liveTone, mission, repairNotice, sceneState, studentTurnCount, turns]
  );
  useEffect(() => {
    onCoachCueChange?.(coachCue);
  }, [coachCue, onCoachCueChange]);
  const theme =
    THEME_BY_STAGE[sceneState.spec.stageKey] ?? THEME_BY_STAGE.generic;
  const stagePartnerLabel =
    sceneState.spec.stageKey === "coffee_shop"
      ? "Barista"
      : sceneState.spec.stageKey === "directions"
        ? "Guide"
        : sceneState.spec.stageKey === "classroom"
          ? "Teacher"
          : sceneState.actor.label;
  const showCoachCompanion = mission.mode === "guided";

  return (
    <>
      <div className={`space-y-4 ${showCoachCompanion ? "xl:pl-[18.5rem]" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="rounded-full px-3 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Badge className={`rounded-full px-3 py-1.5 font-semibold ${theme.accentRing} ${theme.accent}`}>
              {stateLabel}
            </Badge>
            {topAction}
          </div>
        </div>

        {showCoachCompanion ? (
          <aside className="hidden xl:fixed xl:bottom-0 xl:left-0 xl:top-16 xl:block xl:w-[17.5rem]">
            <div className="relative h-full overflow-hidden border-r border-sky-200/55 bg-[linear-gradient(180deg,#edf6ff_0%,#d8ebff_42%,#edf6ff_100%)] px-5 py-6 shadow-[18px_0_40px_rgba(148,163,184,0.16)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffffd9_0%,transparent_42%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/35 via-white/10 to-transparent" />
              <CoachAvatarRail
                cue={coachCue}
                speaking={coachSpeaking}
                pulseKey={coachMouthPulseKey}
                personaKey={mission.coachPersonaKey}
                embedded
              />
            </div>
          </aside>
        ) : null}

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
              <div className={`relative min-h-[32rem] ${theme.shell}`}>
                {sceneState.spec.stageKey === "coffee_shop" ? (
                  <CoffeeShopScene sceneState={sceneState} />
                ) : (
                  <FallbackStage sceneState={sceneState} />
                )}

                <div className={`absolute inset-0 bg-gradient-to-b ${theme.mist}`} />
                <MissionHud mission={mission} sceneState={sceneState} />
                <div className="absolute right-4 top-20 z-20 sm:right-6">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onTranscriptToggle}
                    className="rounded-full bg-background/80 px-3 text-foreground shadow-lg backdrop-blur"
                  >
                    <BookText className="mr-2 size-4" />
                    Transcript
                  </Button>
                </div>
                <div className="absolute left-4 right-4 top-[18.5rem] z-20 hidden sm:block">
                  <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs text-white/72 backdrop-blur-md">
                    <span className="font-semibold text-white">Counterpart:</span> {stagePartnerLabel}
                    <span className="mx-2 text-white/35">&middot;</span>
                    <span>{studentTurnCount} learner turns recorded</span>
                  </div>
                </div>
                <SubtitleRail subtitles={sceneState.subtitles} theme={theme} />
              </div>
          </div>

          {showCoachCompanion ? (
            <div className="xl:hidden">
              <CoachAvatarRail
                cue={coachCue}
                speaking={coachSpeaking}
                pulseKey={coachMouthPulseKey}
                personaKey={mission.coachPersonaKey}
                compact
              />
            </div>
          ) : null}

          <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-4 shadow-lg backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">{primaryControl}</div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTranscriptToggle}
                  className="rounded-full"
                >
                  <BookText className="mr-2 size-4" />
                  {transcriptOpen ? "Hide transcript" : "Open transcript"}
                </Button>
              </div>
            </div>
            {secondaryControls ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">{secondaryControls}</div>
            ) : null}
            {!showCoachCompanion && repairNotice ? (
              <div className="mt-3 rounded-[1.25rem] border border-amber-300/40 bg-amber-100/30 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Recovery</p>
                <p className="mt-1">{repairNotice}</p>
              </div>
            ) : null}
            {!showCoachCompanion && helpPrompt ? (
              <div className="mt-3 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Sparkles className="size-4 text-secondary" />
                  Hint
                </div>
                <p className="mt-2 leading-relaxed">{helpPrompt}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <TranscriptDrawer open={transcriptOpen} onClose={onTranscriptToggle}>
        {transcriptDrawer}
      </TranscriptDrawer>
    </>
  );
}

export function SpeakVoicePrimaryControl({
  liveTone,
  onStart,
}: {
  liveTone: SpeakLiveTone;
  onStart: () => void;
}) {
  if (liveTone === "idle") {
    return (
      <Button size="lg" onClick={onStart} className="w-full rounded-full px-6 py-6 text-base">
        <Mic className="mr-2 size-5" />
        Start live conversation
      </Button>
    );
  }

  if (liveTone === "error") {
    return (
      <Button size="lg" onClick={onStart} className="w-full rounded-full px-6 py-6 text-base">
        <Mic className="mr-2 size-5" />
        Reconnect live voice
      </Button>
    );
  }

  const label =
    liveTone === "thinking"
      ? "AI is thinking..."
      : liveTone === "speaking"
        ? "AI is responding out loud"
        : liveTone === "repair"
          ? "Answer again when you are ready"
          : "Mic is live - speak naturally";

  const aiState = liveTone === "speaking" ? "speaking" : liveTone === "thinking" ? "thinking" : "listening";

  return (
    <div className="flex w-full items-center justify-center gap-3 rounded-[2.5rem] border border-primary/20 bg-primary/5 px-6 py-2 text-center shadow-inner overflow-hidden relative">
      <div className="-ml-8 scale-[0.6] origin-center -my-6">
        <AIOrb state={aiState} />
      </div>
      <div className="text-left -ml-2 py-3 z-10">
        <p className="text-sm font-bold text-foreground tracking-tight">{label}</p>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">
          One clear response at a time. The transcript stays in the drawer.
        </p>
      </div>
    </div>
  );
}

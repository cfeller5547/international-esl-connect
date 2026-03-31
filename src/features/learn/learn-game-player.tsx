"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buildGameReview, buildInternalGameScore } from "@/lib/learn-game";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";
import { LearnArcadeStagePlayer } from "@/features/learn/learn-arcade-stage-surface";
import {
  useAnimatedCount,
  useLearnGameAudio,
  usePersistentGameAudioMute,
} from "@/features/learn/use-learn-game-feel";
import { useVoiceRecorder } from "@/features/speak/use-voice-recorder";
import { isArcadeStage } from "@/lib/learn-arcade";
import type {
  AssembleGameStage,
  ChoiceGameStage,
  GameActivityPayload,
  GameMapNode,
  GameStage,
  GameThemeToken,
  LearnGameEvaluation,
  LearnGameReview,
  LearnGameReviewStage,
  MapGameStage,
  MatchGameStage,
  PriorityBoardGameStage,
  SequenceGameStage,
  SpotlightGameStage,
  StateSwitchGameStage,
  VoicePromptGameStage,
} from "@/server/learn-game-types";

type LearnGameActivityType = "lesson" | "practice" | "game" | "speaking" | "writing" | "checkpoint";

type LearnGameActivityItem = {
  id: string;
  activityType: LearnGameActivityType;
  orderIndex: number;
  status: "locked" | "unlocked" | "completed";
};

type LearnGamePlayerProps = {
  unitSlug: string;
  unitTitle: string;
  curriculumTitle: string;
  unitOrder: number;
  canDoStatement: string;
  activities: LearnGameActivityItem[];
  game: GameActivityPayload;
  voiceEnabled: boolean;
  progressStatus: "locked" | "unlocked" | "completed";
  savedReview: LearnGameReview | null;
  completionEndpoint: string;
  fallbackHref?: string;
  nextHref?: string;
  nextLabel?: string;
};

const ACTIVITY_SHORT_LABELS: Record<LearnGameActivityType, string> = {
  lesson: "Lesson",
  practice: "Practice",
  game: "Game",
  speaking: "Speak",
  writing: "Write",
  checkpoint: "Check",
};

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function attemptLabel(attemptNumber: number) {
  return attemptNumber <= 1 ? "First try" : "Retry";
}

function sortStages(
  game: GameActivityPayload,
  stages: LearnGameReviewStage[]
): LearnGameReviewStage[] {
  const reviewById = new Map(stages.map((stage) => [stage.stageId, stage]));

  return game.stages
    .map((stage) => reviewById.get(stage.id))
    .filter((stage): stage is LearnGameReviewStage => Boolean(stage));
}

function stagePreviewLabel(stage: GameStage) {
  return stage.kind === "voice_prompt" || stage.kind === "voice_burst"
    ? stage.targetPhrase
    : stage.title;
}

function describeStageKind(kind: GameStage["kind"]) {
  switch (kind) {
    case "assemble":
      return "Assemble";
    case "choice":
      return "Choose";
    case "match":
      return "Match";
    case "spotlight":
      return "Spot";
    case "state_switch":
      return "Adapt";
    case "sequence":
      return "Order";
    case "priority_board":
      return "Plan";
    case "map":
      return "Route";
    case "voice_prompt":
      return "Say";
    case "lane_runner":
      return "Run";
    case "sort_rush":
      return "Sort";
    case "route_race":
      return "Race";
    case "reaction_pick":
      return "React";
    case "voice_burst":
      return "Burst";
  }
}

function describeGameFlow(game: GameActivityPayload) {
  return game.stages.map((stage) => describeStageKind(stage.kind)).join(", ");
}

function renderOutcomeLabel(outcome: LearnGameReviewStage["outcome"]) {
  return outcome === "strong" ? "Ready" : "One more pass";
}

function getStageSelectionSummary(
  stage: GameStage,
  selections: {
    assembleAssignments: Record<string, string>;
    selectedOptionId: string | null;
    selectedMatches: Record<string, string>;
    spotlightIds: string[];
    stateAssignments: Record<string, string>;
    orderedIds: string[];
    priorityAssignments: Record<string, string>;
    pathIds: string[];
    fallbackOptionId: string | null;
  }
) {
  if (stage.kind === "assemble") {
    const count = Object.keys(selections.assembleAssignments).length;
    return `${count} of ${stage.slots.length} slots filled.`;
  }

  if (stage.kind === "choice") {
    return selections.selectedOptionId ? "Choice selected." : "Choose one option to continue.";
  }

  if (stage.kind === "match") {
    const count = Object.keys(selections.selectedMatches).length;
    return `${count} of ${stage.leftItems.length} rows matched.`;
  }

  if (stage.kind === "spotlight") {
    return stage.selectionMode === "multiple"
      ? `${selections.spotlightIds.length} of ${stage.correctHotspotIds.length} hotspots found.`
      : selections.spotlightIds.length > 0
        ? "Hotspot selected."
        : "Tap the scene to pick a hotspot.";
  }

  if (stage.kind === "state_switch") {
    const count = Object.keys(selections.stateAssignments).length;
    return `${count} of ${stage.states.length} scene states assigned.`;
  }

  if (stage.kind === "sequence") {
    return `${selections.orderedIds.length} of ${stage.items.length} cards placed.`;
  }

  if (stage.kind === "priority_board") {
    const count = Object.keys(selections.priorityAssignments).length;
    return `${count} of ${stage.cards.length} cards placed on the board.`;
  }

  if (stage.kind === "map") {
    return selections.pathIds.length > 0
      ? `${selections.pathIds.length} route stops selected.`
      : "Build the route in order to continue.";
  }

  return selections.fallbackOptionId
    ? "Fallback line selected."
    : "Choose one fallback line to continue.";
}

function canClearStageSelection(
  stage: GameStage,
  selections: {
    assembleAssignments: Record<string, string>;
    selectedMatches: Record<string, string>;
    spotlightIds: string[];
    stateAssignments: Record<string, string>;
    orderedIds: string[];
    priorityAssignments: Record<string, string>;
    pathIds: string[];
    selectedOptionId: string | null;
    fallbackOptionId: string | null;
  }
) {
  if (stage.kind === "assemble") {
    return Object.keys(selections.assembleAssignments).length > 0;
  }

  if (stage.kind === "match") {
    return Object.keys(selections.selectedMatches).length > 0;
  }

  if (stage.kind === "spotlight") {
    return selections.spotlightIds.length > 0;
  }

  if (stage.kind === "state_switch") {
    return Object.keys(selections.stateAssignments).length > 0;
  }

  if (stage.kind === "sequence") {
    return selections.orderedIds.length > 0;
  }

  if (stage.kind === "priority_board") {
    return Object.keys(selections.priorityAssignments).length > 0;
  }

  if (stage.kind === "map") {
    return selections.pathIds.length > 0;
  }

  if (stage.kind === "choice") {
    return Boolean(selections.selectedOptionId);
  }

  return Boolean(selections.fallbackOptionId);
}

function getThemeStyles(theme: GameThemeToken) {
  const styles = {
    ocean: {
      badge: "border-sky-300/70 bg-sky-50 text-sky-700",
      panel: "border-sky-200/70 bg-sky-50/80",
      soft: "bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent",
      accent: "from-sky-600 to-cyan-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(14,116,144,0.65)]",
    },
    mint: {
      badge: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
      panel: "border-emerald-200/70 bg-emerald-50/80",
      soft: "bg-gradient-to-br from-emerald-500/18 via-teal-400/10 to-transparent",
      accent: "from-emerald-600 to-teal-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(5,150,105,0.65)]",
    },
    sunset: {
      badge: "border-orange-300/70 bg-orange-50 text-orange-700",
      panel: "border-orange-200/70 bg-orange-50/80",
      soft: "bg-gradient-to-br from-orange-500/18 via-amber-400/10 to-transparent",
      accent: "from-orange-600 to-amber-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(234,88,12,0.65)]",
    },
    gold: {
      badge: "border-yellow-300/70 bg-yellow-50 text-yellow-800",
      panel: "border-yellow-200/70 bg-yellow-50/85",
      soft: "bg-gradient-to-br from-yellow-500/20 via-amber-300/12 to-transparent",
      accent: "from-yellow-600 to-amber-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(202,138,4,0.65)]",
    },
    sky: {
      badge: "border-blue-300/70 bg-blue-50 text-blue-700",
      panel: "border-blue-200/70 bg-blue-50/80",
      soft: "bg-gradient-to-br from-blue-500/18 via-sky-400/10 to-transparent",
      accent: "from-blue-600 to-sky-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(37,99,235,0.65)]",
    },
    rose: {
      badge: "border-rose-300/70 bg-rose-50 text-rose-700",
      panel: "border-rose-200/70 bg-rose-50/80",
      soft: "bg-gradient-to-br from-rose-500/18 via-pink-400/10 to-transparent",
      accent: "from-rose-600 to-pink-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(225,29,72,0.65)]",
    },
    emerald: {
      badge: "border-green-300/70 bg-green-50 text-green-700",
      panel: "border-green-200/70 bg-green-50/80",
      soft: "bg-gradient-to-br from-green-500/18 via-emerald-400/10 to-transparent",
      accent: "from-green-600 to-emerald-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(22,163,74,0.65)]",
    },
    indigo: {
      badge: "border-indigo-300/70 bg-indigo-50 text-indigo-700",
      panel: "border-indigo-200/70 bg-indigo-50/80",
      soft: "bg-gradient-to-br from-indigo-500/18 via-violet-400/10 to-transparent",
      accent: "from-indigo-600 to-violet-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(79,70,229,0.65)]",
    },
    violet: {
      badge: "border-violet-300/70 bg-violet-50 text-violet-700",
      panel: "border-violet-200/70 bg-violet-50/80",
      soft: "bg-gradient-to-br from-violet-500/18 via-fuchsia-400/10 to-transparent",
      accent: "from-violet-600 to-fuchsia-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(124,58,237,0.65)]",
    },
    coral: {
      badge: "border-red-300/70 bg-red-50 text-red-700",
      panel: "border-red-200/70 bg-red-50/80",
      soft: "bg-gradient-to-br from-red-500/18 via-orange-400/10 to-transparent",
      accent: "from-red-600 to-orange-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(220,38,38,0.65)]",
    },
    teal: {
      badge: "border-teal-300/70 bg-teal-50 text-teal-700",
      panel: "border-teal-200/70 bg-teal-50/80",
      soft: "bg-gradient-to-br from-teal-500/18 via-cyan-400/10 to-transparent",
      accent: "from-teal-600 to-cyan-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(13,148,136,0.65)]",
    },
    amber: {
      badge: "border-amber-300/70 bg-amber-50 text-amber-800",
      panel: "border-amber-200/70 bg-amber-50/85",
      soft: "bg-gradient-to-br from-amber-500/20 via-yellow-300/12 to-transparent",
      accent: "from-amber-600 to-yellow-500",
      glow: "shadow-[0_28px_80px_-48px_rgba(217,119,6,0.65)]",
    },
  } satisfies Record<GameThemeToken, Record<string, string>>;

  return styles[theme];
}

type ThemeStyles = ReturnType<typeof getThemeStyles>;

function ActivityStatusIcon({
  status,
  isCurrent,
}: {
  status: "locked" | "unlocked" | "completed";
  isCurrent: boolean;
}) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-primary" />;
  }

  if (status === "locked") {
    return <LockKeyhole className="size-4 text-muted-foreground" />;
  }

  if (isCurrent) {
    return <Sparkles className="size-4 text-primary" />;
  }

  return <Circle className="size-4 text-muted-foreground" />;
}

function getStageActionLabel(stage: GameStage) {
  return stage.presentation?.ctaLabel ?? stage.presentation?.callToAction;
}

function shouldRevealChoiceDetail(stage: { presentation?: GameStage["presentation"] }) {
  return (stage.presentation?.answerRevealMode ?? "preanswer") === "preanswer";
}

function getResolvedStageTitle(
  stage: GameStage,
  evaluation: LearnGameEvaluation
) {
  if (evaluation.outcome === "strong") {
    return stage.presentation?.resolvedTitle ?? "Stage ready";
  }

  return stage.presentation?.resolvedTitle ?? "One more pass";
}

function getResolvedStageNote(
  stage: GameStage,
  evaluation: LearnGameEvaluation
) {
  if (evaluation.outcome === "strong" && stage.presentation?.resolvedNote) {
    return stage.presentation.resolvedNote;
  }

  return evaluation.coachNote;
}

function BoardHero({
  src,
  alt,
  overlayClassName,
  imageClassName,
  children,
}: {
  src: string;
  alt: string;
  overlayClassName?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.8rem] border border-border/70 bg-background/95">
      <div className="relative aspect-[16/9]">
        <Image
          src={src}
          alt={alt}
          fill
          className={imageClassName ?? "object-cover object-top"}
        />
        <div className={`absolute inset-0 ${overlayClassName ?? "bg-black/5"}`} />
        {children}
      </div>
    </div>
  );
}

function SequenceBuilder({
  stage,
  selectedIds,
  onToggle,
  theme,
}: {
  stage: SequenceGameStage;
  selectedIds: string[];
  onToggle: (id: string) => void;
  theme: ThemeStyles;
}) {
  const selectedItems = selectedIds
    .map((id) => stage.items.find((item) => item.id === id))
    .filter((item): item is { id: string; label: string; detail?: string } => Boolean(item));
  const availableItems = stage.items.filter((item) => !selectedIds.includes(item.id));
  const lanes =
    stage.presentation?.lanes ??
    stage.items.map((item, index) => ({
      id: item.id,
      label: `Step ${index + 1}`,
    }));
  const layoutVariant = stage.presentation?.layoutVariant ?? "generic";
  const laneClassName =
    layoutVariant === "comic"
      ? "rounded-[1.6rem] border border-border/70 bg-white/90 p-4 shadow-sm"
      : layoutVariant === "kanban"
        ? "rounded-[1.6rem] border border-border/70 bg-slate-950/[0.03] p-4"
        : "rounded-[1.6rem] border border-border/70 bg-white/85 p-4";

  return (
    <div className="space-y-5">
      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          {stage.presentation?.helperLabel ?? "Build the board"}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {lanes.map((lane, index) => {
            const item = selectedItems[index] ?? null;

            return (
              <div key={lane.id} className={laneClassName}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {lane.label}
                </p>
                <div className="mt-3 min-h-24 rounded-[1.2rem] border border-dashed border-border/70 bg-background/80 px-3 py-3">
                  {item ? (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onToggle(item.id)}
                    >
                      <p className="font-semibold text-foreground">{item.label}</p>
                      {item.detail ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tap a card below to place it here.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Available cards</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-[1.4rem] border border-border/70 bg-background/90 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/25 ${theme.glow}`}
              onClick={() => onToggle(item.id)}
            >
              <p className="font-semibold text-foreground">{item.label}</p>
              {item.detail ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssembleBuilder({
  stage,
  assignments,
  activeSlotId,
  onSelectSlot,
  onSelectOption,
  onAssignOptionToSlot,
  theme,
}: {
  stage: AssembleGameStage;
  assignments: Record<string, string>;
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onSelectOption: (optionId: string) => void;
  onAssignOptionToSlot: (slotId: string, optionId: string) => void;
  theme: ThemeStyles;
}) {
  const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const optionMap = new Map(stage.options.map((option) => [option.id, option]));
  const usedOptionIds = new Set(Object.values(assignments));
  const availableOptions = stage.options.filter((option) => !usedOptionIds.has(option.id));
  const layoutVariant = stage.presentation?.layoutVariant ?? "generic";
  const slotGridClassName =
    layoutVariant === "slot_strip"
      ? "mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4"
      : layoutVariant === "counter"
        ? "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        : "mt-4 grid gap-3 md:grid-cols-2";
  const availableGridClassName =
    layoutVariant === "slot_strip" || layoutVariant === "counter"
      ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
  const optionPanelTitle =
    layoutVariant === "counter"
      ? "Counter cards"
      : stage.presentation?.helperLabel ?? "Available cards";

  function clearDragState() {
    setDraggedOptionId(null);
    setDragOverSlotId(null);
  }

  function getDraggedOptionId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData("text/plain") || draggedOptionId;
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
              {stage.presentation?.boardTitle ?? "Build the board"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {stage.presentation?.helperText ??
                "Tap a slot first, then place the card that fits it best."}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground/80">
              Drag or tap a card into each slot.
            </p>
          </div>
          <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
            {draggedOptionId ? "Drop into a slot" : activeSlotId ? "Drag or tap" : "Choose a slot"}
          </Badge>
        </div>
        <div className={slotGridClassName}>
          {stage.slots.map((slot) => {
            const assignedOption = assignments[slot.id] ? optionMap.get(assignments[slot.id]) : null;

            return (
              <div
                key={slot.id}
                role="button"
                tabIndex={0}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  dragOverSlotId === slot.id
                    ? "border-primary/45 bg-primary/12 shadow-[0_18px_48px_-30px_rgba(37,99,235,0.55)]"
                    : ""
                } ${
                  activeSlotId === slot.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/70 bg-background/90 hover:bg-muted/20"
                } ${layoutVariant === "slot_strip" ? "min-h-[11.5rem]" : ""}`}
                onClick={() => onSelectSlot(slot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSlot(slot.id);
                  }
                }}
                onDragOver={(event) => {
                  const optionId = getDraggedOptionId(event);
                  if (!optionId) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverSlotId(slot.id);
                }}
                onDragLeave={() => {
                  setDragOverSlotId((current) => (current === slot.id ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const optionId = getDraggedOptionId(event);
                  if (!optionId) {
                    clearDragState();
                    return;
                  }
                  onAssignOptionToSlot(slot.id, optionId);
                  onSelectSlot(slot.id);
                  clearDragState();
                }}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {slot.label}
                </p>
                {slot.detail ? (
                  <p className="mt-1 text-sm text-muted-foreground">{slot.detail}</p>
                ) : null}
                <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/70 bg-background/85 px-3 py-3">
                  {assignedOption ? (
                    <div
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", assignedOption.id);
                        setDraggedOptionId(assignedOption.id);
                      }}
                      onDragEnd={clearDragState}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-semibold text-foreground">{assignedOption.label}</p>
                      {assignedOption.detail ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assignedOption.detail}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tap to fill this slot.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{optionPanelTitle}</p>
        <div className={availableGridClassName}>
          {availableOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              draggable
              className={`rounded-[1.4rem] border border-border/70 bg-background/90 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/20 ${theme.glow} ${
                draggedOptionId === option.id ? "opacity-65 ring-2 ring-primary/20" : "cursor-grab"
              } active:cursor-grabbing`}
              onClick={() => onSelectOption(option.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", option.id);
                setDraggedOptionId(option.id);
              }}
              onDragEnd={clearDragState}
            >
              <p className="font-semibold text-foreground">{option.label}</p>
              {option.detail ? (
                <p className="mt-1 text-sm text-muted-foreground">{option.detail}</p>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchBuilder({
  stage,
  selectedMatches,
  onSelect,
}: {
  stage: MatchGameStage;
  selectedMatches: Record<string, string>;
  onSelect: (leftId: string, rightId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {stage.leftItems.map((leftItem) => {
        const currentRightId = selectedMatches[leftItem.id] ?? null;

        return (
          <div
            key={leftItem.id}
            className="grid gap-3 rounded-[1.45rem] border border-border/70 bg-background/90 px-4 py-4 md:grid-cols-[10.5rem_minmax(0,1fr)] md:items-center"
          >
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{leftItem.label}</p>
              {leftItem.detail ? (
                <p className="text-sm leading-5 text-muted-foreground">{leftItem.detail}</p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {stage.rightItems.map((rightItem) => (
                <button
                  key={rightItem.id}
                  type="button"
                  className={`rounded-[1.1rem] border px-3 py-3 text-left transition ${
                    currentRightId === rightItem.id
                      ? "border-primary/35 bg-primary/10"
                      : "border-border/70 bg-white/95 hover:bg-muted/20"
                  }`}
                  onClick={() => onSelect(leftItem.id, rightItem.id)}
                >
                  <p className="text-[0.98rem] font-semibold leading-6 text-foreground">
                    {rightItem.label}
                  </p>
                  {rightItem.detail ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {rightItem.detail}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpotlightBuilder({
  stage,
  selectedIds,
  onToggle,
  theme,
  defaultAssetRef,
}: {
  stage: SpotlightGameStage;
  selectedIds: string[];
  onToggle: (hotspotId: string) => void;
  theme: ThemeStyles;
  defaultAssetRef?: string;
}) {
  const assetRef = stage.presentation?.assetRef ?? defaultAssetRef;
  const selectedHotspots = stage.hotspots.filter((hotspot) => selectedIds.includes(hotspot.id));

  return (
    <div className="space-y-5">
      {assetRef ? (
        <BoardHero src={assetRef} alt={stage.title} overlayClassName="bg-slate-950/12">
          {stage.hotspots.map((hotspot) => {
            const selected = selectedIds.includes(hotspot.id);

            return (
              <button
                key={hotspot.id}
                type="button"
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg transition ${
                  selected
                    ? "border-white bg-white text-slate-950"
                    : "border-white/80 bg-slate-950/70 text-white hover:bg-slate-950/85"
                }`}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                onClick={() => onToggle(hotspot.id)}
              >
                {hotspot.label}
              </button>
            );
          })}
        </BoardHero>
      ) : null}

      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          {stage.presentation?.boardTitle ?? "Scene board"}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {stage.presentation?.helperText ??
            "Tap the part of the scene that matches the clue, then lock it in."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedHotspots.length > 0 ? (
            selectedHotspots.map((hotspot) => (
              <Badge key={hotspot.id} variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                {hotspot.label}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No hotspot selected yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceBuilder({
  stage,
  selectedOptionId,
  onSelect,
  theme,
  defaultAssetRef,
}: {
  stage: ChoiceGameStage;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
  theme: ThemeStyles;
  defaultAssetRef?: string;
}) {
  const hotspotLayout =
    stage.presentation?.layoutVariant === "scene_hotspots" &&
    stage.presentation.sceneHotspots &&
    stage.presentation.sceneHotspots.length > 0;
  const dialogueLayout = stage.presentation?.layoutVariant === "dialogue_pick";
  const assetRef = stage.presentation?.assetRef ?? defaultAssetRef;
  const revealChoiceDetail = stage.presentation?.answerRevealMode !== "postanswer";
  const gridClassName =
    dialogueLayout
      ? "grid gap-3 lg:grid-cols-3"
      : stage.presentation?.layoutVariant === "comparison_split"
      ? "grid gap-3 lg:grid-cols-2"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {hotspotLayout && assetRef ? (
        <BoardHero src={assetRef} alt={stage.title} overlayClassName="bg-slate-950/10">
          {stage.presentation?.sceneHotspots?.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition ${
                selectedOptionId === hotspot.optionId
                  ? "border-white bg-white text-slate-950"
                  : "border-white/80 bg-slate-950/70 text-white hover:bg-slate-950/85"
              }`}
              style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              onClick={() => onSelect(hotspot.optionId)}
            >
              {hotspot.label}
            </button>
          ))}
        </BoardHero>
      ) : null}

      {dialogueLayout ? (
        <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            {stage.presentation?.boardTitle ?? "Dialogue pick"}
          </p>
          <div className="mt-4 max-w-xl rounded-[1.5rem] border border-border/70 bg-background/95 px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-foreground">
              {stage.presentation?.dialoguePrompt ?? stage.prompt}
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {stage.presentation?.helperText ?? "Pick the reply that best keeps the exchange moving naturally."}
          </p>
        </div>
      ) : null}

      <div className={gridClassName}>
        {stage.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
              selectedOptionId === option.id
                ? "border-primary/35 bg-primary/10"
                : "border-border/70 bg-background/90 hover:-translate-y-0.5 hover:bg-muted/20"
            } ${theme.glow}`}
            onClick={() => onSelect(option.id)}
          >
            <p className="font-semibold text-foreground">{option.label}</p>
            {option.detail && revealChoiceDetail ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.detail}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function StateSwitchBuilder({
  stage,
  assignments,
  activeStateId,
  onSelectState,
  onSelectOption,
  theme,
  defaultAssetRef,
}: {
  stage: StateSwitchGameStage;
  assignments: Record<string, string>;
  activeStateId: string | null;
  onSelectState: (stateId: string) => void;
  onSelectOption: (optionId: string) => void;
  theme: ThemeStyles;
  defaultAssetRef?: string;
}) {
  const activeState = stage.states.find((state) => state.id === activeStateId) ?? stage.states[0] ?? null;
  const activeAsset = activeState?.assetRef ?? stage.presentation?.assetRef ?? defaultAssetRef;

  return (
    <div className="space-y-5">
      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <div className="flex flex-wrap gap-2">
          {stage.states.map((state) => (
            <button
              key={state.id}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeState?.id === state.id
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/70 bg-background/90 text-muted-foreground hover:bg-muted/20"
              }`}
              onClick={() => onSelectState(state.id)}
            >
              {state.label}
            </button>
          ))}
        </div>
        {activeState ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {activeAsset ? (
              <BoardHero src={activeAsset} alt={activeState.label} overlayClassName={`${theme.soft} bg-slate-950/8`} />
            ) : null}
            <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                {stage.presentation?.boardTitle ?? "Scene state"}
              </p>
              <h3 className="text-xl font-semibold text-foreground">{activeState.label}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {activeState.detail ??
                  stage.presentation?.helperText ??
                  "Pick the response that fits this version of the scene best."}
              </p>
              <div className="flex flex-wrap gap-2">
                {stage.states.map((state) => (
                  <Badge
                    key={state.id}
                    variant="outline"
                    className={assignments[state.id] ? `rounded-full px-3 py-1 ${theme.badge}` : "rounded-full px-3 py-1"}
                  >
                    {state.label}
                    {assignments[state.id] ? ": ready" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stage.responseOptions.map((option) => {
          const selected = activeState ? assignments[activeState.id] === option.id : false;

          return (
            <button
              key={option.id}
              type="button"
              className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                selected
                  ? "border-primary/35 bg-primary/10"
                  : "border-border/70 bg-background/90 hover:-translate-y-0.5 hover:bg-muted/20"
              } ${theme.glow}`}
              onClick={() => onSelectOption(option.id)}
            >
              <p className="font-semibold text-foreground">{option.label}</p>
              {option.detail ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.detail}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VoicePromptBuilder({
  stage,
  inputMode,
  voiceEnabled,
  voiceSupported,
  recording,
  pending,
  fallbackOptionId,
  onFallbackSelect,
  onVoiceClick,
  onTryOtherMode,
  theme,
}: {
  stage: VoicePromptGameStage;
  inputMode: "voice" | "fallback";
  voiceEnabled: boolean;
  voiceSupported: boolean;
  recording: boolean;
  pending: boolean;
  fallbackOptionId: string | null;
  onFallbackSelect: (optionId: string) => void;
  onVoiceClick: () => Promise<void>;
  onTryOtherMode: () => void;
  theme: ThemeStyles;
}) {
  const voiceModeLabel = recording ? "Stop and check" : pending ? "Checking..." : "Record once";
  const revealFallbackDetail = shouldRevealChoiceDetail(stage);

  return (
    <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Choose how to finish this line</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {inputMode === "voice"
              ? "Say it once. If the mic is blocked or the line feels awkward, use the quick backup and keep moving."
              : "Use the quick backup if you want a calmer finish. You can switch back to voice at any time."}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/70 bg-background/90 p-1">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              inputMode === "voice"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              if (inputMode !== "voice") {
                onTryOtherMode();
              }
            }}
            disabled={!voiceSupported}
          >
            Say it
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              inputMode === "fallback"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              if (inputMode !== "fallback") {
                onTryOtherMode();
              }
            }}
          >
            Quick backup
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/95 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          {stage.presentation?.helperLabel ?? "Target line"}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">{stage.targetPhrase}</p>
        {stage.requiredPhrases && stage.requiredPhrases.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {stage.requiredPhrases.map((phrase) => (
              <Badge key={phrase} variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                {phrase}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {inputMode === "voice" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
            onClick={onVoiceClick}
            disabled={pending || !voiceEnabled || !voiceSupported}
          >
            <Mic className="size-4" />
            {voiceModeLabel}
          </Button>
          {!voiceEnabled ? (
            <p className="text-sm text-muted-foreground">
              Voice is not available on this plan. The quick backup is ready below.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {stage.fallbackOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                fallbackOptionId === option.id
                  ? "border-primary/35 bg-primary/10"
                  : "border-border/70 bg-background/90 hover:bg-muted/20"
              }`}
              onClick={() => onFallbackSelect(option.id)}
            >
              <p className="font-semibold text-foreground">{option.label}</p>
              {option.detail && revealFallbackDetail ? (
                <p className="mt-1 text-sm text-muted-foreground">{option.detail}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityBoardBuilder({
  stage,
  assignments,
  activeLaneId,
  onSelectLane,
  onToggleCard,
  onAssignCardToLane,
  theme,
}: {
  stage: PriorityBoardGameStage;
  assignments: Record<string, string>;
  activeLaneId: string | null;
  onSelectLane: (laneId: string) => void;
  onToggleCard: (cardId: string) => void;
  onAssignCardToLane: (cardId: string, laneId: string) => void;
  theme: ThemeStyles;
}) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);
  const cardMap = new Map(stage.cards.map((card) => [card.id, card]));
  const unassignedCards = stage.cards.filter((card) => !assignments[card.id]);
  const layoutVariant = stage.presentation?.layoutVariant ?? "generic";
  const laneGridClassName =
    layoutVariant === "planner_dense"
      ? "mt-4 grid gap-3 xl:grid-cols-3"
      : "mt-4 grid gap-3 md:grid-cols-3";
  const availableGridClassName =
    layoutVariant === "planner_dense"
      ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

  function clearDragState() {
    setDraggedCardId(null);
    setDragOverLaneId(null);
  }

  function getDraggedCardId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData("text/plain") || draggedCardId;
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
              {stage.presentation?.boardTitle ?? "Priority board"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {stage.presentation?.helperText ??
                "Pick a lane first, then tap the card that belongs there."}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground/80">
              Drag or tap each card into the lane where it belongs.
            </p>
          </div>
          <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
            {draggedCardId ? "Drop into a lane" : activeLaneId ? "Drag or tap" : "Choose a lane"}
          </Badge>
        </div>
        <div className={laneGridClassName}>
          {stage.lanes.map((lane) => {
            const cards = stage.cards
              .filter((card) => assignments[card.id] === lane.id)
              .map((card) => cardMap.get(card.id) ?? card);

            return (
              <div
                key={lane.id}
                role="button"
                tabIndex={0}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  dragOverLaneId === lane.id
                    ? "border-primary/45 bg-primary/12 shadow-[0_18px_48px_-30px_rgba(37,99,235,0.55)]"
                    : ""
                } ${
                  activeLaneId === lane.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/70 bg-background/90 hover:bg-muted/20"
                }`}
                onClick={() => onSelectLane(lane.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectLane(lane.id);
                  }
                }}
                onDragOver={(event) => {
                  const cardId = getDraggedCardId(event);
                  if (!cardId) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverLaneId(lane.id);
                }}
                onDragLeave={() => {
                  setDragOverLaneId((current) => (current === lane.id ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const cardId = getDraggedCardId(event);
                  if (!cardId) {
                    clearDragState();
                    return;
                  }
                  onAssignCardToLane(cardId, lane.id);
                  onSelectLane(lane.id);
                  clearDragState();
                }}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {lane.label}
                </p>
                <div className="mt-3 space-y-2">
                  {cards.length > 0 ? (
                    cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        draggable
                        className={`w-full rounded-[1rem] border border-border/70 bg-background/85 px-3 py-3 text-left ${
                          draggedCardId === card.id ? "opacity-65 ring-2 ring-primary/20" : "cursor-grab"
                        } active:cursor-grabbing`}
                        onClick={() => {
                          if (activeLaneId && activeLaneId !== lane.id) {
                            onAssignCardToLane(card.id, activeLaneId);
                          }
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", card.id);
                          setDraggedCardId(card.id);
                        }}
                        onDragEnd={clearDragState}
                      >
                        <p className="font-semibold text-foreground">{card.label}</p>
                        {card.detail ? (
                          <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No cards placed yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Available cards</p>
        <div className={availableGridClassName}>
          {unassignedCards.map((card) => (
            <button
              key={card.id}
              type="button"
              draggable
              className={`rounded-[1.4rem] border border-border/70 bg-background/90 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/20 ${theme.glow} ${
                draggedCardId === card.id ? "opacity-65 ring-2 ring-primary/20" : "cursor-grab"
              } active:cursor-grabbing`}
              onClick={() => onToggleCard(card.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", card.id);
                setDraggedCardId(card.id);
              }}
              onDragEnd={clearDragState}
            >
              <p className="font-semibold text-foreground">{card.label}</p>
              {card.detail ? (
                <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapBuilder({
  stage,
  selectedIds,
  onToggle,
  theme,
  defaultAssetRef,
}: {
  stage: MapGameStage;
  selectedIds: string[];
  onToggle: (id: string) => void;
  theme: ThemeStyles;
  defaultAssetRef?: string;
}) {
  const selectedNodes = selectedIds
    .map((id) => stage.nodes.find((node) => node.id === id))
    .filter((node): node is GameMapNode => Boolean(node));
  const availableNodes = stage.nodes.filter((node) => !selectedIds.includes(node.id));
  const nodeMap = new Map(stage.nodes.map((node) => [node.id, node]));
  const selectedIndexById = new Map(selectedIds.map((id, index) => [id, index]));
  const assetRef = stage.presentation?.assetRef ?? defaultAssetRef;

  return (
    <div className="space-y-5">
      {assetRef ? (
        <BoardHero src={assetRef} alt="Map route board" overlayClassName="bg-slate-950/10">
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {stage.presentation?.connections?.map((connection) => {
              const fromNode = nodeMap.get(connection.fromId);
              const toNode = nodeMap.get(connection.toId);
              if (!fromNode || !toNode || typeof fromNode.x !== "number" || typeof toNode.x !== "number" || typeof fromNode.y !== "number" || typeof toNode.y !== "number") {
                return null;
              }

              const fromIndex = selectedIndexById.get(connection.fromId);
              const toIndex = selectedIndexById.get(connection.toId);
              const activeConnection =
                typeof fromIndex === "number" &&
                typeof toIndex === "number" &&
                toIndex === fromIndex + 1;

              return (
                <line
                  key={`${connection.fromId}-${connection.toId}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={activeConnection ? "rgba(37,99,235,0.8)" : "rgba(15,23,42,0.18)"}
                  strokeWidth={activeConnection ? "2.8" : "1.8"}
                  strokeDasharray={activeConnection ? "none" : "4 3"}
                />
              );
            })}
          </svg>
          {stage.nodes.map((node) => {
            if (typeof node.x !== "number" || typeof node.y !== "number") {
              return null;
            }

            const selected = selectedIds.includes(node.id);

            return (
              <button
                key={node.id}
                type="button"
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg transition ${
                  selected
                    ? "border-white bg-white text-slate-950"
                    : "border-white/80 bg-slate-950/70 text-white hover:bg-slate-950/85"
                }`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => onToggle(node.id)}
              >
                {node.label}
              </button>
            );
          })}
        </BoardHero>
      ) : null}

      <div className={`rounded-[1.8rem] border px-5 py-5 ${theme.panel}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          {stage.presentation?.helperLabel ?? "Route path"}
        </p>
        <div className="mt-3 flex min-h-14 flex-wrap gap-2">
          {selectedNodes.length > 0 ? (
            selectedNodes.map((node, index) => (
              <Button
                key={node.id}
                type="button"
                variant="secondary"
                className="rounded-full px-4"
                onClick={() => onToggle(node.id)}
              >
                {index + 1}. {node.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Tap the places in order to build the route.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {availableNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`rounded-[1.4rem] border border-border/70 bg-background/90 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/20 ${theme.glow}`}
            onClick={() => onToggle(node.id)}
          >
            <p className="font-semibold text-foreground">{node.label}</p>
            {node.detail ? (
              <p className="mt-1 text-sm text-muted-foreground">{node.detail}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LearnGamePlayer({
  unitSlug,
  unitTitle,
  curriculumTitle,
  unitOrder,
  canDoStatement,
  activities,
  game,
  voiceEnabled,
  progressStatus,
  savedReview,
  completionEndpoint,
  fallbackHref = "/app/learn",
  nextHref = "/app/learn",
  nextLabel = "Continue to speaking",
}: LearnGamePlayerProps) {
  const {
    isSupported: voiceSupported,
    recording,
    error: recorderError,
    resetError: resetRecorderError,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();
  const initialPhase: "brief" | "game" | "summary" =
    progressStatus === "completed" && savedReview ? "summary" : "brief";
  const [phase, setPhase] = useState<"brief" | "game" | "summary">(initialPhase);
  const [inputMode, setInputMode] = useState<"voice" | "fallback">(
    voiceEnabled && voiceSupported ? "voice" : "fallback"
  );
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [currentEvaluation, setCurrentEvaluation] = useState<LearnGameEvaluation | null>(null);
  const [stageResults, setStageResults] = useState<LearnGameReviewStage[]>(
    savedReview?.stages ?? []
  );
  const [review, setReview] = useState<LearnGameReview | null>(savedReview);
  const [assembleAssignments, setAssembleAssignments] = useState<Record<string, string>>({});
  const [activeAssembleSlotId, setActiveAssembleSlotId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [spotlightIds, setSpotlightIds] = useState<string[]>([]);
  const [stateAssignments, setStateAssignments] = useState<Record<string, string>>({});
  const [activeStateId, setActiveStateId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [priorityAssignments, setPriorityAssignments] = useState<Record<string, string>>({});
  const [activeLaneId, setActiveLaneId] = useState<string | null>(null);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [fallbackOptionId, setFallbackOptionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [structuralFeedback, setStructuralFeedback] = useState<
    "correct" | "incorrect" | "near_miss" | null
  >(null);
  const theme = getThemeStyles(game.theme);
  const currentStage = game.stages[currentStageIndex] ?? null;
  const arcadeStage = currentStage && isArcadeStage(currentStage) ? currentStage : null;
  const currentAssetRef =
    currentStage?.presentation?.assetRef ?? game.assetRefs.scene ?? game.assetRefs.hero;
  const currentAttemptCount = currentStage ? (attemptCounts[currentStage.id] ?? 0) : 0;
  const currentAttemptNumber = currentEvaluation ? currentAttemptCount : currentAttemptCount + 1;
  const gameStepIndex =
    activities.findIndex((entry) => entry.activityType === "game") + 1 || 3;
  const stageProgress = game.stages.length
    ? Math.max(1, Math.round(((currentStageIndex + 1) / game.stages.length) * 100))
    : 0;
  const { muted, toggleMuted } = usePersistentGameAudioMute();
  const { playSfx } = useLearnGameAudio({
    soundSet: arcadeStage?.soundSet ?? game.ambientSet ?? "neutral",
    muted,
    ambientEnabled:
      phase === "game" &&
      Boolean(currentStage) &&
      !arcadeStage &&
      !pending &&
      !currentEvaluation &&
      currentStage?.kind !== "voice_prompt" &&
      currentStage?.kind !== "voice_burst",
    ambientDucked:
      currentStage?.kind === "voice_prompt" ||
      currentStage?.kind === "voice_burst" ||
      recording,
  });
  const { pending: completing, error: completionError, completionState, complete } =
    useLearnActivityCompletion({
      endpoint: completionEndpoint,
      fallbackHref,
      activityType: "game",
      unitTitle,
    });
  const completionScoreTarget = review
    ? review.stages.reduce((total, stage) => total + Math.max(0, stage.scoreDelta ?? 0), 0)
    : 0;
  const completionScore = useAnimatedCount(completionScoreTarget, phase === "summary" && Boolean(review));
  const medalCountTarget = review
    ? review.stages.filter((stage) => stage.medal && stage.medal !== "retry").length
    : 0;
  const medalCount = useAnimatedCount(medalCountTarget, phase === "summary" && Boolean(review), 640);

  useEffect(() => {
    if (!voiceEnabled || !voiceSupported) {
      setInputMode("fallback");
    }
  }, [voiceEnabled, voiceSupported]);

  useEffect(() => {
    if (!recorderError) {
      return;
    }

    setInputMode("fallback");
    setNotice("Microphone access was not available. Use the quick fallback and keep moving.");
  }, [recorderError]);

  useEffect(() => {
    if (!currentEvaluation || arcadeStage) {
      return;
    }

    if (currentEvaluation.outcome === "strong") {
      setStructuralFeedback("correct");
      playSfx("stage_clear");
    } else if (currentEvaluation.nearMiss) {
      setStructuralFeedback("near_miss");
      playSfx("near_miss");
    } else {
      setStructuralFeedback("incorrect");
      playSfx("incorrect");
    }

    const timeout = window.setTimeout(
      () => setStructuralFeedback(null),
      currentEvaluation.nearMiss ? 420 : 360
    );
    return () => window.clearTimeout(timeout);
  }, [arcadeStage, currentEvaluation, playSfx]);

  useEffect(() => {
    if (phase !== "summary" || !review) {
      return;
    }

    playSfx("completion");
  }, [phase, playSfx, review]);

  useEffect(() => {
    setAssembleAssignments({});
    setActiveAssembleSlotId(null);
    setSelectedOptionId(null);
    setSelectedMatches({});
    setSpotlightIds([]);
    setStateAssignments({});
    setActiveStateId(null);
    setOrderedIds([]);
    setPriorityAssignments({});
    setActiveLaneId(null);
    setPathIds([]);
    setFallbackOptionId(null);
    setCurrentEvaluation(null);
    setStructuralFeedback(null);
    setError(null);
    setNotice(null);
    resetRecorderError();

    if (currentStage?.kind === "voice_prompt" || currentStage?.kind === "voice_burst") {
      setInputMode(voiceEnabled && voiceSupported ? "voice" : "fallback");
    }
    if (currentStage?.kind === "state_switch") {
      setActiveStateId(currentStage.states[0]?.id ?? null);
    }
    if (currentStage?.kind === "priority_board") {
      setActiveLaneId(currentStage.lanes[0]?.id ?? null);
    }
    if (currentStage?.kind === "assemble") {
      setActiveAssembleSlotId(currentStage.slots[0]?.id ?? null);
    }
  }, [currentStage, currentStageIndex, resetRecorderError, voiceEnabled, voiceSupported]);

  async function evaluateStage(answer: Record<string, unknown>) {
    if (!currentStage) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/learn/curriculum/game/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitSlug,
          stageId: currentStage.id,
          inputMode:
            currentStage.kind === "voice_prompt" || currentStage.kind === "voice_burst"
              ? inputMode
              : undefined,
          attemptNumber: currentAttemptNumber,
          answer,
        }),
      });

      const payload = (await response.json()) as
        | (LearnGameEvaluation & { error?: never })
        | { error?: { message?: string } };

      if (!response.ok || !("stageId" in payload)) {
        throw new Error(payload.error?.message ?? "Unable to check this stage right now.");
      }

      setAttemptCounts((current) => ({
        ...current,
        [currentStage.id]: currentAttemptNumber,
      }));
      setCurrentEvaluation(payload);

      if (payload.fallbackRecommended) {
        setInputMode("fallback");
        setNotice(payload.coachNote);
      }
    } catch (evaluationError) {
      setError(
        evaluationError instanceof Error
          ? evaluationError.message
          : "Unable to check this stage right now."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleVoiceButton() {
    if (!voiceEnabled || !voiceSupported) {
      setInputMode("fallback");
      return;
    }

    if (!recording) {
      await startRecording();
      return;
    }

    const audio = await stopRecording();
    if (!audio) {
      setInputMode("fallback");
      setNotice("The recording did not finish cleanly. Use the quick fallback instead.");
      return;
    }

    await evaluateStage({
      audioDataUrl: audio.audioDataUrl,
      audioMimeType: audio.audioMimeType,
    });
  }

  function toggleOrderedId(id: string) {
    setOrderedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function assignAssembleOptionToSlot(slotId: string, optionId: string) {
    if (!currentStage || currentStage.kind !== "assemble") {
      return;
    }

    let nextActiveSlotId: string | null = slotId;

    setAssembleAssignments((current) => {
      const next = { ...current };
      for (const [existingSlotId, assignedOptionId] of Object.entries(next)) {
        if (assignedOptionId === optionId) {
          delete next[existingSlotId];
        }
      }
      next[slotId] = optionId;
      nextActiveSlotId =
        currentStage.slots.find((slot) => slot.id !== slotId && !next[slot.id])?.id ?? slotId;
      return next;
    });

    setActiveAssembleSlotId(nextActiveSlotId);
  }

  function fillAssembleSlot(optionId: string) {
    if (!currentStage || currentStage.kind !== "assemble") {
      return;
    }
    const filledSlotIds = new Set(Object.keys(assembleAssignments));
    const targetSlotId =
      activeAssembleSlotId ??
      currentStage.slots.find((slot) => !filledSlotIds.has(slot.id))?.id ??
      currentStage.slots[0]?.id;

    if (!targetSlotId) {
      return;
    }

    assignAssembleOptionToSlot(targetSlotId, optionId);
  }

  function toggleSpotlightId(hotspotId: string) {
    if (!currentStage || currentStage.kind !== "spotlight") {
      return;
    }

    setSpotlightIds((current) => {
      if (currentStage.selectionMode !== "multiple") {
        return current[0] === hotspotId ? [] : [hotspotId];
      }

      return current.includes(hotspotId)
        ? current.filter((entry) => entry !== hotspotId)
        : [...current, hotspotId];
    });
  }

  function fillStateAssignment(optionId: string) {
    if (!currentStage || currentStage.kind !== "state_switch") {
      return;
    }

    let nextActiveStateId: string | null = activeStateId ?? null;

    setStateAssignments((current) => {
      const targetStateId = activeStateId ?? currentStage.states[0]?.id;
      if (!targetStateId) {
        return current;
      }

      const next = {
        ...current,
        [targetStateId]: optionId,
      };
      nextActiveStateId =
        currentStage.states.find((state) => state.id !== targetStateId && !next[state.id])?.id ??
        targetStateId;
      return next;
    });

    setActiveStateId(nextActiveStateId);
  }

  function togglePriorityCard(cardId: string) {
    if (!currentStage || currentStage.kind !== "priority_board") {
      return;
    }

    const targetLaneId = activeLaneId ?? currentStage.lanes[0]?.id;
    if (!targetLaneId) {
      return;
    }

    setPriorityAssignments((current) => ({
      ...current,
      [cardId]: targetLaneId,
    }));
  }

  function assignPriorityCardToLane(cardId: string, laneId: string) {
    if (!currentStage || currentStage.kind !== "priority_board") {
      return;
    }

    setPriorityAssignments((current) => ({
      ...current,
      [cardId]: laneId,
    }));
    setActiveLaneId(laneId);
  }

  function togglePathId(id: string) {
    setPathIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function finalizeCurrentStage() {
    if (!currentStage || !currentEvaluation) {
      return;
    }

    const nextResults = sortStages(game, [
      ...stageResults.filter((stage) => stage.stageId !== currentStage.id),
      currentEvaluation,
    ]);

    setStageResults(nextResults);

    if (currentStageIndex + 1 >= game.stages.length) {
      const nextReview = buildGameReview(game, nextResults);
      setReview(nextReview);
      setPhase("summary");
      return;
    }

    setCurrentStageIndex((current) => current + 1);
  }

  async function handleCompleteGame() {
    if (!review) {
      return;
    }

    await complete({
      unitSlug,
      activityType: "game",
      score: buildInternalGameScore(review.stages),
      responsePayload: {
        gameReview: review,
      },
    });
  }

  const replayStages = review
    ? review.replayStageIds
        .map((stageId) => ({
          stage: game.stages.find((entry) => entry.id === stageId) ?? null,
          review: review.stages.find((entry) => entry.stageId === stageId) ?? null,
        }))
        .filter(
          (
            entry
          ): entry is { stage: GameStage; review: LearnGameReviewStage } =>
            Boolean(entry.stage && entry.review)
        )
    : [];
  const activeStageSelectionSummary = currentStage
    ? getStageSelectionSummary(currentStage, {
        assembleAssignments,
        selectedOptionId,
        selectedMatches,
        spotlightIds,
        stateAssignments,
        orderedIds,
        priorityAssignments,
        pathIds,
        fallbackOptionId,
      })
    : null;
  const activeStageUsesCompactHero =
    currentStage?.kind === "assemble" ||
    currentStage?.kind === "choice" ||
    currentStage?.kind === "match" ||
    currentStage?.kind === "sequence" ||
    currentStage?.kind === "priority_board" ||
    currentStage?.kind === "voice_prompt";
  const activeStageBody =
    currentStage?.kind === "assemble" ? (
      <AssembleBuilder
        key={currentStage.id}
        stage={currentStage}
        assignments={assembleAssignments}
        activeSlotId={activeAssembleSlotId}
        onSelectSlot={setActiveAssembleSlotId}
        onSelectOption={fillAssembleSlot}
        onAssignOptionToSlot={assignAssembleOptionToSlot}
        theme={theme}
      />
    ) : currentStage?.kind === "choice" ? (
      <ChoiceBuilder
        stage={currentStage}
        selectedOptionId={selectedOptionId}
        onSelect={setSelectedOptionId}
        theme={theme}
        defaultAssetRef={currentAssetRef}
      />
    ) : currentStage?.kind === "match" ? (
      <MatchBuilder
        stage={currentStage}
        selectedMatches={selectedMatches}
        onSelect={(leftId, rightId) =>
          setSelectedMatches((current) => ({
            ...current,
            [leftId]: rightId,
          }))
        }
      />
    ) : currentStage?.kind === "spotlight" ? (
      <SpotlightBuilder
        stage={currentStage}
        selectedIds={spotlightIds}
        onToggle={toggleSpotlightId}
        theme={theme}
        defaultAssetRef={currentAssetRef}
      />
    ) : currentStage?.kind === "state_switch" ? (
      <StateSwitchBuilder
        stage={currentStage}
        assignments={stateAssignments}
        activeStateId={activeStateId}
        onSelectState={setActiveStateId}
        onSelectOption={fillStateAssignment}
        theme={theme}
        defaultAssetRef={currentAssetRef}
      />
    ) : currentStage?.kind === "sequence" ? (
      <SequenceBuilder
        stage={currentStage}
        selectedIds={orderedIds}
        theme={theme}
        onToggle={toggleOrderedId}
      />
    ) : currentStage?.kind === "priority_board" ? (
      <PriorityBoardBuilder
        key={currentStage.id}
        stage={currentStage}
        assignments={priorityAssignments}
        activeLaneId={activeLaneId}
        onSelectLane={setActiveLaneId}
        onToggleCard={togglePriorityCard}
        onAssignCardToLane={assignPriorityCardToLane}
        theme={theme}
      />
    ) : currentStage?.kind === "map" ? (
      <MapBuilder
        stage={currentStage}
        selectedIds={pathIds}
        theme={theme}
        defaultAssetRef={currentAssetRef}
        onToggle={togglePathId}
      />
    ) : currentStage?.kind === "voice_prompt" ? (
      <VoicePromptBuilder
        stage={currentStage}
        inputMode={inputMode}
        voiceEnabled={voiceEnabled}
        voiceSupported={voiceSupported}
        recording={recording}
        pending={pending}
        fallbackOptionId={fallbackOptionId}
        onFallbackSelect={setFallbackOptionId}
        theme={theme}
        onVoiceClick={handleVoiceButton}
        onTryOtherMode={() => {
          setInputMode((current) => (current === "voice" ? "fallback" : "voice"));
          setNotice(null);
          setError(null);
          resetRecorderError();
        }}
      />
    ) : null;

  if (completionState) {
    return <LearnActivityTransition state={completionState} />;
  }

  return (
    <div className="space-y-4">
      {phase !== "game" ? (
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link
                href="/app/learn"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 transition hover:border-primary/40 hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to roadmap
              </Link>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
                >
                  Unit {unitOrder}
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Game
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Unit step {gameStepIndex} of {activities.length}
                </span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                {curriculumTitle}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {unitTitle}
              </h1>
              <p className="text-base text-muted-foreground">
                {phase === "summary"
                  ? "Game complete. Carry this language straight into speaking."
                  : "Game. Play the unit game before you move into speaking."}
              </p>
              <p className="text-sm font-medium text-foreground">{canDoStatement}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activities
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((entry) => {
                  const isCurrent = entry.activityType === "game";

                  return (
                    <div
                      key={entry.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        isCurrent
                          ? "border-primary/40 bg-primary/8 text-foreground"
                          : entry.status === "completed"
                            ? "border-border/70 bg-muted/10 text-foreground"
                            : "border-border/60 bg-background/70 text-muted-foreground"
                      }`}
                    >
                      <ActivityStatusIcon status={entry.status} isCurrent={isCurrent} />
                      <span>{ACTIVITY_SHORT_LABELS[entry.activityType]}</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "brief" ? (
        <Card className={`surface-glow border-border/70 bg-card/95 ${theme.glow}`}>
          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_20rem] xl:items-start">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                    Game
                  </Badge>
                  <h2 className="text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                    {game.gameTitle}
                  </h2>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                    {game.introText}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
                    {game.stages.length} short stages
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
                    Built for speaking next
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
                    One compact coaching note when needed
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
                    onClick={() => setPhase("game")}
                  >
                    Start game
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() =>
                      speakText(game.stages.map((stage) => stagePreviewLabel(stage)).join(". "))
                    }
                  >
                    <Volume2 className="size-4" />
                    Hear the key language
                  </Button>
                </div>
              </div>

              <BoardHero
                src={game.assetRefs.hero}
                alt={game.gameTitle}
                overlayClassName={`${theme.soft} bg-slate-950/6`}
                imageClassName="object-cover object-top"
              >
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-slate-950/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
                    <span className="inline-block size-2 rounded-full bg-emerald-300" />
                    Ready in a few minutes
                  </div>
                </div>
              </BoardHero>
            </div>

                <div className={`rounded-[1.6rem] border px-5 py-5 ${theme.panel}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                    What you will play
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Move through the board, then take the same language straight into speaking.
                  </p>
                </div>
                <p className="text-sm font-medium text-foreground">{describeGameFlow(game)}</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {game.stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className="rounded-[1.3rem] border border-border/70 bg-background/95 px-4 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Stage {index + 1}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">{stage.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {stage.presentation?.helperLabel ?? stagePreviewLabel(stage)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "game" && currentStage && arcadeStage ? (
          <LearnArcadeStagePlayer
            backHref="/app/learn"
            game={game}
            stage={arcadeStage}
          stageIndex={currentStageIndex}
          totalStages={game.stages.length}
          unitTitle={unitTitle}
          unitOrder={unitOrder}
          gameStepIndex={gameStepIndex}
          activityCount={activities.length}
          attemptLabel={attemptLabel(currentAttemptNumber)}
          theme={theme}
          voiceEnabled={voiceEnabled}
          evaluation={currentEvaluation}
          pending={pending}
          notice={notice}
          error={error}
          onSubmit={evaluateStage}
          onRetry={() => {
            setCurrentEvaluation(null);
            setError(null);
            setNotice(null);
          }}
          onNext={finalizeCurrentStage}
        />
      ) : null}

      {phase === "game" && currentStage && !arcadeStage ? (
        <div className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-4 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/app/learn"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={toggleMuted}
                  >
                    {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    {muted ? "Sound off" : "Sound on"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {attemptLabel(currentAttemptNumber)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                    Game
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-background/85 px-3 py-1">
                    Stage {currentStageIndex + 1} of {game.stages.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{unitTitle}</p>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {currentStage.title}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unit step {gameStepIndex} of {activities.length}
                  </p>
                </div>
              </div>
              <Progress value={stageProgress} className="h-2.5" />
            </CardContent>
          </Card>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
          <Card className={`surface-glow border-border/70 bg-card/95 ${theme.glow}`}>
            <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <motion.div
                className={`overflow-hidden rounded-[1.9rem] border px-5 py-5 ${theme.panel} ${
                  structuralFeedback === "correct"
                    ? "shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_22px_60px_-44px_rgba(16,185,129,0.45)]"
                    : structuralFeedback === "near_miss"
                      ? "shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_22px_60px_-44px_rgba(251,191,36,0.38)]"
                    : structuralFeedback === "incorrect"
                      ? "shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_22px_60px_-44px_rgba(245,158,11,0.38)]"
                      : ""
                }`}
                animate={
                  structuralFeedback === "correct"
                    ? { scale: [1, 1.015, 1] }
                    : structuralFeedback === "near_miss"
                      ? { scale: [1, 1.01, 1] }
                      : structuralFeedback === "incorrect"
                        ? { x: [0, -6, 6, -4, 4, 0] }
                        : { scale: 1, x: 0 }
                }
                transition={
                  structuralFeedback === "correct"
                    ? { type: "tween", duration: 0.24, ease: "easeOut", times: [0, 0.45, 1] }
                    : structuralFeedback === "near_miss"
                      ? { type: "tween", duration: 0.24, ease: "easeOut", times: [0, 0.45, 1] }
                    : structuralFeedback === "incorrect"
                      ? { duration: 0.28, ease: "easeOut" }
                      : { duration: 0.26, ease: "easeOut" }
                }
              >
                <div
                  className={`grid gap-4 ${
                    activeStageUsesCompactHero ? "xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start" : ""
                  }`}
                >
                  {activeStageUsesCompactHero ? (
                    <BoardHero
                      src={currentAssetRef}
                      alt={currentStage.title}
                      overlayClassName={`${theme.soft} bg-slate-950/8`}
                      imageClassName="object-cover object-top"
                    />
                  ) : null}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                          {game.gameTitle}
                        </Badge>
                        <Badge variant="outline" className="rounded-full bg-background/85 px-3 py-1">
                          {describeStageKind(currentStage.kind)}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          {currentStage.presentation?.boardTitle ?? "Stage board"}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {currentStage.presentation?.helperText ?? currentStage.prompt}
                        </p>
                      </div>
                      {currentStage.presentation?.dialoguePrompt || currentStage.presentation?.scenePrompt ? (
                        <div className="max-w-2xl rounded-[1.35rem] border border-border/70 bg-background/95 px-4 py-4 shadow-sm">
                          <p className="text-sm font-medium leading-6 text-foreground">
                            {currentStage.presentation?.dialoguePrompt ??
                              currentStage.presentation?.scenePrompt}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 24 }}
                    >
                      {activeStageBody}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            {currentStage.kind !== "voice_prompt" ? (
              <div className="flex flex-col gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {activeStageSelectionSummary}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
                  disabled={pending}
                  onClick={async () => {
                    if (currentStage.kind === "assemble") {
                      if (Object.keys(assembleAssignments).length !== currentStage.slots.length) {
                        setError("Fill every slot before you continue.");
                        return;
                      }

                      await evaluateStage({
                        assembleAssignments: Object.entries(assembleAssignments).map(
                          ([slotId, optionId]) => ({
                            slotId,
                            optionId,
                          })
                        ),
                      });
                      return;
                    }

                    if (currentStage.kind === "choice") {
                      if (!selectedOptionId) {
                        setError("Choose one option before you continue.");
                        return;
                      }

                      await evaluateStage({
                        selectedOptionId,
                      });
                      return;
                    }

                    if (currentStage.kind === "match") {
                      if (Object.keys(selectedMatches).length !== currentStage.leftItems.length) {
                        setError("Match every line before you continue.");
                        return;
                      }

                      await evaluateStage({
                        matches: Object.entries(selectedMatches).map(([leftId, rightId]) => ({
                          leftId,
                          rightId,
                        })),
                      });
                      return;
                    }

                    if (currentStage.kind === "spotlight") {
                      if (spotlightIds.length === 0) {
                        setError("Tap the scene before you continue.");
                        return;
                      }

                      await evaluateStage({
                        hotspotIds: spotlightIds,
                      });
                      return;
                    }

                    if (currentStage.kind === "state_switch") {
                      if (Object.keys(stateAssignments).length !== currentStage.states.length) {
                        setError("Assign every scene state before you continue.");
                        return;
                      }

                      await evaluateStage({
                        stateAssignments: Object.entries(stateAssignments).map(
                          ([stateId, optionId]) => ({
                            stateId,
                            optionId,
                          })
                        ),
                      });
                      return;
                    }

                    if (currentStage.kind === "sequence") {
                      if (orderedIds.length !== currentStage.items.length) {
                        setError("Build the full sequence before you continue.");
                        return;
                      }

                      await evaluateStage({
                        orderedIds,
                      });
                      return;
                    }

                    if (currentStage.kind === "priority_board") {
                      if (
                        Object.keys(priorityAssignments).length !== currentStage.cards.length
                      ) {
                        setError("Place every card on the board before you continue.");
                        return;
                      }

                      await evaluateStage({
                        priorityAssignments: Object.entries(priorityAssignments).map(
                          ([cardId, laneId]) => ({
                            cardId,
                            laneId,
                          })
                        ),
                      });
                      return;
                    }

                    if (pathIds.length === 0) {
                      setError("Build a route before you continue.");
                      return;
                    }

                    await evaluateStage({
                      pathIds,
                    });
                  }}
                >
                  <Send className="size-4" />
                  {pending
                    ? "Checking..."
                    : getStageActionLabel(currentStage) ?? "Check stage"}
                </Button>

                {canClearStageSelection(currentStage, {
                  assembleAssignments,
                  selectedOptionId,
                  selectedMatches,
                  spotlightIds,
                  stateAssignments,
                  orderedIds,
                  priorityAssignments,
                  pathIds,
                  fallbackOptionId,
                }) ? (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      if (currentStage.kind === "assemble") {
                        setAssembleAssignments({});
                        setActiveAssembleSlotId(currentStage.slots[0]?.id ?? null);
                      } else if (currentStage.kind === "match") {
                        setSelectedMatches({});
                      } else if (currentStage.kind === "spotlight") {
                        setSpotlightIds([]);
                      } else if (currentStage.kind === "state_switch") {
                        setStateAssignments({});
                        setActiveStateId(currentStage.states[0]?.id ?? null);
                      } else if (currentStage.kind === "sequence") {
                        setOrderedIds([]);
                      } else if (currentStage.kind === "priority_board") {
                        setPriorityAssignments({});
                        setActiveLaneId(currentStage.lanes[0]?.id ?? null);
                      } else if (currentStage.kind === "map") {
                        setPathIds([]);
                      } else if (currentStage.kind === "choice") {
                        setSelectedOptionId(null);
                      }
                      setError(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
                </div>
              </div>
            ) : inputMode === "fallback" ? (
              <div className="flex flex-col gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {activeStageSelectionSummary}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
                  disabled={pending}
                  onClick={async () => {
                    if (!fallbackOptionId) {
                      setError("Choose the line that fits the target phrase before you continue.");
                      return;
                    }

                    await evaluateStage({
                      fallbackOptionId,
                    });
                  }}
                >
                  <Send className="size-4" />
                  {pending
                    ? "Checking..."
                    : getStageActionLabel(currentStage) ?? "Use backup"}
                </Button>
                {fallbackOptionId ? (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      setFallbackOptionId(null);
                      setError(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
                </div>
              </div>
            ) : null}

            {notice ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {notice}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {currentEvaluation ? (
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={
                  currentEvaluation.outcome === "strong"
                    ? { opacity: 1, y: 0, scale: 1 }
                    : currentEvaluation.nearMiss
                      ? { opacity: 1, y: 0, scale: [0.98, 1.02, 1] }
                      : { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -4, 4, 0] }
                }
                transition={
                  currentEvaluation.outcome === "strong"
                    ? { type: "spring", stiffness: 340, damping: 24 }
                    : currentEvaluation.nearMiss
                      ? { type: "tween", duration: 0.28, ease: "easeOut", times: [0, 0.45, 1] }
                      : { duration: 0.28, ease: "easeOut" }
                }
                className={`rounded-[1.6rem] border px-5 py-5 ${theme.panel} ${
                  currentEvaluation.outcome === "strong"
                    ? "shadow-[0_20px_60px_-42px_rgba(37,99,235,0.6)]"
                    : currentEvaluation.nearMiss
                      ? "shadow-[0_18px_48px_-30px_rgba(251,191,36,0.35)]"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full px-3 py-1 ${
                      currentEvaluation.outcome === "strong"
                        ? "border-primary/25 bg-primary/8 text-primary"
                        : currentEvaluation.nearMiss
                          ? "border-amber-300 bg-amber-50 text-amber-950"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {currentEvaluation.nearMiss ? "Close call" : renderOutcomeLabel(currentEvaluation.outcome)}
                  </Badge>
                  {currentEvaluation.resolvedInputMode ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {currentEvaluation.resolvedInputMode === "voice" ? "Voice" : "Fallback"}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex size-2 rounded-full ${
                      currentEvaluation.outcome === "strong" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <p className="text-sm font-semibold text-foreground">
                    {getResolvedStageTitle(currentStage, currentEvaluation)}
                  </p>
                </div>

                {currentEvaluation.transcriptText ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    We heard:{" "}
                    <span className="font-medium text-foreground">
                      {currentEvaluation.transcriptText}
                    </span>
                  </p>
                ) : null}

                <p className="mt-3 text-sm leading-7 text-foreground">
                  {getResolvedStageNote(currentStage, currentEvaluation)}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {currentEvaluation.outcome !== "strong" && currentEvaluation.retryAllowed ? (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setCurrentEvaluation(null);
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      <RefreshCcw className="size-4" />
                      Retry once
                    </Button>
                  ) : null}

                  <Button
                    className={`rounded-full bg-gradient-to-r px-5 text-white ${theme.accent}`}
                    onClick={finalizeCurrentStage}
                  >
                    {currentStageIndex + 1 >= game.stages.length ? "Finish game" : "Next stage"}
                  </Button>
                </div>
              </motion.div>
            ) : null}
            </CardContent>
          </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {phase === "summary" && review ? (
        <Card className={`surface-glow border-border/70 bg-card/95 ${theme.glow}`}>
          <CardContent className="space-y-6 px-6 py-6">
            <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
              <BoardHero
                src={game.assetRefs.summary ?? game.assetRefs.hero}
                alt={`${game.gameTitle} summary`}
                overlayClassName={`${theme.soft} bg-slate-950/12`}
              />
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                className="space-y-3"
              >
                <motion.div
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="inline-flex"
                >
                <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                  Step complete
                </Badge>
                </motion.div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  {game.gameTitle} finished
                </h2>
                <p className="text-base leading-7 text-muted-foreground">
                  {review.bridgeToSpeaking}
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-border/70 bg-background/85 px-4 py-2 text-sm font-medium text-foreground">
                    Score {completionScore}
                  </div>
                  <div className="rounded-full border border-border/70 bg-background/85 px-4 py-2 text-sm font-medium text-foreground">
                    Medals {medalCount}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className={`rounded-[1.5rem] border px-5 py-5 ${theme.panel}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Strength
                </p>
                <p className="mt-3 text-sm leading-7 text-foreground">{review.strength}</p>
              </div>
              <div className={`rounded-[1.5rem] border px-5 py-5 ${theme.panel}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Next focus
                </p>
                <p className="mt-3 text-sm leading-7 text-foreground">{review.nextFocus}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 px-5 py-5">
              <div className="flex items-center gap-2">
                <WandSparkles className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Replay the toughest stages</p>
              </div>
              <div className="mt-4 space-y-3">
                {replayStages.map(({ stage, review: stageReview }) => (
                  <div
                    key={stage.id}
                    className="flex flex-col gap-3 rounded-[1.2rem] border border-border/70 bg-muted/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{stage.title}</p>
                      <p className="text-sm text-muted-foreground">{stageReview.coachNote}</p>
                    </div>
                    <Button
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => {
                        const replayIndex = game.stages.findIndex((entry) => entry.id === stage.id);
                        if (replayIndex === -1) {
                          return;
                        }

                        setCurrentStageIndex(replayIndex);
                        setPhase("game");
                      }}
                    >
                      Replay stage
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {completionError ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {completionError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {progressStatus === "completed" ? (
                <Button
                  asChild
                  size="lg"
                  className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
                >
                  <Link href={nextHref}>
                    <CheckCircle2 className="size-4" />
                    {nextLabel}
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className={`rounded-full bg-gradient-to-r px-6 text-white ${theme.accent}`}
                  onClick={handleCompleteGame}
                  disabled={completing}
                >
                  <CheckCircle2 className="size-4" />
                  {completing ? "Saving..." : nextLabel}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

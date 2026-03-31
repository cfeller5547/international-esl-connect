"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  MessageCircleMore,
  Pause,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAnimatedCount,
  useLearnGameAudio,
  useLearnGameSpeech,
  usePersistentGameAudioMute,
} from "@/features/learn/use-learn-game-feel";
import { getStageResolvedSpeechText } from "@/lib/learn-game-speech";
import { useVoiceRecorder } from "@/features/speak/use-voice-recorder";
import type {
  GameActivityPayload,
  GameChoiceOption,
  GameMapNode,
  LaneRunnerGameStage,
  LearnGameEvaluation,
  ReactionPickGameStage,
  RouteRaceGameStage,
  SortRushGameStage,
  VoiceBurstGameStage,
} from "@/server/learn-game-types";

type ArcadeStage =
  | LaneRunnerGameStage
  | SortRushGameStage
  | RouteRaceGameStage
  | ReactionPickGameStage
  | VoiceBurstGameStage;

type ThemeStyles = {
  badge: string;
  panel: string;
  soft: string;
  accent: string;
  glow: string;
};

type Props = {
  backHref: string;
  game: GameActivityPayload;
  stage: ArcadeStage;
  stageIndex: number;
  totalStages: number;
  unitTitle: string;
  unitOrder: number;
  gameStepIndex: number;
  activityCount: number;
  attemptLabel: string;
  theme: ThemeStyles;
  voiceEnabled: boolean;
  evaluation: LearnGameEvaluation | null;
  pending: boolean;
  notice: string | null;
  error: string | null;
  onSubmit: (answer: Record<string, unknown>) => Promise<void> | void;
  onRetry: () => void;
  onNext: () => void;
};

const GRID_COLUMNS = 5;
type LaneTokenPosition = {
  lane: number;
  column: number;
  direction: -1 | 1;
};

type MovePulse = {
  lane: number;
  column: number;
  pulse: number;
  outcome: "select" | "hit" | "miss" | "near_miss";
};

type TokenPulse = {
  tokenId: string;
  pulse: number;
  outcome: "hit" | "miss" | "near_miss";
};

type AssignmentPulse = {
  laneId: string;
  cardId: string;
  pulse: number;
  outcome: "hit" | "miss" | "near_miss";
};

type NodePulse = {
  nodeId: string;
  pulse: number;
  outcome: "hit" | "miss" | "near_miss";
};

function formatTimer(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, "0")}`;
}

function medalLabel(medal?: LearnGameEvaluation["medal"]) {
  if (medal === "gold") return "Gold";
  if (medal === "silver") return "Silver";
  if (medal === "bronze") return "Bronze";
  return "Retry";
}

function stageObjective(stage: ArcadeStage) {
  return stage.presentation?.helperText ?? stage.prompt;
}

function stageHelperLabel(stage: ArcadeStage, fallback: string) {
  return stage.presentation?.helperLabel ?? fallback;
}

function timerStatusLabel({
  timeRemainingMs,
  pending,
  evaluation,
}: {
  timeRemainingMs: number;
  pending: boolean;
  evaluation: LearnGameEvaluation | null;
}) {
  if (evaluation?.outcome === "strong") {
    return "Cleared";
  }

  if (timeRemainingMs <= 0) {
    return evaluation?.nearMiss ? "Close" : "Time up";
  }

  if (pending) {
    return "Locked";
  }

  return formatTimer(timeRemainingMs);
}

function stageBoardAsset(game: GameActivityPayload, stage: ArcadeStage) {
  return (
    stage.spriteRefs?.board ??
    stage.presentation?.assetRef ??
    game.assetRefs.scene ??
    game.assetRefs.hero
  );
}

function laneColumns(stage: LaneRunnerGameStage) {
  return stage.tokens.reduce<Record<string, number>>((current, token, index) => {
    current[token.id] =
      typeof token.column === "number"
        ? token.column
        : token.role === "target"
          ? Math.min(GRID_COLUMNS - 1, index + 1)
          : Math.max(1, (index % (GRID_COLUMNS - 1)) + 1);
    return current;
  }, {});
}

function laneTokenPositions(stage: LaneRunnerGameStage) {
  const columns = laneColumns(stage);
  return stage.tokens.reduce<Record<string, LaneTokenPosition>>((current, token, index) => {
    current[token.id] = {
      lane: token.lane,
      column: columns[token.id] ?? 0,
      direction: 1,
    };
    return current;
  }, {});
}

function SpriteChip({
  src,
  alt,
  size = 28,
  className = "",
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return null;
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <Image src={src} alt={alt} width={size} height={size} className="object-contain" />
    </span>
  );
}

function CelebrationBurst({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const particles = [
    { left: "12%", top: "18%", size: "1rem", delay: 0 },
    { left: "24%", top: "10%", size: "0.65rem", delay: 0.04 },
    { left: "43%", top: "16%", size: "0.75rem", delay: 0.08 },
    { left: "61%", top: "12%", size: "1rem", delay: 0.12 },
    { left: "76%", top: "20%", size: "0.7rem", delay: 0.16 },
    { left: "88%", top: "14%", size: "0.9rem", delay: 0.2 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <motion.span
        className="absolute left-1/2 top-[18%] size-36 -translate-x-1/2 rounded-full border border-amber-200/18"
        initial={{ opacity: 0, scale: 0.72 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.72, 1.05, 1.18] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <motion.span
        className="absolute inset-x-[22%] top-[24%] h-px bg-gradient-to-r from-transparent via-sky-200/54 to-transparent"
        initial={{ opacity: 0, scaleX: 0.3 }}
        animate={{ opacity: [0, 1, 0], scaleX: [0.3, 1.08, 1.16] }}
        transition={{ duration: 0.82, ease: "easeOut" }}
      />
      {particles.map((particle, index) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          className={`absolute rounded-full ${
            index % 2 === 0 ? "bg-amber-300/32" : "bg-sky-300/24"
          }`}
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
          }}
          initial={{ opacity: 0, scale: 0.72, y: 12 }}
          animate={{ opacity: [0, 1, 0], scale: [0.72, 1.1, 0.9], y: [12, -6, -18] }}
          transition={{ duration: 1.1, delay: particle.delay, ease: "easeOut" }}
        />
      ))}
      <motion.span
        className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/46 to-transparent"
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: [0, 1, 0], scaleX: [0.4, 1, 1.08] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}

function LaneRunnerBoard({
  stage,
  runnerLane,
  runnerColumn,
  tokenPositions,
  collectedIds,
  movePulse,
  tokenPulse,
  onMove,
  locked,
}: {
  stage: LaneRunnerGameStage;
  runnerLane: number;
  runnerColumn: number;
  tokenPositions: Record<string, LaneTokenPosition>;
  collectedIds: string[];
  movePulse: MovePulse | null;
  tokenPulse: TokenPulse | null;
  onMove: (lane: number, column: number) => void;
  locked: boolean;
}) {
  const tokenTravelDuration = Math.max(0.4, ((stage.motionRules?.travelMs ?? 620) / 1000) * 0.88);
  const targetRail =
    stage.targetSequenceIds.length <= 5
      ? stage.targetSequenceIds
          .map((tokenId) => stage.tokens.find((token) => token.id === tokenId))
          .filter((token): token is LaneRunnerGameStage["tokens"][number] => Boolean(token))
      : [];
  const nextTargetId = stage.targetSequenceIds[collectedIds.length] ?? null;
  const nextTarget =
    nextTargetId ? stage.tokens.find((token) => token.id === nextTargetId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-white/12 bg-slate-950/20 px-4 py-3 text-white/80">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
          <Sparkles className="size-3.5 text-sky-200" />
          Start
        </span>
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold">
          <span className="uppercase tracking-[0.14em] text-white/58">Next piece</span>
          {nextTarget ? (
            <>
              <SpriteChip src={stage.spriteRefs?.target} alt={nextTarget.label} size={18} />
              <span className="truncate text-white">{nextTarget.label}</span>
            </>
          ) : (
            <span className="text-emerald-100">Rail complete</span>
          )}
        </div>
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
          Exit
          <ChevronRight className="size-3.5 text-amber-200" />
        </span>
      </div>

      {targetRail.length > 0 ? (
        <div className="rounded-[1.35rem] border border-white/12 bg-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              {stageHelperLabel(stage, "Intro rail")}
            </span>
            {targetRail.map((token, index) => {
              const collected = collectedIds.includes(token.id);
              const activeTarget = !collected && token.id === nextTargetId;
              return (
                <motion.div
                  key={token.id}
                  animate={
                    activeTarget
                      ? { scale: [1, 1.03, 1], y: [0, -2, 0] }
                      : { scale: 1, y: 0 }
                  }
                  transition={
                    activeTarget
                      ? { type: "tween", duration: 0.68, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.22 }
                      : { duration: 0.2, ease: "easeOut" }
                  }
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    collected
                      ? "border-emerald-300/72 bg-emerald-300/20 text-emerald-50"
                      : activeTarget
                        ? "border-sky-300/62 bg-sky-300/16 text-sky-50 shadow-[0_16px_32px_-24px_rgba(56,189,248,0.52)]"
                      : "border-white/14 bg-slate-950/20 text-white/76"
                  }`}
                >
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/12 text-[11px]">
                    {index + 1}
                  </span>
                  <SpriteChip src={stage.spriteRefs?.target} alt={token.label} size={20} />
                  <span>{token.label}</span>
                  {activeTarget ? (
                    <span className="rounded-full border border-sky-300/42 bg-sky-300/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-sky-100/88">
                      Next
                    </span>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2" style={{ gridTemplateColumns: `6.25rem repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}>
        {stage.lanes.map((lane, laneIndex) => (
          <div key={lane.id} className="contents">
            <div className="flex items-center pr-2">
              <div className="w-full rounded-full border border-white/12 bg-white/10 px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.14em] text-white/72">
                {lane.label}
              </div>
            </div>
            {Array.from({ length: GRID_COLUMNS }, (_, columnIndex) => {
              const token = stage.tokens.find(
                (entry) =>
                  tokenPositions[entry.id]?.lane === laneIndex &&
                  tokenPositions[entry.id]?.column === columnIndex
              );
              const cleared = token ? collectedIds.includes(token.id) : false;
              const active = laneIndex === runnerLane && columnIndex === runnerColumn;
              const pulsingCell =
                movePulse?.lane === laneIndex && movePulse.column === columnIndex ? movePulse : null;
              const pulsingToken = tokenPulse && token?.id === tokenPulse.tokenId ? tokenPulse : null;

              return (
                <motion.button
                  key={`${lane.id}-${columnIndex}`}
                  type="button"
                  onClick={() => onMove(laneIndex, columnIndex)}
                  disabled={locked}
                  whileTap={locked ? undefined : { scale: 0.98 }}
                  animate={
                    pulsingCell
                      ? pulsingCell.outcome === "miss"
                        ? { scale: 1, x: [0, -6, 6, -4, 4, 0] }
                        : pulsingCell.outcome === "near_miss"
                          ? { scale: [1, 1.02, 1], x: [0, -2, 2, 0] }
                          : { scale: [1, 1.028, 1], x: 0 }
                      : { scale: 1, x: 0 }
                  }
                  transition={
                    pulsingCell
                      ? pulsingCell.outcome === "miss"
                        ? { duration: 0.28, ease: "easeOut" }
                        : { type: "tween", duration: 0.22, ease: "easeOut", times: [0, 0.5, 1] }
                      : { duration: 0.2, ease: "easeOut" }
                  }
                  className={`relative min-h-20 overflow-hidden rounded-[1.35rem] border transition ${
                    active
                      ? "border-white/85 bg-white/18 shadow-[0_10px_30px_-18px_rgba(255,255,255,0.9)]"
                      : "border-white/12 bg-slate-950/18 hover:border-white/28 hover:bg-white/10"
                  } ${locked ? "cursor-default" : ""}`}
                >
                  {token && !cleared && token.id === nextTargetId ? (
                    <motion.span
                      aria-hidden
                      className="absolute inset-2 rounded-[1.1rem] border border-sky-300/26"
                      animate={{ opacity: [0.22, 0.7, 0.22], scale: [0.96, 1.02, 0.98] }}
                      transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
                    />
                  ) : null}
                  <span className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
                  <span className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-white/16" />
                  {columnIndex === GRID_COLUMNS - 1 ? (
                    <span className="absolute inset-y-3 right-2 w-1 rounded-full bg-gradient-to-b from-sky-300/16 via-white/12 to-amber-200/24" />
                  ) : null}
                  {token && !cleared ? (
                    <motion.span
                      layout="position"
                      initial={{ scale: 0.86, opacity: 0.4 }}
                      animate={
                        pulsingToken
                          ? pulsingToken.outcome === "miss"
                            ? { scale: 1, opacity: 1, x: [0, -6, 6, -4, 4, 0] }
                            : pulsingToken.outcome === "near_miss"
                              ? { scale: [1, 1.03, 1], opacity: 1, x: [0, -2, 2, 0] }
                              : { scale: [1, 1.06, 1], opacity: 1, y: [0, -4, 0] }
                          : { scale: 1, opacity: 1, x: 0, y: 0 }
                      }
                      transition={
                        pulsingToken
                          ? pulsingToken.outcome === "miss"
                            ? { layout: { duration: tokenTravelDuration, ease: "linear" }, duration: 0.28, ease: "easeOut" }
                            : { layout: { duration: tokenTravelDuration, ease: "linear" }, type: "tween", duration: 0.22, ease: "easeOut", times: [0, 0.48, 1] }
                          : { layout: { duration: tokenTravelDuration, ease: "linear" }, duration: tokenTravelDuration }
                      }
                      className={`absolute inset-x-2 top-2 flex flex-col items-start rounded-xl border px-2 py-2 text-left text-xs font-semibold ${
                        token.role === "target"
                          ? "border-emerald-200/25 bg-emerald-300/18 text-emerald-50"
                          : "border-rose-200/20 bg-rose-300/16 text-rose-50"
                      }`}
                    >
                      <SpriteChip
                        src={token.role === "target" ? stage.spriteRefs?.target : stage.spriteRefs?.hazard}
                        alt={token.label}
                        size={24}
                        className="mb-1"
                      />
                      <span>{token.label}</span>
                    </motion.span>
                  ) : null}
                  {active ? (
                    <motion.span
                      layout
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={
                        pulsingCell
                          ? pulsingCell.outcome === "miss"
                            ? { scale: 1, opacity: 1, x: [0, -4, 4, -2, 2, 0] }
                            : { scale: [1, 1.04, 1], opacity: 1 }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={
                        pulsingCell?.outcome === "miss"
                          ? { duration: 0.24, ease: "easeOut" }
                          : { type: "tween", duration: 0.2, ease: "easeOut", times: [0, 0.48, 1] }
                      }
                      className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-white/92 px-2.5 py-2 text-xs font-semibold text-slate-950 shadow-[0_12px_28px_-18px_rgba(255,255,255,0.82)]"
                    >
                      <SpriteChip src={stage.spriteRefs?.player} alt="Player" size={36} />
                      <span>You</span>
                    </motion.span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortRushBoard({
  stage,
  queueCards,
  activeCardId,
  assignments,
  assignmentPulse,
  onFocusCard,
  onAssign,
  locked,
}: {
  stage: SortRushGameStage;
  queueCards: SortRushGameStage["cards"];
  activeCardId: string | null;
  assignments: Record<string, string>;
  assignmentPulse: AssignmentPulse | null;
  onFocusCard: (cardId: string | null) => void;
  onAssign: (laneId: string) => void;
  locked: boolean;
}) {
  const builtStrip = stage.lanes.map((lane) => {
    const card = Object.entries(assignments)
      .filter(([, laneId]) => laneId === lane.id)
      .map(([cardId]) => stage.cards.find((entry) => entry.id === cardId))
      .find(Boolean);

    return { lane, card };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {builtStrip.map(({ lane, card }) => (
          <div
            key={lane.id}
            className="rounded-[1.2rem] border border-white/12 bg-white/10 px-4 py-3 text-white"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{lane.label}</p>
            <div className="mt-2 min-h-10 rounded-xl border border-white/10 bg-slate-950/18 px-3 py-2 text-sm font-semibold">
              {card?.label ?? "Waiting"}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[1.55rem] border border-white/12 bg-slate-950/18 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/62">Conveyor</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {queueCards.map((card, index) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={
                activeCardId === card.id
                  ? { opacity: 1, x: index * 6, scale: [1, 1.03, 1] }
                  : { opacity: 1, x: index * 6, scale: 1 }
              }
              exit={{ opacity: 0, x: -30 }}
              transition={{
                type: activeCardId === card.id ? "tween" : "spring",
                duration: activeCardId === card.id ? 0.2 : undefined,
                ease: activeCardId === card.id ? "easeOut" : undefined,
                times: activeCardId === card.id ? [0, 0.5, 1] : undefined,
              }}
            >
              <button
                type="button"
                draggable={index === 0}
                onClick={() => onFocusCard(card.id)}
                onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                  if (locked) {
                    event.preventDefault();
                    return;
                  }
                  if (index !== 0) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", card.id);
                  onFocusCard(card.id);
                }}
                disabled={locked}
                className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition ${
                  index === 0
                    ? activeCardId === card.id
                      ? "border-white/72 bg-white/95 text-slate-950"
                      : "cursor-grab border-white/45 bg-white/90 text-slate-950"
                    : "border-white/12 bg-white/12 text-white/78"
                }`}
              >
                <SpriteChip
                  src={stage.spriteRefs?.accent ?? stage.spriteRefs?.target}
                  alt={card.label}
                  size={28}
                  className="mb-2"
                />
                <p className="font-semibold">{card.label}</p>
                {card.detail ? <p className="mt-1 text-sm opacity-80">{card.detail}</p> : null}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${stage.lanes.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        {stage.lanes.map((lane, index) => (
          <motion.button
            key={lane.id}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            animate={
              assignmentPulse?.laneId === lane.id
                ? assignmentPulse.outcome === "miss"
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : assignmentPulse.outcome === "near_miss"
                    ? { scale: [1, 1.015, 1], x: [0, -2, 2, 0] }
                    : { scale: [1, 1.03, 1] }
                : { scale: 1, x: 0 }
            }
            transition={
              assignmentPulse?.laneId === lane.id
                ? assignmentPulse.outcome === "miss"
                  ? { duration: 0.26, ease: "easeOut" }
                  : { type: "tween", duration: 0.22, ease: "easeOut", times: [0, 0.48, 1] }
                : { duration: 0.2, ease: "easeOut" }
            }
            onClick={() => onAssign(lane.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (locked) {
                return;
              }
              if (event.dataTransfer.getData("text/plain")) {
                onAssign(lane.id);
              }
            }}
            disabled={locked}
            className="min-h-40 rounded-[1.6rem] border border-white/12 bg-white/12 px-4 py-4 text-left transition hover:border-white/22 hover:bg-white/14"
          >
            <div className="flex items-center gap-2">
              <SpriteChip src={stage.spriteRefs?.accent ?? stage.spriteRefs?.target} alt={lane.label} size={20} />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/64">
                {lane.label}
              </p>
              <span className="ml-auto text-xs text-white/45">Bin {index + 1}</span>
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(assignments)
                .filter(([, laneId]) => laneId === lane.id)
                .map(([cardId]) => stage.cards.find((card) => card.id === cardId))
                .filter(Boolean)
                .map((card) => (
                  <motion.div
                    key={card!.id}
                    animate={
                      assignmentPulse?.cardId === card!.id
                        ? assignmentPulse.outcome === "miss"
                          ? { x: [0, -6, 6, -4, 4, 0] }
                          : assignmentPulse.outcome === "near_miss"
                            ? { scale: [1, 1.018, 1], x: [0, -2, 2, 0] }
                            : { scale: [1, 1.04, 1], y: [0, -3, 0] }
                        : { scale: 1, x: 0, y: 0 }
                    }
                    transition={
                      assignmentPulse?.cardId === card!.id
                        ? assignmentPulse.outcome === "miss"
                          ? { duration: 0.26, ease: "easeOut" }
                          : { type: "tween", duration: 0.2, ease: "easeOut", times: [0, 0.5, 1] }
                        : { duration: 0.2, ease: "easeOut" }
                    }
                    className="rounded-xl bg-white/92 px-3 py-3 text-sm font-semibold text-slate-950"
                  >
                    {card!.label}
                  </motion.div>
                ))}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function RouteRaceBoard({
  stage,
  pathIds,
  nodePulse,
  onSelect,
  locked,
}: {
  stage: RouteRaceGameStage;
  pathIds: string[];
  nodePulse: NodePulse | null;
  onSelect: (nodeId: string) => void;
  locked: boolean;
}) {
  const selectedNodes = pathIds
    .map((id) => stage.nodes.find((node) => node.id === id))
    .filter((node): node is GameMapNode => Boolean(node));
  const correctPathSet = new Set(stage.correctPathIds);
  const correctEdgeSet = new Set(
    stage.correctPathIds.slice(1).map((nodeId, index) => `${stage.correctPathIds[index]}:${nodeId}`)
  );
  const finishNodeLabel =
    stage.pathRules?.finishNodeId
      ? stage.nodes.find((node) => node.id === stage.pathRules?.finishNodeId)?.label ?? null
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {finishNodeLabel ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/28 bg-sky-300/12 px-3 py-2 text-xs font-semibold text-sky-50/90">
            <SpriteChip src={stage.spriteRefs?.target} alt={finishNodeLabel} size={18} />
            Finish: {finishNodeLabel}
          </span>
        ) : null}
        {selectedNodes.length > 0 ? (
          selectedNodes.map((node, index) => (
            <span
              key={node.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-2 text-xs font-semibold text-white/82"
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/12 text-[11px]">
                {index + 1}
              </span>
              {node.label}
            </span>
          ))
        ) : (
          <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-2 text-xs font-semibold text-white/64">
            Trace the route on the board
          </span>
        )}
      </div>

      <div className="relative min-h-[24rem] overflow-hidden rounded-[1.8rem] border border-white/12 bg-slate-950/18">
      <svg className="absolute inset-0 h-full w-full">
        {(stage.presentation?.connections ?? []).map((edge) => {
          const from = stage.nodes.find((node) => node.id === edge.fromId);
          const to = stage.nodes.find((node) => node.id === edge.toId);
          if (!from || !to) return null;
          const forwardKey = `${edge.fromId}:${edge.toId}`;
          const reverseKey = `${edge.toId}:${edge.fromId}`;
          const isCorrectEdge = correctEdgeSet.has(forwardKey) || correctEdgeSet.has(reverseKey);

          return (
            <line
              key={`${edge.fromId}-${edge.toId}`}
              x1={`${from.x ?? 50}%`}
              y1={`${from.y ?? 50}%`}
              x2={`${to.x ?? 50}%`}
              y2={`${to.y ?? 50}%`}
              stroke={isCorrectEdge ? "rgba(125,211,252,0.24)" : "rgba(248,113,113,0.18)"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={isCorrectEdge ? "6 5" : "3 6"}
            />
          );
        })}
        {selectedNodes.map((node, index) => {
          if (index === 0) return null;
          const previous = selectedNodes[index - 1];
          return (
            <line
              key={`${previous.id}-${node.id}`}
              x1={`${previous.x ?? 50}%`}
              y1={`${previous.y ?? 50}%`}
              x2={`${node.x ?? 50}%`}
              y2={`${node.y ?? 50}%`}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {stage.nodes.map((node, index) => (
        <motion.button
          key={node.id}
          type="button"
          layout
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          animate={
            nodePulse?.nodeId === node.id
              ? nodePulse.outcome === "miss"
                ? { x: [0, -6, 6, -4, 4, 0], scale: 1 }
                : nodePulse.outcome === "near_miss"
                  ? { scale: [1, 1.025, 1], x: [0, -2, 2, 0] }
                  : { scale: [1, 1.05, 1], y: [0, -3, 0] }
              : { scale: 1, x: 0, y: 0 }
          }
          transition={
            nodePulse?.nodeId === node.id
              ? nodePulse.outcome === "miss"
                ? { duration: 0.26, ease: "easeOut" }
                : { type: "tween", duration: 0.22, ease: "easeOut", times: [0, 0.48, 1] }
              : { duration: 0.2, ease: "easeOut" }
          }
          style={{
            left: `${node.x ?? 18 + (index % 4) * 22}%`,
            top: `${node.y ?? 24 + Math.floor(index / 4) * 24}%`,
          }}
          onClick={() => onSelect(node.id)}
          disabled={locked}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[1.2rem] border px-3 py-3 text-left shadow-sm transition ${
            nodePulse?.nodeId === node.id && nodePulse.outcome === "miss"
              ? "border-rose-300/70 bg-rose-300/16 text-rose-50"
              : pathIds.includes(node.id)
              ? "border-white/75 bg-white/94 text-slate-950"
              : "border-white/14 bg-white/12 text-white hover:border-white/24 hover:bg-white/16"
          }`}
        >
          <div className="flex items-center gap-2">
            <SpriteChip
              src={
                pathIds.includes(node.id)
                  ? stage.spriteRefs?.target
                  : correctPathSet.has(node.id)
                    ? stage.spriteRefs?.player
                    : stage.spriteRefs?.hazard ?? stage.spriteRefs?.player
              }
              alt={node.label}
              size={22}
            />
            <p className="text-sm font-semibold">{node.label}</p>
          </div>
          {node.detail ? <p className="mt-1 text-xs opacity-80">{node.detail}</p> : null}
          {!pathIds.includes(node.id) && !correctPathSet.has(node.id) ? (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100/72">
              Detour
            </p>
          ) : null}
        </motion.button>
      ))}
      </div>
    </div>
  );
}

function ReactionPickBoard({
  stage,
  currentRound,
  onSelect,
  lockedOptionId,
  feedbackOutcome,
  locked,
}: {
  stage: ReactionPickGameStage;
  currentRound: ReactionPickGameStage["rounds"][number] | null;
  onSelect: (optionId: string) => void;
  lockedOptionId: string | null;
  feedbackOutcome: "hit" | "miss" | "near_miss" | null;
  locked: boolean;
}) {
  if (!currentRound) {
    return (
      <div className="grid min-h-[18rem] place-items-center rounded-[1.6rem] border border-white/12 bg-white/10 px-4 text-center text-sm text-white/82">
        Hold the line. Locking the round result now.
      </div>
    );
  }

  const answerRevealMode = stage.presentation?.answerRevealMode ?? "preanswer";
  const neutralSprite =
    stage.spriteRefs?.neutral ??
    stage.spriteRefs?.accent ??
    stage.spriteRefs?.player ??
    stage.spriteRefs?.target ??
    stage.spriteRefs?.hazard;

  if (stage.interactionModel === "target_tag") {
    return (
      <div className="relative min-h-[22rem] rounded-[1.8rem] border border-white/12 bg-slate-950/18">
        <div className="absolute left-4 top-4 max-w-md rounded-[1.3rem] border border-white/12 bg-white/14 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/84">
              <MessageCircleMore className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
                {stageHelperLabel(stage, "Round prompt")}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{currentRound.prompt}</p>
            </div>
          </div>
          {currentRound.dialoguePrompt ? (
            <p className="mt-2 text-sm text-white/72">{currentRound.dialoguePrompt}</p>
          ) : null}
        </div>
        {currentRound.options.map((option, index) => (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            whileHover={Boolean(lockedOptionId) || locked ? undefined : { y: -2, scale: 1.01 }}
            whileTap={Boolean(lockedOptionId) || locked ? undefined : { scale: 0.985 }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[1.4rem] border px-4 py-3 text-left text-white shadow-sm transition ${
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? "border-emerald-300/70 bg-emerald-400/18"
                  : feedbackOutcome === "near_miss"
                    ? "border-amber-300/70 bg-amber-400/16"
                    : "border-rose-300/70 bg-rose-400/16"
                : "border-white/14 bg-white/14 hover:border-white/30 hover:bg-white/18"
            } ${lockedOptionId && lockedOptionId !== option.id ? "opacity-80" : ""}`}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? { opacity: 1, scale: 1.05, y: 0 }
                  : feedbackOutcome === "near_miss"
                    ? { opacity: 1, scale: [1, 1.03, 1], y: 0 }
                    : { opacity: 1, x: [0, -6, 6, -4, 4, 0], y: 0 }
                : { opacity: 1, scale: 1, y: [0, index % 2 === 0 ? -6 : 6, 0] }
            }
            transition={
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? { type: "spring", stiffness: 340, damping: 22 }
                  : { type: "tween", duration: 0.28, ease: "easeOut", times: [0, 0.45, 1] }
                : { type: "tween", duration: 0.36, delay: index * 0.04 }
            }
            style={{
              left: `${18 + (index % 3) * 30}%`,
              top: `${38 + Math.floor(index / 3) * 28}%`,
            }}
            disabled={Boolean(lockedOptionId) || locked}
          >
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/18 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/78">
                {index + 1}
              </span>
              Tap {index + 1}
            </div>
            <div className="flex items-center gap-2">
              <SpriteChip
                src={
                  lockedOptionId === option.id
                    ? feedbackOutcome === "hit"
                      ? stage.spriteRefs?.target
                      : feedbackOutcome === "near_miss"
                        ? stage.spriteRefs?.accent ?? neutralSprite
                        : stage.spriteRefs?.hazard ?? neutralSprite
                    : neutralSprite
                }
                alt={option.label}
                size={22}
              />
              <p className="font-semibold">{option.label}</p>
            </div>
            {option.detail && (answerRevealMode === "preanswer" || lockedOptionId === option.id) ? (
              <p className="mt-1 text-sm text-white/74">{option.detail}</p>
            ) : null}
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.55rem] border border-white/12 bg-white/14 px-4 py-4 text-white">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/84">
            <MessageCircleMore className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
              {stageHelperLabel(stage, "Round prompt")}
            </p>
            <p className="mt-2 text-lg font-semibold">{currentRound.prompt}</p>
          </div>
        </div>
        {currentRound.dialoguePrompt ? (
          <p className="mt-3 text-sm text-white/74">{currentRound.dialoguePrompt}</p>
        ) : null}
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-10 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/16 to-transparent lg:block" />
        <div className="grid gap-3 lg:grid-cols-3">
        {currentRound.options.map((option: GameChoiceOption, index) => (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            whileHover={Boolean(lockedOptionId) || locked ? undefined : { y: -3, scale: 1.01 }}
            whileTap={Boolean(lockedOptionId) || locked ? undefined : { scale: 0.985 }}
            initial={{ opacity: 0, y: 18 }}
            animate={
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? { opacity: 1, y: 0, scale: 1.05 }
                  : feedbackOutcome === "near_miss"
                    ? { opacity: 1, y: 0, scale: [1, 1.03, 1] }
                    : { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }
                : { opacity: 1, y: 0 }
            }
            transition={
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? { type: "spring", stiffness: 340, damping: 22 }
                  : { type: "tween", duration: 0.28, ease: "easeOut", times: [0, 0.45, 1] }
                : { type: "tween", duration: 0.26, delay: index * 0.05 }
            }
            className={`min-h-36 rounded-[1.5rem] border px-4 py-4 text-left text-white transition ${
              lockedOptionId === option.id
                ? feedbackOutcome === "hit"
                  ? "border-emerald-300/70 bg-emerald-400/18"
                  : feedbackOutcome === "near_miss"
                    ? "border-amber-300/70 bg-amber-400/16"
                    : "border-rose-300/70 bg-rose-400/16"
                : "border-white/14 bg-white/12 hover:border-white/24 hover:bg-white/16"
            } ${lockedOptionId && lockedOptionId !== option.id ? "opacity-80" : ""} ${index === 1 ? "lg:mt-6" : index === 2 ? "lg:mt-10" : ""}`}
            disabled={Boolean(lockedOptionId) || locked}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/78">
                  {index + 1}
                </span>
                Tap {index + 1}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                {stage.presentation?.callToAction ?? "Lock reply"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <SpriteChip
                src={
                  lockedOptionId === option.id
                    ? feedbackOutcome === "hit"
                      ? stage.spriteRefs?.target
                      : feedbackOutcome === "near_miss"
                        ? stage.spriteRefs?.accent ?? neutralSprite
                        : stage.spriteRefs?.hazard ?? neutralSprite
                    : neutralSprite
                }
                alt={option.label}
                size={22}
              />
              <p className="font-semibold leading-snug">{option.label}</p>
            </div>
            {option.detail && (answerRevealMode === "preanswer" || lockedOptionId === option.id) ? (
              <p className="mt-2 text-sm text-white/74">{option.detail}</p>
            ) : null}
          </motion.button>
        ))}
        </div>
      </div>
    </div>
  );
}

function VoiceBurstBoard({
  stage,
  voiceMode,
  recording,
  voiceReady,
  fallbackOptionId,
  onVoiceMode,
  onFallbackOption,
  onSubmit,
}: {
  stage: VoiceBurstGameStage;
  voiceMode: "voice" | "fallback";
  recording: boolean;
  voiceReady: boolean;
  fallbackOptionId: string | null;
  onVoiceMode: (mode: "voice" | "fallback") => void;
  onFallbackOption: (optionId: string | null) => void;
  onSubmit: () => Promise<void>;
}) {
  const selectedFallback = stage.fallbackOptions.find((option) => option.id === fallbackOptionId) ?? null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
      <div className="space-y-3">
        <div className="rounded-[1.55rem] border border-white/12 bg-white/14 px-4 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
            {stageHelperLabel(stage, stage.presentation?.boardTitle ?? "Burst callout")}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <SpriteChip src={stage.spriteRefs?.player ?? stage.spriteRefs?.target} alt="Voice cue" size={40} />
            <p className="text-xl font-semibold leading-tight sm:text-2xl">{stage.targetPhrase}</p>
          </div>
          {stage.requiredPhrases?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {stage.requiredPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-semibold"
                >
                  {phrase}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {voiceMode === "fallback" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {stage.fallbackOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onFallbackOption(option.id)}
                className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                  fallbackOptionId === option.id
                    ? "border-white/72 bg-white/92 text-slate-950"
                    : "border-white/14 bg-white/12 text-white hover:border-white/24 hover:bg-white/16"
                }`}
              >
                <p className="font-semibold">{option.label}</p>
                {option.detail ? <p className="mt-1 text-sm opacity-80">{option.detail}</p> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.2rem] border border-white/12 bg-slate-950/24 px-4 py-3 text-sm text-white/80">
            Record once. If the room is noisy or the mic misses you, switch to quick backup and keep moving.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => {
              if (!voiceReady) {
                return;
              }
              onVoiceMode("voice");
            }}
            className={`rounded-[1.35rem] border px-4 py-3 text-left transition ${
              voiceMode === "voice"
                ? "border-sky-300/58 bg-sky-300/12 text-white shadow-[0_16px_34px_-24px_rgba(56,189,248,0.42)]"
              : "border-white/16 bg-white/10 text-white hover:border-white/28 hover:bg-white/14"
            } ${!voiceReady ? "opacity-78" : ""}`}
          >
            <p className="text-sm font-semibold">Say it</p>
            <p className={`mt-1 text-xs ${voiceMode === "voice" ? "text-white/76" : "text-white/68"}`}>
              {voiceReady ? "Use voice once and keep it short." : "Mic not ready here."}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onVoiceMode("fallback")}
            className={`rounded-[1.35rem] border px-4 py-3 text-left transition ${
              voiceMode === "fallback"
                ? "border-sky-300/58 bg-sky-300/12 text-white shadow-[0_16px_34px_-24px_rgba(56,189,248,0.42)]"
              : "border-white/16 bg-white/10 text-white hover:border-white/28 hover:bg-white/14"
            }`}
          >
            <p className="text-sm font-semibold">Quick backup</p>
            <p className={`mt-1 text-xs ${voiceMode === "fallback" ? "text-white/76" : "text-white/68"}`}>
              Tap the best line and keep moving.
            </p>
          </button>
        </div>

        <div className="rounded-[1.35rem] border border-white/12 bg-slate-950/24 px-4 py-3">
          <p className="text-sm text-white/78">
            {voiceMode === "voice"
              ? "Say one short line, then move on."
              : selectedFallback
                ? `Ready line: ${selectedFallback.label}`
                : "Choose the backup line that sounds ready to say out loud."}
          </p>
          <Button
            type="button"
            className="mt-2 w-full rounded-full bg-white px-5 text-slate-950 hover:bg-white/92"
            onClick={() => void onSubmit()}
            disabled={voiceMode === "fallback" && !fallbackOptionId}
          >
            <Send className="mr-2 size-4" />
            {voiceMode === "voice" ? (recording ? "Stop and check" : "Record once") : "Use quick backup"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LearnArcadeStageSurface({
  backHref,
  game,
  stage,
  stageIndex,
  totalStages,
  unitTitle,
  unitOrder,
  gameStepIndex,
  activityCount,
  attemptLabel,
  theme,
  voiceEnabled,
  evaluation,
  pending,
  notice,
  error,
  onSubmit,
  onRetry,
  onNext,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [timeRemainingMs, setTimeRemainingMs] = useState(stage.timerMs);
  const [livesRemaining, setLivesRemaining] = useState(stage.lives);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboPeak, setComboPeak] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [runnerLane, setRunnerLane] = useState(
    stage.kind === "lane_runner" ? Math.max(0, stage.lanes.length - 1) : 0
  );
  const [runnerColumn, setRunnerColumn] = useState(0);
  const [laneTokenState, setLaneTokenState] = useState<Record<string, LaneTokenPosition>>(
    stage.kind === "lane_runner" ? laneTokenPositions(stage) : {}
  );
  const [collectedIds, setCollectedIds] = useState<string[]>([]);
  const [sortAssignments, setSortAssignments] = useState<Record<string, string>>({});
  const [focusedSortCardId, setFocusedSortCardId] = useState<string | null>(null);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [reactionSelections, setReactionSelections] = useState<Record<string, string>>({});
  const [reactionFeedback, setReactionFeedback] = useState<{
    roundId: string;
    optionId: string;
    outcome: "hit" | "miss" | "near_miss";
  } | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [voiceMode, setVoiceMode] = useState<"voice" | "fallback">(
    voiceEnabled ? "voice" : "fallback"
  );
  const [fallbackOptionId, setFallbackOptionId] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [flash, setFlash] = useState<"hit" | "miss" | "near_miss" | "clear" | null>(null);
  const [movePulse, setMovePulse] = useState<MovePulse | null>(null);
  const [tokenPulse, setTokenPulse] = useState<TokenPulse | null>(null);
  const [assignmentPulse, setAssignmentPulse] = useState<AssignmentPulse | null>(null);
  const [nodePulse, setNodePulse] = useState<NodePulse | null>(null);
  const pulseRef = useRef(0);
  const timeRemainingRef = useRef(stage.timerMs);
  const livesRemainingRef = useRef(stage.lives);
  const comboPeakRef = useRef(0);
  const mistakeCountRef = useRef(0);
  const laneTokenStateRef = useRef<Record<string, LaneTokenPosition>>(
    stage.kind === "lane_runner" ? laneTokenPositions(stage) : {}
  );
  const collectedIdsRef = useRef<string[]>([]);
  const runnerLaneRef = useRef(stage.kind === "lane_runner" ? Math.max(0, stage.lanes.length - 1) : 0);
  const runnerColumnRef = useRef(0);
  const submittedRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const spokenEvaluationKeyRef = useRef<string | null>(null);

  const { muted, toggleMuted } = usePersistentGameAudioMute();
  const {
    isSupported,
    recording,
    error: recorderError,
    resetError,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();
  const { playSfx } = useLearnGameAudio({
    soundSet: stage.soundSet,
    muted,
    ambientEnabled: !paused && !evaluation && !pending && stage.kind !== "voice_burst",
    ambientDucked: stage.kind === "voice_burst" || recording,
  });
  const { speakText: playSpeechText, stopSpeech, speechPending } = useLearnGameSpeech({ muted });
  const queueCards = useMemo(
    () =>
      stage.kind === "sort_rush"
        ? stage.cards.filter((card) => !sortAssignments[card.id]).slice(0, 3)
        : [],
    [sortAssignments, stage]
  );
  const currentSortCard = stage.kind === "sort_rush" ? queueCards[0] ?? null : null;
  const currentRound = stage.kind === "reaction_pick" ? stage.rounds[roundIndex] ?? null : null;
  const boardAsset = stageBoardAsset(game, stage);
  const inputLocked = pending || Boolean(evaluation) || (stage.kind !== "voice_burst" && timeRemainingMs <= 0);
  const timerLabel = timerStatusLabel({ timeRemainingMs, pending, evaluation });
  const animatedStageScore = useAnimatedCount(evaluation?.scoreDelta ?? 0, Boolean(evaluation), 360);
  const animatedComboCarry = useAnimatedCount(comboPeak, Boolean(evaluation), 420);
  const resolvedSpeechText = useMemo(() => getStageResolvedSpeechText(stage), [stage]);
  const statusMessage = error ?? notice ?? localMessage ?? recorderError;
  const flashMode = flash ?? (evaluation?.outcome === "strong" ? "clear" : null);

  const focusSortCard = useCallback(
    (cardId: string | null) => {
      setFocusedSortCardId(cardId);
      if (cardId && !inputLocked) {
        playSfx("select");
      }
    },
    [inputLocked, playSfx]
  );

  const resetStageState = useCallback(() => {
    submittedRef.current = false;
    stopSpeech();
    setPaused(false);
    setTimeRemainingMs(stage.timerMs);
    timeRemainingRef.current = stage.timerMs;
    setLivesRemaining(stage.lives);
    livesRemainingRef.current = stage.lives;
    setScore(0);
    setCombo(0);
    setComboPeak(0);
    comboPeakRef.current = 0;
    setMistakeCount(0);
    mistakeCountRef.current = 0;
    setRunnerLane(stage.kind === "lane_runner" ? Math.max(0, stage.lanes.length - 1) : 0);
    runnerLaneRef.current = stage.kind === "lane_runner" ? Math.max(0, stage.lanes.length - 1) : 0;
    setRunnerColumn(0);
    runnerColumnRef.current = 0;
    const nextLaneTokens = stage.kind === "lane_runner" ? laneTokenPositions(stage) : {};
    setLaneTokenState(nextLaneTokens);
    laneTokenStateRef.current = nextLaneTokens;
    setCollectedIds([]);
    collectedIdsRef.current = [];
    setSortAssignments({});
    setFocusedSortCardId(null);
    setPathIds([]);
    setReactionSelections({});
    setReactionFeedback(null);
    setRoundIndex(0);
    setVoiceMode(voiceEnabled && isSupported ? "voice" : "fallback");
    setFallbackOptionId(null);
    setLocalMessage(null);
    setFlash(null);
    setMovePulse(null);
    setTokenPulse(null);
    setAssignmentPulse(null);
    setNodePulse(null);
    resetError();
  }, [isSupported, resetError, stage, stopSpeech, voiceEnabled]);

  useEffect(() => {
    stopSpeech();
  }, [stage.id, stopSpeech]);

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(
      () => setFlash(null),
      flash === "clear" ? 420 : flash === "near_miss" ? 280 : 220
    );
    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    timeRemainingRef.current = timeRemainingMs;
  }, [timeRemainingMs]);

  useEffect(() => {
    livesRemainingRef.current = livesRemaining;
  }, [livesRemaining]);

  useEffect(() => {
    comboPeakRef.current = comboPeak;
  }, [comboPeak]);

  useEffect(() => {
    mistakeCountRef.current = mistakeCount;
  }, [mistakeCount]);

  useEffect(() => {
    laneTokenStateRef.current = laneTokenState;
  }, [laneTokenState]);

  useEffect(() => {
    collectedIdsRef.current = collectedIds;
  }, [collectedIds]);

  useEffect(() => {
    runnerLaneRef.current = runnerLane;
  }, [runnerLane]);

  useEffect(() => {
    runnerColumnRef.current = runnerColumn;
  }, [runnerColumn]);

  useEffect(() => {
    if (!movePulse) return;
    const timeout = window.setTimeout(() => setMovePulse(null), 220);
    return () => window.clearTimeout(timeout);
  }, [movePulse]);

  useEffect(() => {
    if (!tokenPulse) return;
    const timeout = window.setTimeout(() => setTokenPulse(null), 260);
    return () => window.clearTimeout(timeout);
  }, [tokenPulse]);

  useEffect(() => {
    if (!assignmentPulse) return;
    const timeout = window.setTimeout(() => setAssignmentPulse(null), 260);
    return () => window.clearTimeout(timeout);
  }, [assignmentPulse]);

  useEffect(() => {
    if (!nodePulse) return;
    const timeout = window.setTimeout(() => setNodePulse(null), 260);
    return () => window.clearTimeout(timeout);
  }, [nodePulse]);

  const nextPulseId = useCallback(() => {
    pulseRef.current += 1;
    return pulseRef.current;
  }, []);

  const registerHit = useCallback(() => {
    const nextCombo = Math.min(stage.comboRules.maxCombo, combo + 1);
    setCombo(nextCombo);
    setComboPeak((current) => Math.max(current, nextCombo));
    setScore(
      (current) =>
        current + stage.scoreRules.correct + Math.max(0, nextCombo - 1) * stage.scoreRules.streakBonus
    );
    setFlash("hit");
    if (nextCombo >= 3) {
      playSfx("combo");
    } else {
      playSfx("correct");
    }
  }, [combo, playSfx, stage.comboRules.maxCombo, stage.scoreRules.correct, stage.scoreRules.streakBonus]);

  const registerMiss = useCallback((reason: "miss" | "near_miss" = "miss") => {
    setCombo(0);
    setMistakeCount((current) => current + 1);
    setLivesRemaining((current) => Math.max(0, current - 1));
    setFlash(reason);
    playSfx(reason === "near_miss" ? "near_miss" : "incorrect");
  }, [playSfx]);

  const buildCurrentAnswer = useCallback(() => {
    switch (stage.kind) {
      case "lane_runner":
        return { collectedIds };
      case "sort_rush":
        return {
          sortAssignments: Object.entries(sortAssignments).map(([cardId, laneId]) => ({
            cardId,
            laneId,
          })),
        };
      case "route_race":
        return { pathIds };
      case "reaction_pick":
        return {
          reactionSelections: Object.entries(reactionSelections).map(([roundId, optionId]) => ({
            roundId,
            optionId,
          })),
        };
      case "voice_burst":
        return fallbackOptionId ? { fallbackOptionId } : {};
    }
  }, [collectedIds, fallbackOptionId, pathIds, reactionSelections, sortAssignments, stage.kind]);

  const submitArcade = useCallback(
    async (
      answer: Record<string, unknown>,
      completionPath: "arcade" | "voice" | "fallback" = "arcade"
    ) => {
      if (submittedRef.current || pending || evaluation) {
        return;
      }

      submittedRef.current = true;
      await onSubmit({
        ...answer,
        arcadeMetrics: {
          mistakeCount: mistakeCountRef.current,
          timeRemainingMs: timeRemainingRef.current,
          comboPeak: comboPeakRef.current,
          livesRemaining: livesRemainingRef.current,
          completionPath,
          muteEnabled: muted,
          interactionModel: stage.interactionModel,
        },
      });
    },
    [
      evaluation,
      muted,
      onSubmit,
      pending,
      stage.interactionModel,
    ]
  );

  useEffect(() => {
    if (stage.kind !== "lane_runner" || paused || pending || evaluation) {
      return;
    }

    const travelMs = stage.motionRules?.travelMs ?? 720;
    const timer = window.setInterval(() => {
      const currentTokens = laneTokenStateRef.current;
      const next = Object.fromEntries(
        Object.entries(currentTokens).map(([tokenId, token]) => {
          const nextColumn = token.column + token.direction;
          if (nextColumn < 0) {
            return [tokenId, { ...token, column: 0, direction: 1 }];
          }
          if (nextColumn >= GRID_COLUMNS) {
            return [tokenId, { ...token, column: 0, direction: 1 }];
          }
          return [tokenId, { ...token, column: nextColumn }];
        })
      ) as Record<string, LaneTokenPosition>;

      laneTokenStateRef.current = next;
      setLaneTokenState(next);

      const currentCollectedIds = collectedIdsRef.current;
      const currentRunnerLane = runnerLaneRef.current;
      const currentRunnerColumn = runnerColumnRef.current;
      const collisionToken = stage.tokens.find(
        (token) =>
          !currentCollectedIds.includes(token.id) &&
          next[token.id]?.lane === currentRunnerLane &&
          next[token.id]?.column === currentRunnerColumn
      );

      if (!collisionToken) {
        return;
      }

      const pulse = nextPulseId();
      if (
        collisionToken.role === "target" &&
        collisionToken.id === stage.targetSequenceIds[currentCollectedIds.length]
      ) {
        const nextCollected = [...currentCollectedIds, collisionToken.id];
        collectedIdsRef.current = nextCollected;
        setCollectedIds(nextCollected);
        setMovePulse({
          lane: next[collisionToken.id]?.lane ?? currentRunnerLane,
          column: next[collisionToken.id]?.column ?? currentRunnerColumn,
          pulse,
          outcome: "hit",
        });
        setTokenPulse({ tokenId: collisionToken.id, pulse, outcome: "hit" });
        registerHit();
        if (nextCollected.length === stage.targetSequenceIds.length) {
          void submitArcade({ collectedIds: nextCollected });
        }
        return;
      }

      setMovePulse({
        lane: next[collisionToken.id]?.lane ?? currentRunnerLane,
        column: next[collisionToken.id]?.column ?? currentRunnerColumn,
        pulse,
        outcome: "miss",
      });
      setTokenPulse({ tokenId: collisionToken.id, pulse, outcome: "miss" });
      registerMiss();
    }, Math.max(520, travelMs));

    return () => window.clearInterval(timer);
  }, [
    evaluation,
    nextPulseId,
    paused,
    pending,
    registerHit,
    registerMiss,
    stage,
    submitArcade,
  ]);

  useEffect(() => {
    if (paused || pending || evaluation || stage.kind === "voice_burst") {
      return;
    }

    const timer = window.setInterval(() => {
      const next = Math.max(0, timeRemainingRef.current - 100);
      timeRemainingRef.current = next;
      setTimeRemainingMs(next);
      if (next === 0) {
        void submitArcade(buildCurrentAnswer());
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [buildCurrentAnswer, evaluation, paused, pending, stage.kind, submitArcade]);

  useEffect(() => {
    if (!evaluation && !pending && livesRemaining === 0 && stage.kind !== "voice_burst") {
      void submitArcade(buildCurrentAnswer());
    }
  }, [buildCurrentAnswer, evaluation, livesRemaining, pending, stage.kind, submitArcade]);

  useEffect(() => {
    if (!evaluation) {
      return;
    }

    if (evaluation.outcome === "strong") {
      playSfx("stage_clear");
      window.setTimeout(() => playSfx("completion"), 150);
    } else if (evaluation.nearMiss) {
      playSfx("near_miss");
    } else {
      playSfx("incorrect");
    }
  }, [evaluation, playSfx]);

  useEffect(() => {
    if (!evaluation || evaluation.outcome !== "strong" || !resolvedSpeechText) {
      return;
    }

    const evaluationKey = `${stage.id}:${evaluation.attemptNumber}`;
    if (spokenEvaluationKeyRef.current === evaluationKey) {
      return;
    }

    spokenEvaluationKeyRef.current = evaluationKey;
    const timeout = window.setTimeout(() => {
      void playSpeechText(resolvedSpeechText);
    }, 430);

    return () => window.clearTimeout(timeout);
  }, [evaluation, playSpeechText, resolvedSpeechText, stage.id]);

  const handleReplayResolvedSpeech = useCallback(async () => {
    if (!resolvedSpeechText) {
      return;
    }

    setLocalMessage(null);
    const played = await playSpeechText(resolvedSpeechText, { ignoreMute: true });
    if (!played) {
      setLocalMessage("Speech playback is not available right now.");
    }
  }, [playSpeechText, resolvedSpeechText]);

  const moveRunner = useCallback((nextLane: number, nextColumn: number) => {
    if (stage.kind !== "lane_runner" || paused || pending || evaluation || timeRemainingMs <= 0) return;
    if (nextLane < 0 || nextLane >= stage.lanes.length || nextColumn < 0 || nextColumn >= GRID_COLUMNS) return;
    if (Math.abs(nextLane - runnerLane) + Math.abs(nextColumn - runnerColumn) !== 1) return;

    const movePulseId = nextPulseId();
    setMovePulse({ lane: nextLane, column: nextColumn, pulse: movePulseId, outcome: "select" });
    setRunnerLane(nextLane);
    setRunnerColumn(nextColumn);
    runnerLaneRef.current = nextLane;
    runnerColumnRef.current = nextColumn;

    const token = stage.tokens.find(
      (entry) =>
        laneTokenState[entry.id]?.lane === nextLane && laneTokenState[entry.id]?.column === nextColumn
    );
    if (!token || collectedIds.includes(token.id)) {
      playSfx("select");
      return;
    }

    if (token.role === "target" && token.id === stage.targetSequenceIds[collectedIds.length]) {
      const nextCollected = [...collectedIds, token.id];
      collectedIdsRef.current = nextCollected;
      setCollectedIds(nextCollected);
      setMovePulse({ lane: nextLane, column: nextColumn, pulse: movePulseId, outcome: "hit" });
      setTokenPulse({ tokenId: token.id, pulse: movePulseId, outcome: "hit" });
      registerHit();
      if (nextCollected.length === stage.targetSequenceIds.length) {
        void submitArcade({ collectedIds: nextCollected });
      }
      return;
    }

    setMovePulse({ lane: nextLane, column: nextColumn, pulse: movePulseId, outcome: "miss" });
    setTokenPulse({ tokenId: token.id, pulse: movePulseId, outcome: "miss" });
    registerMiss();
  }, [
    collectedIds,
    evaluation,
    laneTokenState,
    nextPulseId,
    paused,
    pending,
    playSfx,
    registerHit,
    registerMiss,
    runnerColumn,
    runnerLane,
    stage,
    submitArcade,
    timeRemainingMs,
  ]);

  const assignSort = useCallback((laneId: string) => {
    if (
      stage.kind !== "sort_rush" ||
      !currentSortCard ||
      paused ||
      pending ||
      evaluation ||
      timeRemainingMs <= 0
    ) {
      return;
    }

    const nextAssignments = { ...sortAssignments, [currentSortCard.id]: laneId };
    const correctLaneId = stage.correctAssignments.find((entry) => entry.cardId === currentSortCard.id)?.laneId;
    const pulse = nextPulseId();
    setSortAssignments(nextAssignments);
    setFocusedSortCardId(null);
    if (correctLaneId === laneId) {
      setAssignmentPulse({ laneId, cardId: currentSortCard.id, pulse, outcome: "hit" });
      playSfx("snap");
      registerHit();
    } else {
      setAssignmentPulse({ laneId, cardId: currentSortCard.id, pulse, outcome: "miss" });
      registerMiss();
    }

    if (Object.keys(nextAssignments).length === stage.cards.length) {
      void submitArcade({
        sortAssignments: Object.entries(nextAssignments).map(([cardId, assignedLaneId]) => ({
          cardId,
          laneId: assignedLaneId,
        })),
      });
    }
  }, [
    currentSortCard,
    evaluation,
    nextPulseId,
    paused,
    pending,
    playSfx,
    registerHit,
    registerMiss,
    sortAssignments,
    stage,
    submitArcade,
    timeRemainingMs,
  ]);

  const selectNode = useCallback((nodeId: string) => {
    if (stage.kind !== "route_race" || paused || pending || evaluation || timeRemainingMs <= 0) return;

    const lastNodeId = pathIds[pathIds.length - 1];
    const expectedId = stage.correctPathIds[pathIds.length];
    const connections = stage.presentation?.connections ?? [];
    const connected =
      !lastNodeId ||
      connections.length === 0 ||
      connections.some(
        (edge) =>
          (edge.fromId === lastNodeId && edge.toId === nodeId) ||
          (edge.toId === lastNodeId && edge.fromId === nodeId)
      );

    const pulse = nextPulseId();

    if (nodeId === expectedId && connected) {
      const nextPath = [...pathIds, nodeId];
      setPathIds(nextPath);
      setNodePulse({ nodeId, pulse, outcome: "hit" });
      playSfx("route_confirm");
      registerHit();
      if (nextPath.length === stage.correctPathIds.length) {
        void submitArcade({ pathIds: nextPath });
      }
      return;
    }

    const routeOutcome =
      connected && stage.correctPathIds.includes(nodeId) && nodeId !== expectedId ? "near_miss" : "miss";
    setNodePulse({
      nodeId,
      pulse,
      outcome: routeOutcome,
    });
    registerMiss(routeOutcome);
  }, [
    evaluation,
    nextPulseId,
    pathIds,
    paused,
    pending,
    playSfx,
    registerHit,
    registerMiss,
    stage,
    submitArcade,
    timeRemainingMs,
  ]);

  const selectReaction = useCallback((optionId: string) => {
    if (
      stage.kind !== "reaction_pick" ||
      !currentRound ||
      paused ||
      pending ||
      evaluation ||
      reactionFeedback ||
      timeRemainingMs <= 0
    ) {
      return;
    }

    const selectedOption = currentRound.options.find((option) => option.id === optionId);
    const nearMiss = selectedOption?.isNearMiss === true;
    const outcome =
      optionId === currentRound.correctOptionId ? "hit" : nearMiss ? "near_miss" : "miss";
    const nextSelections = { ...reactionSelections, [currentRound.id]: optionId };

    playSfx("select");
    setReactionFeedback({
      roundId: currentRound.id,
      optionId,
      outcome,
    });
    setReactionSelections(nextSelections);

    if (outcome === "hit") {
      registerHit();
    } else {
      registerMiss(outcome);
    }

    const isFinalRound = Object.keys(nextSelections).length === stage.rounds.length;

    const finishSelection = () => {
      if (isFinalRound) {
        void submitArcade({
          reactionSelections: Object.entries(nextSelections).map(([roundId, selectedOptionId]) => ({
            roundId,
            optionId: selectedOptionId,
          })),
        });
        return;
      }

      setReactionFeedback(null);
      setRoundIndex((current) => current + 1);
    };

    window.setTimeout(finishSelection, outcome === "hit" ? 220 : 280);
  }, [
    currentRound,
    evaluation,
    paused,
    pending,
    playSfx,
    reactionFeedback,
    reactionSelections,
    registerHit,
    registerMiss,
    stage,
    submitArcade,
    timeRemainingMs,
  ]);

  const handleVoiceBurst = useCallback(async () => {
    if (stage.kind !== "voice_burst" || pending || evaluation || submittedRef.current) return;

    if (voiceMode === "fallback") {
      if (!fallbackOptionId) return;
      await submitArcade({ fallbackOptionId }, "fallback");
      return;
    }

    if (!voiceEnabled || !isSupported) {
      setVoiceMode("fallback");
      setLocalMessage("Voice is not available here. Use the quick backup.");
      return;
    }

    if (!recording) {
      await startRecording();
      return;
    }

    const audioClip = await stopRecording();
    if (!audioClip) {
      setVoiceMode("fallback");
      setLocalMessage("The recording did not finish cleanly. Use the quick backup.");
      return;
    }

    await submitArcade(
      {
        audioDataUrl: audioClip.audioDataUrl,
        audioMimeType: audioClip.audioMimeType,
      },
      "voice"
    );
  }, [
    evaluation,
    fallbackOptionId,
    isSupported,
    pending,
    recording,
    stage,
    startRecording,
    stopRecording,
    submitArcade,
    voiceEnabled,
    voiceMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pending || evaluation || timeRemainingMs <= 0) {
        return;
      }

      if (stage.kind === "lane_runner") {
        if (event.key === "ArrowLeft") moveRunner(runnerLane, runnerColumn - 1);
        if (event.key === "ArrowRight") moveRunner(runnerLane, runnerColumn + 1);
        if (event.key === "ArrowUp") moveRunner(runnerLane - 1, runnerColumn);
        if (event.key === "ArrowDown") moveRunner(runnerLane + 1, runnerColumn);
      }

      if (stage.kind === "sort_rush" && currentSortCard) {
        const laneIndex = Number.parseInt(event.key, 10) - 1;
        if (laneIndex >= 0 && laneIndex < stage.lanes.length) {
          assignSort(stage.lanes[laneIndex]!.id);
        }
      }

      if (stage.kind === "route_race") {
        const nodeIndex = Number.parseInt(event.key, 10) - 1;
        if (nodeIndex >= 0 && nodeIndex < stage.nodes.length) {
          selectNode(stage.nodes[nodeIndex]!.id);
        }
      }

      if (stage.kind === "reaction_pick" && currentRound) {
        const optionIndex = Number.parseInt(event.key, 10) - 1;
        if (optionIndex >= 0 && optionIndex < currentRound.options.length) {
          selectReaction(currentRound.options[optionIndex]!.id);
        }
      }

      if (stage.kind === "voice_burst" && event.key === "Enter") {
        void handleVoiceBurst();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    assignSort,
    currentRound,
    currentSortCard,
    evaluation,
    handleVoiceBurst,
    moveRunner,
    pending,
    runnerColumn,
    runnerLane,
    selectNode,
    selectReaction,
    stage,
    timeRemainingMs,
  ]);

  const introDuration = (stage.transitionFx?.introMs ?? 220) / 1000;
  const clearDuration = (stage.transitionFx?.clearMs ?? 320) / 1000;

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: introDuration, ease: "easeOut" }}
        className={`overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 shadow-sm ${theme.glow}`}
      >
        <div className={`space-y-3 border-b border-border/70 px-5 py-4 sm:px-6 ${theme.soft}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 ${theme.badge}`}>
                Game
              </Badge>
              <Badge variant="outline" className="rounded-full bg-background/85 px-3 py-1">
                Stage {stageIndex + 1} of {totalStages}
              </Badge>
              <span className="text-sm text-muted-foreground">{attemptLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{unitTitle}</p>
            <p className="text-sm text-muted-foreground">
              Unit {unitOrder}. Step {gameStepIndex} of {activityCount}
            </p>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.accent}`}
              style={{ width: `${((stageIndex + 1) / Math.max(totalStages, 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="space-y-4">
            <motion.div
              className={`relative overflow-hidden rounded-[2rem] border border-white/12 text-white transition ${
                flashMode === "hit"
                  ? "shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_18px_48px_-28px_rgba(16,185,129,0.45)]"
                  : flashMode === "miss"
                    ? "shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_18px_48px_-28px_rgba(244,63,94,0.35)]"
                    : flashMode === "near_miss"
                      ? "shadow-[0_0_0_1px_rgba(251,191,36,0.32),0_18px_48px_-28px_rgba(251,191,36,0.4)]"
                    : flashMode === "clear"
                      ? "shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_18px_48px_-28px_rgba(245,158,11,0.45)]"
                  : ""
              }`}
              animate={
                flashMode === "hit"
                  ? { scale: [1, 1.012, 1] }
                  : flashMode === "near_miss"
                    ? { scale: [1, 1.008, 1], x: [0, -2, 2, 0] }
                    : flashMode === "miss"
                      ? { x: [0, -6, 6, -4, 4, 0] }
                      : { scale: 1, x: 0 }
              }
              transition={
                flashMode === "hit"
                  ? { type: "tween", duration: 0.26, ease: "easeOut", times: [0, 0.45, 1] }
                  : flashMode === "near_miss"
                    ? { type: "tween", duration: 0.24, ease: "easeOut", times: [0, 0.45, 1] }
                  : flashMode === "miss"
                    ? { duration: 0.28, ease: "easeOut" }
                    : { duration: 0.24, ease: "easeOut" }
              }
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(9,16,36,0.85), rgba(15,23,42,0.62)), url(${boardAsset})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-white/18 bg-white/10 px-3 py-1 text-white">
                        {game.gameTitle}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-white/18 bg-white/10 px-3 py-1 text-white/82">
                        {stage.presentation?.boardTitle ?? stage.title}
                      </Badge>
                    </div>
                    <p className="max-w-2xl text-sm text-white/78">{stageObjective(stage)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-sm font-medium">
                      <span className="text-white/64">Time</span>
                      <span>{timerLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-sm font-medium">
                      <Heart className="size-4 text-rose-300" />
                      {livesRemaining}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-sm font-medium">
                      <Trophy className="size-4 text-amber-300" />
                      {score}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-sm font-medium">
                      <Zap className="size-4 text-sky-300" />
                      x{combo}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
                      onClick={toggleMuted}
                    >
                      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
                      onClick={() => setPaused((current) => !current)}
                      disabled={inputLocked}
                    >
                      {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
                      onClick={() => {
                        resetStageState();
                        if (evaluation) {
                          onRetry();
                        }
                      }}
                      disabled={pending}
                    >
                      <RefreshCcw className="size-4" />
                    </Button>
                  </div>
                </div>

                <div
                  className="rounded-[1.8rem] border border-white/12 bg-slate-950/18 px-4 py-4 sm:px-5 sm:py-5"
                  onTouchStart={(event) => {
                    const touch = event.changedTouches[0];
                    if (!touch) return;
                    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
                  }}
                  onTouchEnd={(event) => {
                    if (stage.kind !== "lane_runner") {
                      swipeStartRef.current = null;
                      return;
                    }
                    const start = swipeStartRef.current;
                    const touch = event.changedTouches[0];
                    if (!start || !touch) return;
                    const dx = touch.clientX - start.x;
                    const dy = touch.clientY - start.y;
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) {
                      moveRunner(runnerLane, runnerColumn + (dx > 0 ? 1 : -1));
                    } else if (Math.abs(dy) > 16) {
                      moveRunner(runnerLane + (dy > 0 ? 1 : -1), runnerColumn);
                    }
                    swipeStartRef.current = null;
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, x: 26 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -26 }}
                      transition={{ type: "spring", stiffness: 240, damping: 24, mass: 0.7 }}
                    >
                      {stage.kind === "lane_runner" ? (
                        <LaneRunnerBoard
                          stage={stage}
                          runnerLane={runnerLane}
                          runnerColumn={runnerColumn}
                          tokenPositions={laneTokenState}
                          collectedIds={collectedIds}
                          movePulse={movePulse}
                          tokenPulse={tokenPulse}
                          onMove={moveRunner}
                          locked={inputLocked}
                        />
                      ) : null}
                      {stage.kind === "sort_rush" ? (
                        <SortRushBoard
                          stage={stage}
                          queueCards={queueCards}
                          activeCardId={focusedSortCardId ?? currentSortCard?.id ?? null}
                          assignments={sortAssignments}
                          assignmentPulse={assignmentPulse}
                          onFocusCard={focusSortCard}
                          onAssign={assignSort}
                          locked={inputLocked}
                        />
                      ) : null}
                      {stage.kind === "route_race" ? (
                        <RouteRaceBoard
                          stage={stage}
                          pathIds={pathIds}
                          nodePulse={nodePulse}
                          onSelect={selectNode}
                          locked={inputLocked}
                        />
                      ) : null}
                      {stage.kind === "reaction_pick" ? (
                        <ReactionPickBoard
                          stage={stage}
                          currentRound={currentRound}
                          onSelect={selectReaction}
                          lockedOptionId={
                            reactionFeedback && reactionFeedback.roundId === currentRound?.id
                              ? reactionFeedback.optionId
                              : null
                          }
                          feedbackOutcome={
                            reactionFeedback && reactionFeedback.roundId === currentRound?.id
                              ? reactionFeedback.outcome
                              : null
                          }
                          locked={inputLocked}
                        />
                      ) : null}
                      {stage.kind === "voice_burst" ? (
                        <VoiceBurstBoard
                          stage={stage}
                          voiceMode={voiceMode}
                          recording={recording}
                          voiceReady={voiceEnabled && isSupported}
                          fallbackOptionId={fallbackOptionId}
                          onVoiceMode={setVoiceMode}
                          onFallbackOption={setFallbackOptionId}
                          onSubmit={handleVoiceBurst}
                        />
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {statusMessage ? (
                  <div className="rounded-[1.3rem] border border-white/12 bg-white/10 px-4 py-3 text-sm text-white/84">
                    {statusMessage}
                  </div>
                ) : null}

                {evaluation ? (
                  <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={
                      evaluation.outcome === "strong"
                        ? { opacity: 1, y: 0, scale: 1 }
                        : evaluation.nearMiss
                          ? { opacity: 1, y: 0, scale: [0.98, 1.02, 1] }
                          : { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -4, 4, 0] }
                    }
                    transition={
                      evaluation.outcome === "strong"
                        ? { type: "spring", stiffness: 320, damping: 24 }
                        : evaluation.nearMiss
                          ? { type: "tween", duration: clearDuration, ease: "easeOut", times: [0, 0.45, 1] }
                          : { duration: clearDuration, ease: "easeOut" }
                    }
                    className={`relative overflow-hidden rounded-[1.6rem] border border-white/14 bg-white/12 px-5 py-5 ${
                      evaluation.nearMiss ? "shadow-[0_18px_48px_-28px_rgba(251,191,36,0.34)]" : ""
                    }`}
                  >
                    <CelebrationBurst visible={evaluation.outcome === "strong"} />
                    <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                      <motion.div
                        initial={{ scale: 0.82, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        className={`inline-flex items-center gap-3 rounded-[1.35rem] border px-4 py-4 ${
                          evaluation.outcome === "strong"
                            ? "border-amber-300/44 bg-amber-300/18 text-amber-50"
                            : evaluation.nearMiss
                              ? "border-amber-300/28 bg-amber-300/12 text-amber-50"
                              : "border-rose-300/24 bg-rose-300/10 text-rose-50"
                        }`}
                      >
                        <Trophy className="size-5" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-72">Medal</p>
                          <p className="text-sm font-semibold">{medalLabel(evaluation.medal)}</p>
                        </div>
                      </motion.div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full border-white/18 bg-white/12 px-3 py-1 text-white">
                            {evaluation.outcome === "strong"
                              ? "Stage cleared"
                              : evaluation.nearMiss
                                ? "Close call"
                                : "One more pass"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-white/18 bg-white/12 px-3 py-1 text-white/82">
                            {evaluation.completionPath === "voice"
                              ? "Voice clear"
                              : evaluation.completionPath === "fallback"
                                ? "Backup clear"
                                : "Board clear"}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xl font-semibold text-white">
                          {evaluation.outcome === "strong"
                            ? stage.presentation?.resolvedTitle ?? "Stage cleared"
                            : evaluation.nearMiss
                              ? "Close call"
                              : "One more pass"}
                        </p>
                        <p className="mt-2 max-w-2xl text-sm text-white/80">
                          {evaluation.outcome === "strong" && stage.presentation?.resolvedNote
                            ? stage.presentation.resolvedNote
                            : evaluation.coachNote}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[1.1rem] border border-white/14 bg-slate-950/22 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">
                              Score delta
                            </p>
                            <p className="mt-1 text-lg font-semibold text-white">+{animatedStageScore}</p>
                          </div>
                          <div className="rounded-[1.1rem] border border-white/14 bg-slate-950/22 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">
                              Combo carry
                            </p>
                            <p className="mt-1 text-lg font-semibold text-white">x{animatedComboCarry}</p>
                          </div>
                        </div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/58">
                          Path {evaluation.completionPath}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {evaluation.outcome === "strong" && resolvedSpeechText ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
                            onClick={() => void handleReplayResolvedSpeech()}
                            disabled={speechPending}
                          >
                            <Volume2 className="mr-2 size-4" />
                            {speechPending ? "Playing line..." : "Hear full line"}
                          </Button>
                        ) : null}
                        {evaluation.outcome === "strong" ? (
                          <Button
                            type="button"
                            className="rounded-full bg-white px-5 text-slate-950 hover:bg-white/92"
                            onClick={onNext}
                          >
                            <Send className="mr-2 size-4" />
                            {stageIndex + 1 === totalStages ? "See summary" : "Next stage"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="rounded-full bg-white px-5 text-slate-950 hover:bg-white/92"
                            onClick={() => {
                              resetStageState();
                              onRetry();
                            }}
                          >
                            <RefreshCcw className="mr-2 size-4" />
                            Try stage again
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          </div>

        </div>
      </motion.section>
    </div>
  );
}

export { LearnArcadeStageSurface as LearnArcadeStagePlayer };

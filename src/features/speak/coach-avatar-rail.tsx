"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles, Wrench } from "lucide-react";

import type { CoachPersonaConfig } from "@/features/speak/coach-avatar-config";
import { getCoachPersona } from "@/features/speak/coach-avatar-config";
import { useAvatarLipsync } from "@/features/speak/use-avatar-lipsync";
import type { SpeakAvatarState, SpeakCoachCue } from "@/lib/speak";

type CoachAvatarRailProps = {
  cue: SpeakCoachCue | null;
  speaking?: boolean;
  pulseKey?: number;
  personaKey?: string | null;
  compact?: boolean;
  embedded?: boolean;
  action?: ReactNode;
};

type OrbColors = {
  surfaceTop: string;
  surfaceMid: string;
  surfaceDeep: string;
  edge: string;
  vein: string;
  veinSoft: string;
  aura: string;
  orbit: string;
  core: string;
  coreSoft: string;
  dust: string;
};

function getAvatarState(cue: SpeakCoachCue | null, speaking: boolean): SpeakAvatarState {
  if (speaking) {
    return "speaking";
  }

  if (!cue) {
    return "idle";
  }

  if (cue.tone === "repair") {
    return "repair";
  }

  if (cue.tone === "success") {
    return "success";
  }

  if (cue.tone === "prompt") {
    return "thinking";
  }

  return "listening";
}

function getOrbColors(
  avatarState: SpeakAvatarState,
  palette: CoachPersonaConfig["palette"]
): OrbColors {
  if (avatarState === "repair") {
    return {
      surfaceTop: "#17334b",
      surfaceMid: "#0f2438",
      surfaceDeep: "#050c14",
      edge: "#ffd17a",
      vein: "#fbbf24",
      veinSoft: "rgba(251,191,36,0.26)",
      aura: "rgba(245,158,11,0.16)",
      orbit: "rgba(253,224,71,0.72)",
      core: "#fff1c2",
      coreSoft: "rgba(255,230,160,0.52)",
      dust: "rgba(254,240,138,0.88)",
    };
  }

  if (avatarState === "success") {
    return {
      surfaceTop: "#0f4560",
      surfaceMid: "#0c3149",
      surfaceDeep: "#060e17",
      edge: "#9cf8c7",
      vein: "#5eead4",
      veinSoft: "rgba(94,234,212,0.24)",
      aura: "rgba(16,185,129,0.16)",
      orbit: "rgba(110,231,183,0.72)",
      core: "#fff4cc",
      coreSoft: "rgba(255,244,204,0.54)",
      dust: "rgba(167,243,208,0.92)",
    };
  }

  if (avatarState === "thinking") {
    return {
      surfaceTop: "#10466d",
      surfaceMid: "#0d2c49",
      surfaceDeep: "#050d16",
      edge: "#b2d7ff",
      vein: "#7dd3fc",
      veinSoft: "rgba(125,211,252,0.22)",
      aura: "rgba(99,102,241,0.14)",
      orbit: "rgba(196,181,253,0.68)",
      core: "#ffeab6",
      coreSoft: "rgba(255,234,182,0.5)",
      dust: "rgba(191,219,254,0.88)",
    };
  }

  if (avatarState === "speaking") {
    return {
      surfaceTop: "#116086",
      surfaceMid: "#0d3350",
      surfaceDeep: "#050d16",
      edge: "#b8fbff",
      vein: "#7de8ff",
      veinSoft: "rgba(125,232,255,0.24)",
      aura: "rgba(34,211,238,0.16)",
      orbit: "rgba(255,217,139,0.75)",
      core: "#fff1bf",
      coreSoft: "rgba(255,241,191,0.58)",
      dust: "rgba(165,243,252,0.96)",
    };
  }

  if (avatarState === "listening") {
    return {
      surfaceTop: "#0f5b80",
      surfaceMid: "#0c2f4a",
      surfaceDeep: "#050d16",
      edge: "#abf2ff",
      vein: "#8ae8ff",
      veinSoft: "rgba(138,232,255,0.2)",
      aura: "rgba(59,130,246,0.12)",
      orbit: "rgba(191,219,254,0.64)",
      core: "#ffe6b4",
      coreSoft: "rgba(255,230,180,0.46)",
      dust: "rgba(224,242,254,0.9)",
    };
  }

  return {
    surfaceTop: "#0f5478",
    surfaceMid: "#0b2a42",
    surfaceDeep: "#040b14",
    edge: "#9fefff",
    vein: "#86e7ff",
    veinSoft: "rgba(134,231,255,0.18)",
    aura: palette.neutralGlow,
    orbit: "rgba(191,219,254,0.56)",
    core: "#ffe0a1",
    coreSoft: "rgba(255,224,161,0.42)",
    dust: "rgba(224,242,254,0.86)",
  };
}

function EnergyVeins({
  colors,
  compact,
  reverse = false,
}: {
  colors: OrbColors;
  compact: boolean;
  reverse?: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        rotate: reverse ? [360, 0] : [0, 360],
        scale: reverse ? [1.02, 0.985, 1.02] : [0.985, 1.015, 0.985],
      }}
      transition={{ duration: reverse ? 18 : 26, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <clipPath id={reverse ? "orb-clip-b" : "orb-clip-a"}>
            <circle cx="50" cy="50" r="49" />
          </clipPath>
          <filter id={reverse ? "orb-glow-b" : "orb-glow-a"} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={compact ? 0.45 : 0.7} />
          </filter>
        </defs>
        <g clipPath={`url(#${reverse ? "orb-clip-b" : "orb-clip-a"})`}>
          <path d="M5 52C17 34 29 30 39 38C49 46 58 48 66 43C74 38 82 28 95 22" fill="none" stroke={colors.vein} strokeWidth="1.5" strokeLinecap="round" opacity="0.82" filter={`url(#${reverse ? "orb-glow-b" : "orb-glow-a"})`} />
          <path d="M10 74C23 59 33 54 42 57C52 60 59 68 69 66C79 64 87 55 93 47" fill="none" stroke={colors.vein} strokeWidth="1.15" strokeLinecap="round" opacity="0.72" filter={`url(#${reverse ? "orb-glow-b" : "orb-glow-a"})`} />
          <path d="M19 13C28 25 32 35 31 45C29 55 33 65 43 75" fill="none" stroke={colors.veinSoft} strokeWidth="1.05" strokeLinecap="round" opacity="0.95" />
          <path d="M76 12C68 24 65 34 68 45C72 56 70 66 62 79" fill="none" stroke={colors.veinSoft} strokeWidth="1" strokeLinecap="round" opacity="0.88" />
          <path d="M25 88C36 78 43 69 48 58C54 45 62 33 76 18" fill="none" stroke={colors.vein} strokeWidth="0.95" strokeLinecap="round" opacity="0.56" />
          <path d="M7 28C16 32 25 39 29 48C33 58 40 67 52 74" fill="none" stroke={colors.veinSoft} strokeWidth="0.9" strokeLinecap="round" opacity="0.76" />
          <circle cx="31" cy="46" r="1.1" fill={colors.vein} opacity="0.88" />
          <circle cx="61" cy="41" r="1.3" fill={colors.vein} opacity="0.9" />
          <circle cx="54" cy="66" r="1.15" fill={colors.vein} opacity="0.82" />
          <circle cx="76" cy="54" r="1.15" fill={colors.vein} opacity="0.82" />
        </g>
      </svg>
    </motion.div>
  );
}

function CoreField({
  colors,
  speaking,
  mouthIndex,
}: {
  colors: OrbColors;
  speaking: boolean;
  mouthIndex: number;
}) {
  const pulse = speaking ? 1 + mouthIndex * 0.08 : 1;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="relative h-[44%] w-[44%]"
        animate={{ scale: [0.94 * pulse, 1.03 * pulse, 0.97 * pulse] }}
        transition={{ duration: speaking ? 1.05 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-[6%] rounded-full border"
          style={{ borderColor: colors.orbit, boxShadow: `0 0 20px ${colors.coreSoft}` }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[88%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: "rgba(255,238,182,0.85)", boxShadow: `0 0 18px ${colors.coreSoft}` }}
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 6.6, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[54%] w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: "rgba(255,214,137,0.68)" }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 10.4, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-[28%] rounded-full"
          style={{ background: `radial-gradient(circle, ${colors.core} 0%, ${colors.coreSoft} 50%, rgba(255,255,255,0) 100%)` }}
          animate={{ scale: [0.9, 1.08, 0.94], opacity: [0.86, 1, 0.86] }}
          transition={{ duration: speaking ? 1.0 : 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
}

function OrbSphere({
  speaking,
  pulseKey,
  avatarState,
  palette,
  compact,
}: {
  speaking: boolean;
  pulseKey: number;
  avatarState: SpeakAvatarState;
  palette: CoachPersonaConfig["palette"];
  compact: boolean;
}) {
  const mouthIndex = useAvatarLipsync({ active: speaking, pulseKey });
  const colors = getOrbColors(avatarState, palette);
  const shellSize = compact ? 178 : 292;
  const orbSize = compact ? 130 : 210;
  const particleCount = compact ? 10 : 14;
  const radius = compact ? 74 : 118;
  const energyScale = speaking ? 1 + mouthIndex * 0.04 : avatarState === "thinking" ? 1.03 : avatarState === "success" ? 1.02 : 1;

  return (
    <div className="relative mx-auto" style={{ width: shellSize, height: shellSize }}>
      <motion.div
        className="absolute inset-[10%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${colors.aura} 0%, rgba(255,255,255,0) 72%)` }}
        animate={{ scale: speaking ? [0.96, 1.08, 0.98] : [0.94, 1.02, 0.95], opacity: [0.48, 0.84, 0.48] }}
        transition={{ duration: speaking ? 1.15 : 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute inset-[3%] rounded-full border"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />

      {Array.from({ length: particleCount }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / particleCount;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.span
            key={index}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: colors.dust, boxShadow: `0 0 10px ${colors.dust}` }}
            animate={{
              x: [x * 0.92, x, x * 0.95],
              y: [y * 0.92, y, y * 0.95],
              opacity: speaking ? [0.3, 0.92, 0.3] : [0.22, 0.58, 0.22],
              scale: speaking ? [0.9, 1.28, 0.9] : [0.85, 1.02, 0.85],
            }}
            transition={{ duration: speaking ? 1.6 + index * 0.06 : 3.2 + index * 0.08, repeat: Infinity, ease: "easeInOut", delay: index * 0.05 }}
          />
        );
      })}

      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
        style={{
          width: orbSize,
          height: orbSize,
          background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.28) 10%, ${colors.surfaceTop} 24%, ${colors.surfaceMid} 56%, ${colors.surfaceDeep} 100%)`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 28px 56px rgba(4,10,20,0.5), 0 0 42px ${colors.aura}`,
        }}
        animate={{ scale: [energyScale * 0.985, energyScale * 1.015, energyScale * 0.99] }}
        transition={{ duration: speaking ? 1.05 : 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-[2%] rounded-full"
          style={{
            background: "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 32%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="absolute inset-[2%] rounded-full"
          style={{
            background: "radial-gradient(circle at 70% 74%, rgba(5,12,24,0) 0%, rgba(5,12,24,0.28) 56%, rgba(5,12,24,0.48) 100%)",
          }}
        />
        <EnergyVeins colors={colors} compact={compact} />
        <EnergyVeins colors={colors} compact={compact} reverse />
        <CoreField colors={colors} speaking={speaking} mouthIndex={mouthIndex} />
        <motion.div
          className="absolute inset-[7%] rounded-full border"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-x-[18%] bottom-[7%] h-6 rounded-full bg-slate-950/45 blur-lg"
        animate={{ scaleX: [0.92, 1.01, 0.92], opacity: [0.2, 0.34, 0.2] }}
        transition={{ duration: speaking ? 1.2 : 3.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function CoachAvatarRail({
  cue,
  speaking = false,
  pulseKey = 0,
  personaKey,
  compact = false,
  embedded = false,
  action,
}: CoachAvatarRailProps) {
  const persona = getCoachPersona(personaKey);
  const avatarState = getAvatarState(cue, speaking);

  const railClasses = compact
    ? "relative overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,255,0.94))] p-4 shadow-[0_18px_44px_rgba(15,23,42,0.10)] backdrop-blur-xl"
    : embedded
      ? "relative flex h-full min-h-[32rem] flex-col overflow-hidden bg-transparent p-0"
      : "relative overflow-hidden rounded-[2.15rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(239,246,255,0.94))] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl";
  const bubbleClasses =
    cue?.tone === "repair"
      ? "border-amber-300/50 bg-amber-50/96 text-amber-950"
      : cue?.tone === "success"
        ? "border-emerald-300/45 bg-emerald-50/96 text-emerald-950"
        : "border-sky-200/45 bg-white/96 text-slate-950";

  const toneIcon =
    cue?.tone === "repair" ? (
      <Wrench className="size-4 text-amber-600" />
    ) : cue?.tone === "success" ? (
      <CheckCircle2 className="size-4 text-emerald-600" />
    ) : (
      <Sparkles className="size-4 text-sky-600" />
    );

  return (
    <aside className={railClasses}>
      <div className={`pointer-events-none absolute inset-x-8 top-0 h-28 rounded-full bg-sky-100/45 blur-3xl ${embedded ? "opacity-80" : ""}`} />
      <div className={`pointer-events-none absolute -left-10 bottom-10 h-40 w-40 rounded-full bg-white/65 blur-3xl ${embedded ? "opacity-75" : ""}`} />

      <div className={compact ? "relative flex items-center gap-4" : embedded ? "relative flex h-full flex-col" : "relative space-y-4"}>
        <div className={compact ? "min-w-0 flex-1" : "space-y-4"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{persona.roleLabel}</p>
              <h2 className="text-[1.75rem] font-semibold leading-none tracking-tight text-slate-950">{persona.name}</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              {speaking ? "Live" : avatarState === "repair" ? "Repair" : avatarState === "success" ? "Success" : "Guide"}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {cue ? (
              <motion.div
                key={cue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`relative max-w-full rounded-[1.5rem] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.10)] ${bubbleClasses}`}
              >
                <div className="absolute -bottom-2 left-9 h-4 w-4 rotate-45 border-b border-r bg-inherit" />
                <div className="relative z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {toneIcon}
                  {cue.label}
                </div>
                <p className="relative z-10 mt-2 text-sm font-medium leading-relaxed">{cue.text}</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-[1.5rem] border border-slate-200/80 bg-white/92 px-4 py-3 text-sm text-slate-600 shadow-sm"
              >
                I will handle hints and recovery here while the role-play stays in the scene.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={compact ? "w-40 shrink-0" : embedded ? "mt-6 flex flex-1 items-center justify-center py-4" : "mx-auto w-full max-w-[17rem] pt-3"}>
          <OrbSphere
            speaking={speaking}
            pulseKey={pulseKey}
            avatarState={avatarState}
            palette={persona.palette}
            compact={compact}
          />
        </div>
      </div>

      {action ? <div className={compact ? "relative mt-4" : embedded ? "relative mt-4" : "relative mt-5"}>{action}</div> : null}
    </aside>
  );
}

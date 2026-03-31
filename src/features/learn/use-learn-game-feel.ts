"use client";

import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ARCADE_AUDIO_MUTE_STORAGE_KEY } from "@/lib/learn-arcade";
import type { GameSoundSet } from "@/server/learn-game-types";

export type LearnGameSfx =
  | "select"
  | "snap"
  | "route_confirm"
  | "correct"
  | "incorrect"
  | "near_miss"
  | "combo"
  | "stage_clear"
  | "completion";

const SFX_URLS: Record<LearnGameSfx, string> = {
  select: "/games/audio/correct.wav",
  snap: "/games/audio/stage-clear.wav",
  route_confirm: "/games/audio/combo.wav",
  correct: "/games/audio/correct.wav",
  incorrect: "/games/audio/incorrect.wav",
  near_miss: "/games/audio/near-miss.wav",
  combo: "/games/audio/combo.wav",
  stage_clear: "/games/audio/stage-clear.wav",
  completion: "/games/audio/completion.wav",
};

const AMBIENT_URLS: Partial<Record<GameSoundSet, string>> = {
  hallway: "/games/audio/ambient-hallway.wav",
  classroom: "/games/audio/ambient-classroom.wav",
  counter: "/games/audio/ambient-counter.wav",
  route: "/games/audio/ambient-route.wav",
  weather: "/games/audio/ambient-weather.wav",
  planner: "/games/audio/ambient-planner.wav",
  story: "/games/audio/ambient-route.wav",
  scene: "/games/audio/ambient-classroom.wav",
  deadline: "/games/audio/ambient-planner.wav",
  station: "/games/audio/ambient-counter.wav",
  comparison: "/games/audio/ambient-comparison.wav",
  neutral: "/games/audio/ambient-neutral.wav",
};

function fallbackToneConfig(type: LearnGameSfx) {
  switch (type) {
    case "select":
      return { frequency: 460, durationMs: 90, oscillator: "triangle" as const, gain: 0.022 };
    case "snap":
      return { frequency: 610, durationMs: 120, oscillator: "triangle" as const, gain: 0.026 };
    case "route_confirm":
      return { frequency: 520, durationMs: 110, oscillator: "sawtooth" as const, gain: 0.024 };
    case "correct":
      return { frequency: 540, durationMs: 160, oscillator: "triangle" as const, gain: 0.045 };
    case "incorrect":
      return { frequency: 190, durationMs: 220, oscillator: "square" as const, gain: 0.05 };
    case "near_miss":
      return { frequency: 420, durationMs: 180, oscillator: "triangle" as const, gain: 0.038 };
    case "combo":
      return { frequency: 700, durationMs: 180, oscillator: "sawtooth" as const, gain: 0.042 };
    case "stage_clear":
      return { frequency: 760, durationMs: 240, oscillator: "triangle" as const, gain: 0.055 };
    case "completion":
      return { frequency: 860, durationMs: 320, oscillator: "triangle" as const, gain: 0.055 };
  }
}

export function usePersistentGameAudioMute() {
  const [muted, setMuted] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem(ARCADE_AUDIO_MUTE_STORAGE_KEY) === "1"
      : false
  );

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ARCADE_AUDIO_MUTE_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  return { muted, toggleMuted, setMuted };
}

export function useAnimatedCount(target: number, enabled: boolean, durationMs = 720) {
  const motionValue = useMotionValue(enabled ? 0 : target);
  const [count, setCount] = useState(enabled ? 0 : target);

  useMotionValueEvent(motionValue, "change", (latest) => {
    setCount(Math.round(latest));
  });

  useEffect(() => {
    if (!enabled) {
      motionValue.set(target);
      return;
    }

    motionValue.set(0);
    const controls = animate(motionValue, target, {
      duration: durationMs / 1000,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [durationMs, enabled, motionValue, target]);

  return count;
}

export function useLearnGameAudio(options?: {
  soundSet?: GameSoundSet | null;
  muted?: boolean;
  ambientEnabled?: boolean;
  ambientDucked?: boolean;
}) {
  const soundSet = options?.soundSet ?? null;
  const muted = Boolean(options?.muted);
  const ambientEnabled = Boolean(options?.ambientEnabled);
  const ambientDucked = Boolean(options?.ambientDucked);
  const contextRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const ambientUrlRef = useRef<string | null>(null);

  const ambientVolume = useMemo(() => {
    if (ambientDucked) {
      return 0.028;
    }
    return 0.075;
  }, [ambientDucked]);

  const playFallbackTone = useCallback(
    (type: LearnGameSfx) => {
      if (muted || typeof window === "undefined") {
        return;
      }

      if (!contextRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          return;
        }
        contextRef.current = new Ctor();
      }

      const context = contextRef.current;
      const { frequency, durationMs, oscillator, gain } = fallbackToneConfig(type);
      const source = context.createOscillator();
      const gainNode = context.createGain();
      source.type = oscillator;
      source.frequency.value = frequency;
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(context.destination);
      source.start();
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
      source.stop(context.currentTime + durationMs / 1000);
    },
    [muted]
  );

  const playSfx = useCallback(
    (type: LearnGameSfx) => {
      if (muted || typeof window === "undefined") {
        return;
      }

      const url = SFX_URLS[type];
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume =
        type === "completion"
          ? 0.38
          : type === "stage_clear"
            ? 0.34
            : type === "select"
              ? 0.16
              : type === "snap" || type === "route_confirm"
                ? 0.2
            : type === "near_miss"
              ? 0.24
              : 0.28;
      audio.play().catch(() => {
        playFallbackTone(type);
      });
    },
    [muted, playFallbackTone]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = soundSet ? AMBIENT_URLS[soundSet] ?? null : null;
    if (!ambientEnabled || muted || !nextUrl) {
      ambientRef.current?.pause();
      return;
    }

    if (!ambientRef.current || ambientUrlRef.current !== nextUrl) {
      ambientRef.current?.pause();
      const loop = new Audio(nextUrl);
      loop.loop = true;
      loop.preload = "auto";
      ambientRef.current = loop;
      ambientUrlRef.current = nextUrl;
    }

    const ambient = ambientRef.current;
    ambient.volume = ambientVolume;
    ambient.play().catch(() => {
      // Ambient playback may be blocked until the first user gesture.
    });

    return () => {
      ambient.pause();
    };
  }, [ambientEnabled, ambientVolume, muted, soundSet]);

  useEffect(() => {
    return () => {
      ambientRef.current?.pause();
    };
  }, []);

  return {
    playSfx,
  };
}

export function useLearnGameSpeech(options?: { muted?: boolean }) {
  const muted = Boolean(options?.muted);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef(new Map<string, string>());
  const [pendingText, setPendingText] = useState<string | null>(null);

  const stopSpeech = useCallback(() => {
    if (!activeAudioRef.current) {
      return;
    }

    activeAudioRef.current.pause();
    activeAudioRef.current.currentTime = 0;
    activeAudioRef.current = null;
  }, []);

  const speakText = useCallback(
    async (text: string, options?: { ignoreMute?: boolean }) => {
      const normalizedText = text.replace(/\s+/g, " ").trim();
      if (!normalizedText) {
        return false;
      }

      if (muted && !options?.ignoreMute) {
        return false;
      }

      stopSpeech();

      let url = urlCacheRef.current.get(normalizedText) ?? null;
      if (!url) {
        setPendingText(normalizedText);
        try {
          const response = await fetch("/api/v1/learn/curriculum/game/speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: normalizedText }),
          });

          if (response.status === 204 || !response.ok) {
            return false;
          }

          const audioBlob = await response.blob();
          if (audioBlob.size === 0) {
            return false;
          }

          url = URL.createObjectURL(audioBlob);
          urlCacheRef.current.set(normalizedText, url);
        } finally {
          setPendingText((current) => (current === normalizedText ? null : current));
        }
      }

      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = 0.96;
      activeAudioRef.current = audio;
      await audio.play().catch(() => undefined);
      return true;
    },
    [muted, stopSpeech]
  );

  useEffect(() => {
    return () => {
      stopSpeech();
      for (const url of urlCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      urlCacheRef.current.clear();
    };
  }, [stopSpeech]);

  return {
    speakText,
    stopSpeech,
    speechPending: pendingText !== null,
  };
}

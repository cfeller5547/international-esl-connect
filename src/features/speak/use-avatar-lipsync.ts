"use client";

import { useEffect, useRef, useState } from "react";

type UseAvatarLipsyncOptions = {
  active: boolean;
  pulseKey: number;
};

export function useAvatarLipsync({ active, pulseKey }: UseAvatarLipsyncOptions) {
  const [mouthIndex, setMouthIndex] = useState(0);
  const amplitudeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      amplitudeRef.current = 0;
      setMouthIndex(0);
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frameId = 0;

    const tick = () => {
      amplitudeRef.current = Math.max(0, amplitudeRef.current * 0.84 - 0.02);
      const amplitude = amplitudeRef.current;

      const nextIndex = reduceMotion
        ? amplitude > 0.22
          ? 1
          : 0
        : amplitude > 0.72
          ? 3
          : amplitude > 0.46
            ? 2
            : amplitude > 0.18
              ? 1
              : 0;

      setMouthIndex((current) => (current === nextIndex ? current : nextIndex));
      frameId = window.requestAnimationFrame(tick);
    };

    amplitudeRef.current = Math.max(amplitudeRef.current, 0.28);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    amplitudeRef.current = 1;
  }, [active, pulseKey]);

  return mouthIndex;
}

"use client";

import type { SpeakCoachCue } from "@/lib/speak";

type SpeakCoachCuePlaybackOptions = {
  cue: SpeakCoachCue;
  remoteAudio?: HTMLAudioElement | null;
  onSpeakingChange?: (value: boolean) => void;
  onBoundary?: () => void;
};

function pickCoachVoice(voices: SpeechSynthesisVoice[]) {
  const preferredNames = [
    "Samantha",
    "Google US English",
    "Microsoft Jenny Online",
    "Microsoft Aria Online",
    "Ava",
  ];

  for (const name of preferredNames) {
    const match = voices.find((voice) => voice.name.includes(name));
    if (match) {
      return match;
    }
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    voices[0] ??
    null
  );
}

export function speakCoachCue({
  cue,
  remoteAudio,
  onSpeakingChange,
  onBoundary,
}: SpeakCoachCuePlaybackOptions) {
  if (
    cue.deliveryMode === "text_only" ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    onSpeakingChange?.(false);
    return () => undefined;
  }

  const synth = window.speechSynthesis;
  const priorMuted = remoteAudio?.muted ?? false;
  const priorVolume = remoteAudio?.volume ?? 1;
  let finished = false;

  const cleanup = () => {
    if (finished) {
      return;
    }

    finished = true;
    if (remoteAudio) {
      remoteAudio.muted = priorMuted;
      remoteAudio.volume = priorVolume;
    }
    onSpeakingChange?.(false);
  };

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(cue.text);
  utterance.rate = 0.98;
  utterance.pitch = 1.08;
  utterance.volume = 1;

  const applyVoice = () => {
    const voices = synth.getVoices();
    const selected = pickCoachVoice(voices);
    if (selected) {
      utterance.voice = selected;
    }
  };

  applyVoice();

  utterance.onstart = () => {
    if (remoteAudio) {
      remoteAudio.muted = true;
      remoteAudio.volume = 0;
    }
    onSpeakingChange?.(true);
    onBoundary?.();
  };

  utterance.onboundary = () => {
    onBoundary?.();
  };

  utterance.onend = cleanup;
  utterance.onerror = cleanup;

  synth.speak(utterance);

  return () => {
    synth.cancel();
    cleanup();
  };
}

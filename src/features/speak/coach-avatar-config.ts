import type { SpeakVoiceProfile } from "@/lib/speak";

export type CoachPersonaKey = "maya";

export type CoachPersonaConfig = {
  key: CoachPersonaKey;
  name: string;
  roleLabel: string;
  voiceProfile: SpeakVoiceProfile;
  palette: {
    shellBg: string;
    shellGlow: string;
    orbCore: string;
    orbSecondary: string;
    orbHighlight: string;
    thinkingCore: string;
    thinkingSecondary: string;
    repairCore: string;
    repairSecondary: string;
    successCore: string;
    successSecondary: string;
  };
};

const PERSONAS: Record<CoachPersonaKey, CoachPersonaConfig> = {
  maya: {
    key: "maya",
    name: "Maya",
    roleLabel: "Tutor",
    voiceProfile: "coach_guide",
    palette: {
      shellBg: "#0f172a",
      shellGlow: "rgba(59,130,246,0.22)",
      orbCore: "#5eead4",
      orbSecondary: "#4f46e5",
      orbHighlight: "#f0f9ff",
      thinkingCore: "#a78bfa",
      thinkingSecondary: "#2563eb",
      repairCore: "#f59e0b",
      repairSecondary: "#fb7185",
      successCore: "#34d399",
      successSecondary: "#38bdf8",
    },
  },
};

export const DEFAULT_COACH_PERSONA_KEY: CoachPersonaKey = "maya";

export function getCoachPersona(key?: string | null) {
  if (key === "maya") {
    return PERSONAS[key];
  }

  return PERSONAS[DEFAULT_COACH_PERSONA_KEY];
}

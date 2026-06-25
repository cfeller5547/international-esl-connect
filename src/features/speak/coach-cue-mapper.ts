import type {
  SpeakCoachCue,
  SpeakMissionDetails,
  SpeakSceneState,
  SpeakTranscriptTurn,
} from "@/lib/speak";

type CoachLiveTone =
  | "idle"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "repair"
  | "resolved"
  | "error";

type BuildMissionCoachCueOptions = {
  mission: SpeakMissionDetails;
  sceneState: SpeakSceneState;
  turns: SpeakTranscriptTurn[];
  liveTone: CoachLiveTone;
  helpPrompt?: string | null;
  repairNotice?: string | null;
  studentTurnCount: number;
};

function makeCue(
  id: string,
  label: string,
  text: string,
  tone: SpeakCoachCue["tone"],
  mission: SpeakMissionDetails
): SpeakCoachCue {
  return {
    id,
    label,
    text,
    tone,
    speakerRole: "coach",
    channel: "coach",
    voiceProfile: "coach_guide",
    deliveryMode: mission.mode === "guided" ? "spoken" : "text_only",
  };
}

export function buildMissionCoachCue({
  mission,
  sceneState,
  turns,
  liveTone,
  helpPrompt,
  repairNotice,
  studentTurnCount,
}: BuildMissionCoachCueOptions) {
  if (mission.mode !== "guided" || mission.coachEnabled === false) {
    return null;
  }

  const studentTurns = turns.filter((turn) => turn.speaker === "student");
  const latestStudentTurn = studentTurns.at(-1)?.text.toLowerCase() ?? "";
  const allStudentText = studentTurns.map((turn) => turn.text.toLowerCase()).join(" ");
  const landedCount = sceneState.targetPhraseProgress.filter(
    (item) => item.state === "landed"
  ).length;
  const thanked = allStudentText.includes("thank");

  if (repairNotice?.trim()) {
    return makeCue(
      `repair:${repairNotice.trim()}:${studentTurnCount}`,
      "Try this",
      repairNotice.trim(),
      "repair",
      mission
    );
  }

  if (helpPrompt?.trim()) {
    return makeCue(
      `hint:${helpPrompt.trim()}:${studentTurnCount}:${turns.length}`,
      "Hint",
      helpPrompt.trim(),
      "hint",
      mission
    );
  }

  if (sceneState.spec.stageKey === "coffee_shop") {
    if (sceneState.resolved && !thanked) {
      return makeCue(
        `coffee_wrap:${studentTurnCount}`,
        "Final step",
        "Now thank the barista when they hand you the hot tea.",
        "prompt",
        mission
      );
    }

    if (sceneState.resolved && thanked) {
      return makeCue(
        "coffee_success",
        "Nice",
        "That sounded polite and natural. You completed the coffee shop mission well.",
        "success",
        mission
      );
    }

    if (liveTone === "ready" && studentTurnCount === 0) {
      return makeCue(
        "coffee_start",
        "Start here",
        "Open with: Excuse me. I ordered hot tea, not iced coffee.",
        "prompt",
        mission
      );
    }

    if (latestStudentTurn.includes("excuse me") && !latestStudentTurn.includes("hot tea")) {
      return makeCue(
        `coffee_specific:${studentTurnCount}`,
        "Next move",
        "Good start. Now clearly say that you ordered hot tea.",
        "prompt",
        mission
      );
    }

    if (latestStudentTurn.includes("hot tea") && landedCount >= 2) {
      return makeCue(
        `coffee_progress:${studentTurnCount}`,
        "Keep going",
        "Good correction. Ask the barista to replace the drink.",
        "success",
        mission
      );
    }
  }

  if (sceneState.resolved) {
    return makeCue(
      `resolved:${sceneState.spec.stageKey}:${studentTurnCount}`,
      "Nice",
      "You completed the mission clearly. Keep that phrasing for the next one.",
      "success",
      mission
    );
  }

  if (liveTone === "ready" && studentTurnCount === 0) {
    return makeCue(
      `guided_start:${sceneState.spec.stageKey}`,
      "Start here",
      mission.openingPrompt?.trim()
        ? `Start with: ${mission.openingPrompt.trim()}`
        : "Open with one short sentence that matches the mission goal.",
      "prompt",
      mission
    );
  }

  return null;
}

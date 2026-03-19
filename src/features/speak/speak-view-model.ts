import { GUIDED_SCENARIOS, SPEAK_STARTERS } from "@/lib/constants";

type SpeakMode = "free_speech" | "guided";
type InteractionMode = "text" | "voice";
type SpeakStarterKey = (typeof SPEAK_STARTERS)[number]["key"];
type GuidedScenarioKey = (typeof GUIDED_SCENARIOS)[number]["key"];

type SpeakPersonalizationSnapshot = {
  currentLevel: string | null;
  weakestSkill: string | null;
  activeTopics: string[];
  currentLearnTitle: string | null;
  plan: "free" | "pro";
};

export type SpeakMissionPlan = {
  mode: SpeakMode;
  starterKey: SpeakStarterKey | null;
  starterLabel: string | null;
  scenarioKey: GuidedScenarioKey | null;
  recommendedInteractionMode: InteractionMode;
  title: string;
  description: string;
  speakingGoal: string | null;
  whyNow: string | null;
  mission: {
    scenarioTitle: string;
    scenarioSetup: string;
    counterpartRole: string | null;
    canDoStatement: string | null;
    performanceTask: string | null;
    openingQuestion: string;
    introductionText: string | null;
    targetPhrases: string[];
    followUpPrompts: string[];
    successCriteria: string[];
    starterPrompt: string;
    recommendationReason: string | null;
    activeTopic: string | null;
    focusSkill: string | null;
    learnerLevel: string | null;
    contextHint: string | null;
    starterKey: SpeakStarterKey | null;
    starterLabel: string | null;
  };
};

export type SpeakLaunchStarter = {
  key: SpeakStarterKey;
  label: string;
  prompt: string;
  hint: string;
};

export type SpeakLaunchViewModel = {
  recommendation: SpeakMissionPlan;
  starters: SpeakLaunchStarter[];
  guidedScenarios: Array<{ key: GuidedScenarioKey; title: string; description: string }>;
};

type SpeakSelection = {
  mode: SpeakMode;
  starterKey?: SpeakStarterKey | null;
  scenarioKey?: GuidedScenarioKey | null;
};

export function buildSpeakLaunchViewModel(
  snapshot: SpeakPersonalizationSnapshot
): SpeakLaunchViewModel {
  return {
    recommendation: buildRecommendedSpeakMission(snapshot),
    starters: buildStarterLanes(snapshot),
    guidedScenarios: [...GUIDED_SCENARIOS],
  };
}

export function buildRecommendedSpeakMission(
  snapshot: SpeakPersonalizationSnapshot
): SpeakMissionPlan {
  const weakestSkill = snapshot.weakestSkill;

  if (weakestSkill === "grammar") {
    return buildSpeakMission(
      {
        mode: "guided",
        scenarioKey: "office_hours",
      },
      snapshot
    );
  }

  if (weakestSkill === "vocabulary" || weakestSkill === "writing") {
    return buildSpeakMission(
      {
        mode: "guided",
        scenarioKey: "presentation_practice",
      },
      snapshot
    );
  }

  if (weakestSkill === "speaking" || weakestSkill === "listening") {
    return buildSpeakMission(
      {
        mode: "guided",
        scenarioKey: "class_discussion",
      },
      snapshot
    );
  }

  if (snapshot.activeTopics.length > 0 || snapshot.currentLearnTitle) {
    return buildSpeakMission(
      {
        mode: "free_speech",
        starterKey: "learning",
      },
      snapshot
    );
  }

  return buildSpeakMission(
    {
      mode: "free_speech",
      starterKey: "today",
    },
    snapshot
  );
}

export function buildSpeakMission(
  selection: SpeakSelection,
  snapshot: SpeakPersonalizationSnapshot
): SpeakMissionPlan {
  const activeTopic = pickActiveTopic(snapshot.activeTopics, snapshot.currentLearnTitle);
  const recommendedInteractionMode: InteractionMode = snapshot.plan === "pro" ? "voice" : "text";

  if (selection.mode === "guided") {
    return buildGuidedMission({
      scenarioKey: selection.scenarioKey ?? "class_discussion",
      snapshot,
      activeTopic,
      recommendedInteractionMode,
    });
  }

  return buildFreeSpeechMission({
    starterKey: selection.starterKey ?? "today",
    snapshot,
    activeTopic,
    recommendedInteractionMode,
  });
}

function buildStarterLanes(snapshot: SpeakPersonalizationSnapshot): SpeakLaunchStarter[] {
  const activeTopic = pickActiveTopic(snapshot.activeTopics, snapshot.currentLearnTitle);
  const cleanedLearnTitle = snapshot.currentLearnTitle?.replace(/^Continue\s+/i, "").trim() ?? null;
  const skillLabel = formatSkillLabel(snapshot.weakestSkill);

  return SPEAK_STARTERS.map((starter) => {
    switch (starter.key) {
      case "learning":
        return {
          ...starter,
          hint: activeTopic
            ? `Start with ${activeTopic} or another class idea that feels current.`
            : cleanedLearnTitle
              ? `Use ${cleanedLearnTitle} or another topic from class today.`
              : "Start with something from class, homework, or a unit you are studying.",
        };
      case "say_better":
        return {
          ...starter,
          hint: skillLabel
            ? `Good when you want to sound clearer or more natural in ${skillLabel}.`
            : "Pick one idea you want to explain more clearly today.",
        };
      case "surprise_me":
        return {
          ...starter,
          hint: activeTopic
            ? `We'll open with ${activeTopic} or another topic that already fits your context.`
            : "We'll choose a simple topic that fits your level and keeps the conversation moving.",
        };
      case "today":
      default:
        return {
          ...starter,
          hint: activeTopic
            ? `You can start with ${activeTopic}, a class moment, or anything else from today.`
            : "Start with anything that happened today, from class or daily life.",
        };
    }
  });
}

function buildGuidedMission({
  scenarioKey,
  snapshot,
  activeTopic,
  recommendedInteractionMode,
}: {
  scenarioKey: GuidedScenarioKey;
  snapshot: SpeakPersonalizationSnapshot;
  activeTopic: string | null;
  recommendedInteractionMode: InteractionMode;
}): SpeakMissionPlan {
  const phrases = baseTargetPhrases(snapshot.currentLevel, snapshot.weakestSkill);

  switch (scenarioKey) {
    case "office_hours":
      return {
        mode: "guided",
        starterKey: null,
        starterLabel: null,
        scenarioKey: "office_hours",
        recommendedInteractionMode,
        title: activeTopic ? `Ask for help about ${activeTopic}` : "Ask for help clearly",
        description:
          activeTopic
            ? `Practice office-hours English around ${activeTopic} so you can explain what feels confusing and ask a follow-up question naturally.`
            : "Practice asking for help, explaining what feels confusing, and responding clearly.",
        speakingGoal: "Explain one difficulty clearly, then ask one follow-up question.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, "grammar"),
        mission: {
          scenarioTitle: activeTopic ? `Office hours: ${activeTopic}` : "Office hours",
          scenarioSetup: activeTopic
            ? `You are meeting your teacher during office hours to talk about ${activeTopic}. Explain what feels confusing, say what you understand so far, and keep the conversation clear.`
            : "You are meeting your teacher during office hours. Explain what feels confusing, say what you understand so far, and keep the conversation clear.",
          counterpartRole: "teacher",
          canDoStatement:
            "I can explain a class problem clearly and ask one helpful follow-up question.",
          performanceTask:
            "State the problem, give one detail from class, and respond naturally to the teacher's next question.",
          openingQuestion: activeTopic
            ? `What part of ${activeTopic} feels hardest right now?`
            : "What part of class would you like help with today?",
          introductionText: activeTopic
            ? `Hi, I'm your teacher for office hours today. Let's talk about ${activeTopic}.`
            : "Hi, I'm your teacher for office hours today.",
          targetPhrases: [phrases[0], "Could you explain that part again?"],
          followUpPrompts: [
            "Ask what still feels confusing.",
            "Ask what the learner understands so far.",
            "Ask for one concrete example from class.",
          ],
          successCriteria: [
            "State the problem clearly in one or two connected sentences.",
            "Add one detail from class or homework.",
          ],
          starterPrompt: activeTopic
            ? `Explain what feels confusing about ${activeTopic}.`
            : "Explain one part of class that still feels confusing.",
          recommendationReason: buildRecommendationReason(snapshot, activeTopic, "grammar"),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
          contextHint: activeTopic
            ? `${activeTopic} gives you a real reason to practice asking for help naturally.`
            : "Use a real class problem so the practice transfers back to class.",
          starterKey: null,
          starterLabel: null,
        },
      };
    case "presentation_practice":
      return {
        mode: "guided",
        starterKey: null,
        starterLabel: null,
        scenarioKey: "presentation_practice",
        recommendedInteractionMode,
        title: activeTopic ? `Explain ${activeTopic} out loud` : "Explain a class idea clearly",
        description: activeTopic
          ? `Turn ${activeTopic} into a short spoken explanation with stronger vocabulary and better structure.`
          : "Practice turning one academic idea into a clear spoken explanation.",
        speakingGoal: "Give one clear explanation and support it with one example.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: activeTopic
            ? `Presentation practice: ${activeTopic}`
            : "Presentation practice",
          scenarioSetup: activeTopic
            ? `You are rehearsing a short class explanation about ${activeTopic}. Speak in connected sentences, use stronger topic language, and respond to one follow-up question.`
            : "You are rehearsing a short class explanation. Speak in connected sentences and respond to one follow-up question.",
          counterpartRole: "teacher",
          canDoStatement:
            "I can explain one academic idea clearly and support it with an example.",
          performanceTask:
            "Explain the topic, use one helpful connector, and respond to one short follow-up question.",
          openingQuestion: activeTopic
            ? `What is the main idea you want to explain about ${activeTopic}?`
            : "What topic are you explaining today?",
          introductionText: activeTopic
            ? `Hi, I'm listening to your short explanation about ${activeTopic}.`
            : "Hi, I'm listening to your short explanation.",
          targetPhrases: [phrases[0], phrases[1]],
          followUpPrompts: [
            "Ask the learner to add one reason.",
            "Ask for one concrete example.",
            "Ask what idea matters most.",
          ],
          successCriteria: [
            "Explain the main idea in connected sentences.",
            "Add one reason or example that makes the explanation clearer.",
          ],
          starterPrompt: activeTopic
            ? `Explain the main idea of ${activeTopic} in your own words.`
            : "Explain one class idea in your own words.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
          contextHint: activeTopic
            ? `${activeTopic} keeps the explanation grounded in something real from class.`
            : "Use a real class idea so the rehearsal feels useful, not generic.",
          starterKey: null,
          starterLabel: null,
        },
      };
    case "class_discussion":
    default:
      return {
        mode: "guided",
        starterKey: null,
        starterLabel: null,
        scenarioKey: "class_discussion",
        recommendedInteractionMode,
        title: activeTopic ? `Talk through ${activeTopic}` : "Keep a class discussion moving",
        description: activeTopic
          ? `Practice answering follow-up questions about ${activeTopic} with clearer, more connected answers.`
          : "Practice answering class-style follow-up questions with clearer, more connected answers.",
        speakingGoal: "Answer clearly, then add one reason or example.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: activeTopic ? `Class discussion: ${activeTopic}` : "Class discussion",
          scenarioSetup: activeTopic
            ? `You are answering class follow-up questions about ${activeTopic}. Keep your answers clear, connected, and easy to follow.`
            : "You are answering class follow-up questions. Keep your answers clear, connected, and easy to follow.",
          counterpartRole: "teacher",
          canDoStatement:
            "I can answer a class question clearly and keep the conversation moving.",
          performanceTask:
            "Answer the question directly, then support your idea with one reason or example.",
          openingQuestion: activeTopic
            ? `What idea about ${activeTopic} has stood out to you this week?`
            : "What idea from class has stood out to you this week?",
          introductionText: activeTopic
            ? `Hi, I'm your teacher for a short class discussion about ${activeTopic}.`
            : "Hi, I'm your teacher for a short class discussion.",
          targetPhrases: [phrases[0], phrases[1]],
          followUpPrompts: [
            "Ask why that idea matters.",
            "Ask for one example from class or daily life.",
            "Ask one short follow-up question that keeps the learner talking.",
          ],
          successCriteria: [
            "Answer the main question clearly in one or two connected sentences.",
            "Add one useful reason or example.",
          ],
          starterPrompt: activeTopic
            ? `Talk about one important idea from ${activeTopic}.`
            : "Talk about one important idea from class this week.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
          contextHint: activeTopic
            ? `${activeTopic} keeps the discussion close to what you are already studying.`
            : "Stay close to class so the speaking practice transfers back to real conversations.",
          starterKey: null,
          starterLabel: null,
        },
      };
  }
}

function buildFreeSpeechMission({
  starterKey,
  snapshot,
  activeTopic,
  recommendedInteractionMode,
}: {
  starterKey: SpeakStarterKey;
  snapshot: SpeakPersonalizationSnapshot;
  activeTopic: string | null;
  recommendedInteractionMode: InteractionMode;
}): SpeakMissionPlan {
  const starter = SPEAK_STARTERS.find((entry) => entry.key === starterKey) ?? SPEAK_STARTERS[0];
  const phrases = baseFreeSpeechPhrases({
    starterKey: starter.key,
    currentLevel: snapshot.currentLevel,
  });
  const contextHint = buildFreeSpeechContextHint({
    starterKey: starter.key,
    activeTopic,
    currentLearnTitle: snapshot.currentLearnTitle,
    weakestSkill: snapshot.weakestSkill,
  });
  const openingQuestion = buildFreeSpeechOpeningQuestion({
    starterKey: starter.key,
    activeTopic,
    weakestSkill: snapshot.weakestSkill,
  });
  const followUpPrompts = buildFreeSpeechFollowUps(starter.key, activeTopic);
  const starterPrompt = buildFreeSpeechStarterPrompt(starter.key, activeTopic);

  return {
    mode: "free_speech",
    starterKey: starter.key,
    starterLabel: starter.label,
    scenarioKey: null,
    recommendedInteractionMode,
    title: "Pick a topic and start talking",
    description: "Start from class or daily life and let the conversation move naturally.",
    speakingGoal: null,
    whyNow: null,
    mission: {
      scenarioTitle: starter.label,
      scenarioSetup: buildFreeSpeechSetup(starter.key, activeTopic),
      counterpartRole: null,
      canDoStatement: null,
      performanceTask: null,
      openingQuestion,
      introductionText: null,
      targetPhrases: phrases,
      followUpPrompts,
      successCriteria: ["Keep the conversation moving with clear, connected answers."],
      starterPrompt,
      recommendationReason: buildRecommendationReason(
        snapshot,
        activeTopic,
        snapshot.weakestSkill
      ),
      activeTopic,
      focusSkill: snapshot.weakestSkill,
      learnerLevel: snapshot.currentLevel,
      contextHint,
      starterKey: starter.key,
      starterLabel: starter.label,
    },
  };
}

function buildFreeSpeechSetup(starterKey: SpeakStarterKey, activeTopic: string | null) {
  switch (starterKey) {
    case "learning":
      return activeTopic
        ? `Have an open English conversation about something you are learning, especially ${activeTopic}. Keep it natural and follow the learner's topic.`
        : "Have an open English conversation about something the learner is studying. Keep it natural and follow the learner's topic.";
    case "say_better":
      return "Have an open English conversation about something the learner wants to say more clearly. Help them expand their idea naturally without turning it into a task.";
    case "surprise_me":
      return activeTopic
        ? `Open with a natural question tied to ${activeTopic} or another familiar topic from the learner's context, then let the conversation drift naturally if needed.`
        : "Open with a natural question tied to the learner's level or current context, then let the conversation drift naturally if needed.";
    case "today":
    default:
      return "Have an open English conversation about something from the learner's day. Keep the tone warm, natural, and easy to enter.";
  }
}

function buildFreeSpeechOpeningQuestion({
  starterKey,
  activeTopic,
  weakestSkill,
}: {
  starterKey: SpeakStarterKey;
  activeTopic: string | null;
  weakestSkill: string | null;
}) {
  switch (starterKey) {
    case "learning":
      return activeTopic
        ? `What are you learning about ${activeTopic} right now?`
        : "What are you learning right now?";
    case "say_better":
      return weakestSkill === "grammar"
        ? "What's something you want to say more clearly today?"
        : "What's something you want to explain better today?";
    case "surprise_me":
      return activeTopic
        ? `What have you been noticing about ${activeTopic} lately?`
        : "What's been on your mind lately?";
    case "today":
    default:
      return "What happened today?";
  }
}

function buildFreeSpeechStarterPrompt(
  starterKey: SpeakStarterKey,
  activeTopic: string | null
) {
  switch (starterKey) {
    case "learning":
      return activeTopic
        ? `Talk about something you are learning about ${activeTopic}.`
        : "Talk about something you are learning right now.";
    case "say_better":
      return "Talk about something you want to explain more clearly today.";
    case "surprise_me":
      return activeTopic
        ? `Start with ${activeTopic} or another topic that feels natural right now.`
        : "Start with any topic that feels natural right now.";
    case "today":
    default:
      return "Talk about something from today.";
  }
}

function buildFreeSpeechFollowUps(starterKey: SpeakStarterKey, activeTopic: string | null) {
  switch (starterKey) {
    case "learning":
      return [
        "Ask what part feels easiest right now.",
        "Ask what still feels confusing or interesting.",
        "Ask for one real example from class or homework.",
      ];
    case "say_better":
      return [
        "Ask what the learner really wants to say.",
        "Ask for one example that makes the idea clearer.",
        "Ask a follow-up that helps the learner say the same idea in a fuller way.",
      ];
    case "surprise_me":
      return [
        activeTopic
          ? `Ask one natural follow-up tied to ${activeTopic}.`
          : "Ask one natural follow-up tied to the learner's current context.",
        "Ask what feels most interesting or important about it.",
        "Let the topic drift a little if the learner takes it somewhere natural.",
      ];
    case "today":
    default:
      return [
        "Ask what stood out most from today.",
        "Ask one easy follow-up about class or daily life.",
        "Ask for one concrete detail that makes the story clearer.",
      ];
  }
}

function buildFreeSpeechContextHint({
  starterKey,
  activeTopic,
  currentLearnTitle,
  weakestSkill,
}: {
  starterKey: SpeakStarterKey;
  activeTopic: string | null;
  currentLearnTitle: string | null;
  weakestSkill: string | null;
}) {
  const learnTitle = currentLearnTitle?.replace(/^Continue\s+/i, "").trim() ?? null;
  const skillLabel = formatSkillLabel(weakestSkill);

  switch (starterKey) {
    case "learning":
      return activeTopic
        ? `Use ${activeTopic} or another class idea that feels current.`
        : learnTitle
          ? `Use ${learnTitle} or another topic from class.`
          : "Start with something from class, homework, or your current unit.";
    case "say_better":
      return skillLabel
        ? `A good fit if you want to sound clearer in ${skillLabel}.`
        : "Use this when you want help saying a real idea more clearly.";
    case "surprise_me":
      return activeTopic
        ? `We can start from ${activeTopic} and let the conversation go where it wants.`
        : "We will choose a natural topic from your level and recent context.";
    case "today":
    default:
      return activeTopic
        ? `You can start with ${activeTopic} or anything else that happened today.`
        : "Anything from class or daily life is a good place to start.";
  }
}

function buildRecommendationReason(
  snapshot: SpeakPersonalizationSnapshot,
  activeTopic: string | null,
  focusSkill: string | null
) {
  if (snapshot.weakestSkill) {
    const skillLabel = snapshot.weakestSkill.replaceAll("_", " ");

    if (activeTopic) {
      return `Your latest report points to ${skillLabel} as the next focus, and ${activeTopic} gives you a real topic to practice right now.`;
    }

    return `Your latest report points to ${skillLabel} as the best place to build confidence next.`;
  }

  if (activeTopic) {
    return `${activeTopic} gives you a real class topic to practice instead of a generic AI prompt.`;
  }

  if (snapshot.currentLearnTitle) {
    return `${snapshot.currentLearnTitle.replace(/^Continue\s+/i, "")} is already active in Learn, so Speak should stay close to that same path.`;
  }

  if (focusSkill) {
    return `This keeps Speak aligned with your current ${focusSkill.replaceAll("_", " ")} focus.`;
  }

  return "Start with a real classroom conversation so the practice feels useful immediately.";
}

function pickActiveTopic(activeTopics: string[], currentLearnTitle: string | null) {
  const firstTopic = activeTopics[0]?.trim();

  if (firstTopic) {
    return firstTopic;
  }

  const learnTitle = currentLearnTitle?.replace(/^Continue\s+/i, "").trim();
  return learnTitle || null;
}

function baseTargetPhrases(currentLevel: string | null, weakestSkill: string | null) {
  if (weakestSkill === "grammar") {
    return ["I think...", "For example..."];
  }

  if (currentLevel === "advanced" || currentLevel === "intermediate") {
    return ["One reason is...", "For example..."];
  }

  return ["I think...", "Because..."];
}

function baseFreeSpeechPhrases({
  starterKey,
  currentLevel,
}: {
  starterKey: SpeakStarterKey;
  currentLevel: string | null;
}) {
  switch (starterKey) {
    case "learning":
      return currentLevel === "advanced" || currentLevel === "intermediate"
        ? ["I'm learning that...", "One part that stands out is..."]
        : ["I'm learning...", "One thing I understand is..."];
    case "say_better":
      return ["What I want to say is...", "For example..."];
    case "surprise_me":
      return currentLevel === "advanced" || currentLevel === "intermediate"
        ? ["What stands out to me is...", "Because of that..."]
        : ["I think...", "Because..."];
    case "today":
    default:
      return ["Today I...", "One thing that happened was..."];
  }
}

function formatSkillLabel(skill: string | null) {
  return skill ? skill.replaceAll("_", " ") : null;
}

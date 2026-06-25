export type SpeakInteractionMode = "text" | "voice";

export type SpeakPersonalizationSnapshot = {
  currentLevel: string | null;
  weakestSkill: string | null;
  activeTopics: string[];
  currentLearnTitle: string | null;
  plan: "free" | "pro";
  streak?: number;
  confidenceScore?: number;
};

export type SpeakDashboardStats = {
  streak: number;
  confidenceScore: number;
  grammarTrend: "up" | "down" | "flat";
  fluencyTrend: "up" | "down" | "flat";
  vocabTrend: "up" | "down" | "flat";
};

export type SpeakFreeSpeechStarter = {
  id: string;
  label: string;
  prompt: string;
};

export type SpeakMission = {
  id: string;
  title: string;
  objective: string;
  successCriteria: string[];
  recommendedInteractionMode: SpeakInteractionMode;
  missionPayload: Record<string, any>;
};

export type SpeakLaunchViewModel = {
  stats: SpeakDashboardStats;
  freeSpeechStarters: SpeakFreeSpeechStarter[];
  missions: SpeakMission[];
  recommendedInteractionMode: SpeakInteractionMode;
};

export function buildSpeakLaunchViewModel(
  snapshot: SpeakPersonalizationSnapshot
): SpeakLaunchViewModel {
  const recommendedInteractionMode: SpeakInteractionMode = snapshot.plan === "pro" ? "voice" : "text";

  return {
    recommendedInteractionMode,
    stats: {
      streak: snapshot.streak || 12,
      confidenceScore: snapshot.confidenceScore || 74,
      grammarTrend: "up",
      fluencyTrend: "flat",
      vocabTrend: "up",
    },
    freeSpeechStarters: [
      {
        id: "today",
        label: "Talk about my day",
        prompt: "Start with something that happened today.",
      },
      {
        id: "learning",
        label: "Something I'm learning",
        prompt: "Talk about something you are learning in class.",
      },
      {
        id: "say_better",
        label: "Practice an explanation",
        prompt: "Pick one idea you want to explain more clearly.",
      },
      {
        id: "surprise_me",
        label: "Surprise me",
        prompt: "Let the AI choose a good topic from your context.",
      },
    ],
    missions: [
      {
        id: "coffee_shop",
        title: "The Coffee Shop Mix-Up",
        objective: "Politely ask the barista to replace the iced coffee with your hot tea.",
        successCriteria: ["Use 'Excuse me'", "Say 'I ordered hot tea'", "Get the hot tea"],
        recommendedInteractionMode,
        missionPayload: {
          scenarioTitle: "The Coffee Shop Mix-Up",
          scenarioSetup: "You are at a cafe. You ordered a hot tea, but the barista gave you an iced coffee.",
          counterpartRole: "barista",
          canDoStatement: "Politely ask the barista to replace the iced coffee with your hot tea.",
          performanceTask: "Get your hot tea by explaining the mix-up politely.",
          starterPrompt: "Here is your iced coffee. Have a nice day!",
          targetPhrases: ["Excuse me", "I ordered", "hot tea"],
          stageKey: "coffee_shop",
          sceneType: "cinematic_2d",
        }
      },
      {
        id: "directions",
        title: "Lost in the City",
        objective: "Ask a stranger for directions and find your way to the library.",
        successCriteria: ["Use 'Excuse me'", "Ask 'where is'", "Thank them for helping"],
        recommendedInteractionMode,
        missionPayload: {
          scenarioTitle: "Lost in the City",
          scenarioSetup: "You are lost on the street and need to find the library. You see someone who might be able to help.",
          counterpartRole: "staff_member",
          canDoStatement: "Ask a stranger for directions and find your way to the library.",
          performanceTask: "Get clear directions to the library by asking politely.",
          starterPrompt: "Hi, do you need help?",
          targetPhrases: ["Excuse me", "where is"],
          stageKey: "directions",
          sceneType: "cinematic_2d",
        }
      },
      {
        id: "office_hours",
        title: "Office Hours",
        objective: "Ask your teacher for help and leave with a clear next step.",
        successCriteria: ["Explain what is confusing", "Ask a follow-up question", "Thank the teacher"],
        recommendedInteractionMode,
        missionPayload: {
          scenarioTitle: "Office Hours",
          scenarioSetup: "You are meeting your English teacher during office hours. You don't understand part of the homework assignment.",
          counterpartRole: "teacher",
          canDoStatement: "Ask your teacher for help and leave with a clear next step.",
          performanceTask: "Explain what confuses you and ask a question to clarify.",
          starterPrompt: "Hello, come in. What can I help you with today?",
          targetPhrases: ["I need help with", "I don't understand"],
          stageKey: "classroom",
          sceneType: "cinematic_2d",
        }
      }
    ]
  };
}

export function buildSpeakMissionPayload(
    type: "free_speech" | "mission",
    id: string | null,
    snapshot: SpeakPersonalizationSnapshot
) {
    const vm = buildSpeakLaunchViewModel(snapshot);
    if (type === "free_speech") {
        const starter = vm.freeSpeechStarters.find(s => s.id === id) || vm.freeSpeechStarters[0];
        return {
            scenarioTitle: starter?.label ?? "Open conversation",
            scenarioSetup: "The user is having an open conversation. Keep the tone natural, helpful, and conversational.",
            starterPrompt: starter.prompt,
            targetPhrases: ["I think", "Because"],
            starterLabel: starter?.label ?? "Open conversation",
            stageKey: "open_conversation",
            sceneType: "cinematic_2d",
        };
    }
    if (type === "mission") {
        const mission = vm.missions.find(m => m.id === id);
        return mission?.missionPayload || {};
    }
    return {};
}

function pickActiveTopic(activeTopics: string[], currentLearnTitle: string | null) {
  const firstTopic = activeTopics[0]?.trim();
  if (firstTopic) return firstTopic;
  const learnTitle = currentLearnTitle?.replace(/^Continue\s+/i, "").trim();
  return learnTitle || null;
}

import { GUIDED_SCENARIOS, SPEAK_STARTERS } from "@/lib/constants";

type SpeakMode = "free_speech" | "guided";
type InteractionMode = "text" | "voice";

type SpeakPersonalizationSnapshot = {
  currentLevel: string | null;
  weakestSkill: string | null;
  activeTopics: string[];
  currentLearnTitle: string | null;
  plan: "free" | "pro";
};

export type SpeakMissionPlan = {
  mode: SpeakMode;
  starterKey: string | null;
  scenarioKey: string | null;
  recommendedInteractionMode: InteractionMode;
  title: string;
  description: string;
  speakingGoal: string;
  whyNow: string;
  mission: {
    scenarioTitle: string;
    scenarioSetup: string;
    counterpartRole: string;
    canDoStatement: string;
    performanceTask: string;
    openingQuestion: string;
    introductionText: string;
    targetPhrases: string[];
    followUpPrompts: string[];
    successCriteria: string[];
    starterPrompt: string;
    recommendationReason: string;
    activeTopic: string | null;
    focusSkill: string | null;
    learnerLevel: string | null;
  };
};

export type SpeakLaunchViewModel = {
  recommendation: SpeakMissionPlan;
  starters: Array<{ key: string; label: string; prompt: string }>;
  guidedScenarios: Array<{ key: string; title: string; description: string }>;
};

type SpeakSelection = {
  mode: SpeakMode;
  starterKey?: string | null;
  scenarioKey?: string | null;
};

export function buildSpeakLaunchViewModel(
  snapshot: SpeakPersonalizationSnapshot
): SpeakLaunchViewModel {
  return {
    recommendation: buildRecommendedSpeakMission(snapshot),
    starters: [...SPEAK_STARTERS],
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

  if (snapshot.activeTopics.length > 0) {
    return buildSpeakMission(
      {
        mode: "free_speech",
        starterKey: "test_prep",
      },
      snapshot
    );
  }

  if (snapshot.currentLearnTitle) {
    return buildSpeakMission(
      {
        mode: "guided",
        scenarioKey: "class_discussion",
      },
      snapshot
    );
  }

  return buildSpeakMission(
    {
      mode: "free_speech",
      starterKey: "school_day",
    },
    snapshot
  );
}

export function buildSpeakMission(
  selection: SpeakSelection,
  snapshot: SpeakPersonalizationSnapshot
): SpeakMissionPlan {
  const activeTopic = pickActiveTopic(snapshot.activeTopics, snapshot.currentLearnTitle);
  const phrases = baseTargetPhrases(snapshot.currentLevel, snapshot.weakestSkill);
  const recommendedInteractionMode: InteractionMode = snapshot.plan === "pro" ? "voice" : "text";

  if (selection.mode === "guided") {
    switch (selection.scenarioKey) {
      case "office_hours":
        return {
          mode: "guided",
          starterKey: null,
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
          },
        };
      case "presentation_practice":
        return {
          mode: "guided",
          starterKey: null,
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
          },
        };
      case "class_discussion":
      default:
        return {
          mode: "guided",
          starterKey: null,
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
          },
        };
    }
  }

  switch (selection.starterKey) {
    case "homework_help":
      return {
        mode: "free_speech",
        starterKey: "homework_help",
        scenarioKey: null,
        recommendedInteractionMode,
        title: activeTopic ? `Talk through ${activeTopic}` : "Talk through homework clearly",
        description: activeTopic
          ? `Use a real class topic so Speak feels closer to a real teacher conversation than a blank AI chat.`
          : "Explain one homework problem, say what you understand, and keep the conversation moving.",
        speakingGoal: "Name the problem, say what you know, then add one example.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: activeTopic ? `Homework talk: ${activeTopic}` : "Homework talk",
          scenarioSetup: activeTopic
            ? `You are explaining a homework problem about ${activeTopic}. Say what feels clear, what still feels hard, and respond to one follow-up question.`
            : "You are explaining one homework problem. Say what feels clear, what still feels hard, and respond to one follow-up question.",
          counterpartRole: "teacher",
          canDoStatement:
            "I can explain what I understand, what feels difficult, and ask for help clearly.",
          performanceTask:
            "Describe the problem, add one concrete detail, and answer a follow-up question naturally.",
          openingQuestion: activeTopic
            ? `What homework question about ${activeTopic} are you unsure about?`
            : "What homework question are you unsure about?",
          introductionText: "Hi, I'm here to talk through one homework question with you.",
          targetPhrases: [phrases[0], "The part that confuses me is..."],
          followUpPrompts: [
            "Ask what the learner already understands.",
            "Ask for one example from the assignment.",
            "Ask what the learner wants to say next.",
          ],
          successCriteria: [
            "Explain the problem clearly in connected sentences.",
            "Add one detail about what feels confusing or what you already know.",
          ],
          starterPrompt: activeTopic
            ? `Explain one homework question about ${activeTopic} that still feels difficult.`
            : "Explain one homework question you are unsure about.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
        },
      };
    case "test_prep":
      return {
        mode: "free_speech",
        starterKey: "test_prep",
        scenarioKey: null,
        recommendedInteractionMode,
        title: activeTopic ? `Practice ${activeTopic}` : "Practice this week's topic",
        description: activeTopic
          ? `Use a real class topic so the conversation feels immediately useful and easier to transfer back to class.`
          : "Practice explaining a topic that could show up on your next quiz or class discussion.",
        speakingGoal: "Explain the topic clearly and add one example.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: activeTopic ? `Topic practice: ${activeTopic}` : "Topic practice",
          scenarioSetup: activeTopic
            ? `You are practicing how to talk about ${activeTopic} before class or a quiz. Keep your explanation clear and connected.`
            : "You are practicing how to talk about this week's topic before class or a quiz.",
          counterpartRole: "classmate",
          canDoStatement:
            "I can explain a class topic clearly and support it with one example.",
          performanceTask:
            "Explain the topic, add one example, and respond to one follow-up question naturally.",
          openingQuestion: activeTopic
            ? `What do you want to say clearly about ${activeTopic} today?`
            : "What topic are you practicing today?",
          introductionText: activeTopic
            ? `Hi, let's practice talking about ${activeTopic} before class.`
            : "Hi, let's practice talking through this week's topic.",
          targetPhrases: [phrases[0], phrases[1]],
          followUpPrompts: [
            "Ask for one specific example.",
            "Ask what idea matters most.",
            "Ask why the topic is important.",
          ],
          successCriteria: [
            "Explain the topic clearly in connected sentences.",
            "Add one reason or example that makes the explanation stronger.",
          ],
          starterPrompt: activeTopic
            ? `Practice a short explanation about ${activeTopic}.`
            : "Practice a short dialogue using this week's test topics.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
        },
      };
    case "free_topic":
      return {
        mode: "free_speech",
        starterKey: "free_topic",
        scenarioKey: null,
        recommendedInteractionMode,
        title: "Talk about anything real",
        description:
          "Keep the conversation grounded in a real class or life topic so the practice still feels useful.",
        speakingGoal: "Choose one real topic and keep the conversation moving for a few turns.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: "Open speaking practice",
          scenarioSetup:
            "Choose one real class or life topic, explain it clearly, and keep the conversation moving with follow-up questions.",
          counterpartRole: "conversation_partner",
          canDoStatement:
            "I can choose a real topic, explain it clearly, and stay in the conversation.",
          performanceTask:
            "Introduce the topic, add one detail, and respond naturally to one follow-up question.",
          openingQuestion: "What topic do you want to talk through today?",
          introductionText: "Hi, let's talk about something real from your class or daily life.",
          targetPhrases: [phrases[0], phrases[1]],
          followUpPrompts: [
            "Ask one follow-up that invites more detail.",
            "Ask for one example or reason.",
          ],
          successCriteria: [
            "Choose a clear topic and explain it in connected sentences.",
            "Add one useful detail or example.",
          ],
          starterPrompt: "Choose any topic and start speaking.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
        },
      };
    case "school_day":
    default:
      return {
        mode: "free_speech",
        starterKey: "school_day",
        scenarioKey: null,
        recommendedInteractionMode,
        title: "Talk through your school day",
        description:
          "Start with a familiar topic so Speak feels easy to enter and still gives useful language practice.",
        speakingGoal: "Describe one class clearly and add one detail that matters.",
        whyNow: buildRecommendationReason(snapshot, activeTopic, snapshot.weakestSkill),
        mission: {
          scenarioTitle: "My school day",
          scenarioSetup:
            "Talk about your classes today, describe one thing you studied, and keep the conversation moving naturally.",
          counterpartRole: "classmate",
          canDoStatement:
            "I can describe my classes clearly and add one useful detail.",
          performanceTask:
            "Describe one class, explain what you did, and answer one short follow-up question.",
          openingQuestion: "What class are you thinking about today?",
          introductionText: "Hi, I'm getting ready for class with you today.",
          targetPhrases: [phrases[0], phrases[1]],
          followUpPrompts: [
            "Ask what happened in class.",
            "Ask what felt easy or difficult.",
            "Ask for one concrete example.",
          ],
          successCriteria: [
            "Describe one class clearly in connected sentences.",
            "Add one detail that makes the answer more specific.",
          ],
          starterPrompt: "Tell me about your classes today.",
          recommendationReason: buildRecommendationReason(
            snapshot,
            activeTopic,
            snapshot.weakestSkill
          ),
          activeTopic,
          focusSkill: snapshot.weakestSkill,
          learnerLevel: snapshot.currentLevel,
        },
      };
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

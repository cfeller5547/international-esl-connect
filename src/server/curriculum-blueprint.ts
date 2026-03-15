import { inferLearnOpeningQuestion } from "@/server/learn-speaking-prompts";
import { AUTHORED_SPEAKING_MISSIONS } from "@/server/curriculum-speaking-missions";

export const CURRICULUM_LEVELS = [
  "very_basic",
  "basic",
  "intermediate",
  "advanced",
] as const;

export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number];

export const UNIT_ACTIVITY_TYPES = [
  "lesson",
  "practice",
  "speaking",
  "writing",
  "checkpoint",
] as const;

export type UnitActivityType = (typeof UNIT_ACTIVITY_TYPES)[number];

export type LessonCheck = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type PracticeQuestion = {
  id: string;
  prompt: string;
  answer: string;
};

export type UnitBlueprint = {
  slug: string;
  title: string;
  summary: string;
  canDoStatement: string;
  theme: string;
  keyVocabulary: string[];
  languageFocus: string[];
  performanceTask: string;
  scenario: string;
  lessonSections: Array<{ title: string; body: string }>;
  lessonChecks: LessonCheck[];
  practiceQuestions: PracticeQuestion[];
  speakingMission: {
    scenarioTitle: string;
    scenarioSetup: string;
    counterpartRole: string;
    openingQuestion: string;
    warmupPrompts: string[];
    targetPhrases: string[];
    followUpPrompts: string[];
    successCriteria: string[];
    modelExample: string;
    isBenchmark: boolean;
  };
  writingPrompt: string;
  writingCriteria: string[];
  checkpointQuestions: LessonCheck[];
};

export type CurriculumBlueprint = {
  level: CurriculumLevel;
  title: string;
  description: string;
  units: UnitBlueprint[];
};

const rankMap: Record<CurriculumLevel, number> = {
  very_basic: 0,
  basic: 1,
  intermediate: 2,
  advanced: 3,
};

export function getLevelRank(level: CurriculumLevel) {
  return rankMap[level];
}

export function normalizeLevelLabel(
  level: string | null | undefined
): CurriculumLevel {
  if (!level) {
    return "very_basic";
  }

  if (level === "foundation") {
    return "very_basic";
  }

  if (CURRICULUM_LEVELS.includes(level as CurriculumLevel)) {
    return level as CurriculumLevel;
  }

  return "very_basic";
}

function stableId(seed: number) {
  return `20000000-0000-4000-8000-${seed.toString().padStart(12, "0")}`;
}

const levelCode: Record<CurriculumLevel, number> = {
  very_basic: 1,
  basic: 2,
  intermediate: 3,
  advanced: 4,
};

const activityCode: Record<UnitActivityType, number> = {
  lesson: 1,
  practice: 2,
  speaking: 3,
  writing: 4,
  checkpoint: 5,
};

export function getCurriculumId(level: CurriculumLevel) {
  return stableId(100 + levelCode[level]);
}

export function getUnitId(level: CurriculumLevel, unitIndex: number) {
  return stableId(1_000 + levelCode[level] * 100 + unitIndex);
}

export function getLessonContentId(level: CurriculumLevel, unitIndex: number) {
  return stableId(2_000 + levelCode[level] * 100 + unitIndex);
}

export function getPracticeContentId(level: CurriculumLevel, unitIndex: number) {
  return stableId(3_000 + levelCode[level] * 100 + unitIndex);
}

export function getActivityId(
  level: CurriculumLevel,
  unitIndex: number,
  type: UnitActivityType
) {
  return stableId(4_000 + levelCode[level] * 100 + unitIndex * 10 + activityCode[type]);
}

type RawUnitBlueprint = {
  slug: string;
  title: string;
  summary: string;
  canDoStatement: string;
  theme: string;
  keyVocabulary: string[];
  languageFocus: string[];
  performanceTask: string;
  scenario: string;
};

function createChecks(raw: RawUnitBlueprint): LessonCheck[] {
  return [
    {
      prompt: `Which sentence best matches this unit goal: ${raw.canDoStatement}?`,
      options: [
        raw.performanceTask,
        `I can list vocabulary for ${raw.theme.toLowerCase()} but not use it in context.`,
        `I can repeat words from memory without explaining ideas.`,
      ],
      correctIndex: 0,
    },
    {
      prompt: `Which language focus belongs in ${raw.title}?`,
      options: [
        raw.languageFocus.join(", "),
        "Random memorization with no theme",
        "Advanced essay writing only",
      ],
      correctIndex: 0,
    },
  ];
}

function createPracticeQuestions(
  level: CurriculumLevel,
  unitIndex: number,
  raw: RawUnitBlueprint
): PracticeQuestion[] {
  return [
    {
      id: `${level}-${unitIndex}-practice-1`,
      prompt: `Write one sentence that fits this scenario: ${raw.scenario}.`,
      answer: "free_response",
    },
    {
      id: `${level}-${unitIndex}-practice-2`,
      prompt: `Use one of these language-focus ideas in a sentence: ${raw.languageFocus.join(", ")}.`,
      answer: "free_response",
    },
    {
      id: `${level}-${unitIndex}-practice-3`,
      prompt: `Use at least one of these vocabulary words in context: ${raw.keyVocabulary.slice(0, 3).join(", ")}.`,
      answer: "free_response",
    },
  ];
}

function inferCounterpartRole(raw: RawUnitBlueprint) {
  const normalized = `${raw.scenario} ${raw.performanceTask}`.toLowerCase();

  if (normalized.includes("interview")) {
    return "interviewer";
  }

  if (normalized.includes("customer")) {
    return "customer";
  }

  if (
    normalized.includes("classmate") ||
    normalized.includes("partner") ||
    normalized.includes("group")
  ) {
    return "classmate";
  }

  if (normalized.includes("teacher") || normalized.includes("class")) {
    return "teacher";
  }

  return "conversation partner";
}

function createOpeningQuestion(raw: RawUnitBlueprint) {
  return inferLearnOpeningQuestion({
    scenarioTitle: raw.title,
    scenarioSetup: raw.scenario,
    canDoStatement: raw.canDoStatement,
    performanceTask: raw.performanceTask,
  });
}

function createUnit(raw: RawUnitBlueprint, level: CurriculumLevel, unitIndex: number): UnitBlueprint {
  const authoredSpeakingMission = AUTHORED_SPEAKING_MISSIONS[raw.slug];

  return {
    ...raw,
    lessonSections: [
      {
        title: "Discover the scenario",
        body: `This unit is built around ${raw.theme.toLowerCase()}. Start by noticing how the situation works in real life and what a successful response sounds like.`,
      },
      {
        title: "Learn the language moves",
        body: `Focus on ${raw.languageFocus.join(", ")} so the learner can perform the unit goal with more control and clarity.`,
      },
      {
        title: "Apply it with purpose",
        body: `The unit ends with a real task: ${raw.performanceTask}`,
      },
    ],
    lessonChecks: createChecks(raw),
    practiceQuestions: createPracticeQuestions(level, unitIndex, raw),
    speakingMission: {
      scenarioTitle: authoredSpeakingMission?.scenarioTitle ?? raw.title,
      scenarioSetup: authoredSpeakingMission?.scenarioSetup ?? raw.scenario,
      counterpartRole:
        authoredSpeakingMission?.counterpartRole ?? inferCounterpartRole(raw),
      openingQuestion:
        authoredSpeakingMission?.openingQuestion ?? createOpeningQuestion(raw),
      warmupPrompts:
        authoredSpeakingMission?.warmupPrompts ?? [
          "Say the main idea of this situation in one sentence.",
          `Practice one phrase using ${raw.keyVocabulary.slice(0, 2).join(" and ")}.`,
        ],
      targetPhrases:
        authoredSpeakingMission?.targetPhrases ?? raw.keyVocabulary.slice(0, 4),
      followUpPrompts:
        authoredSpeakingMission?.followUpPrompts ?? [
          `Respond to this scenario: ${raw.scenario}`,
          `Add one useful detail that supports this goal: ${raw.canDoStatement}`,
          `Finish by showing this performance task: ${raw.performanceTask}`,
        ],
      successCriteria:
        authoredSpeakingMission?.successCriteria ?? [
          raw.canDoStatement,
          `Use language focus such as ${raw.languageFocus.join(", ")}.`,
          `Include vocabulary such as ${raw.keyVocabulary.slice(0, 3).join(", ")}.`,
        ],
      modelExample: authoredSpeakingMission?.modelExample ?? raw.performanceTask,
      isBenchmark: unitIndex === 3 || unitIndex === 6,
    },
    writingPrompt: `${raw.performanceTask} Write 5 to 8 sentences that fit the scenario and unit goal.`,
    writingCriteria: [
      `Show the unit goal: ${raw.canDoStatement}`,
      `Use language from this unit: ${raw.languageFocus.join(", ")}`,
      `Include vocabulary such as ${raw.keyVocabulary.slice(0, 3).join(", ")}`,
    ],
    checkpointQuestions: [
      {
        prompt: `Which task best proves the learner can do this: ${raw.canDoStatement}?`,
        options: [
          raw.performanceTask,
          "Repeat isolated vocabulary with no context",
          "Skip the scenario and answer with one word",
        ],
        correctIndex: 0,
      },
      {
        prompt: `Which theme matches ${raw.title}?`,
        options: [raw.theme, "Unrelated abstract grammar review", "Random translation only"],
        correctIndex: 0,
      },
    ],
  };
}

function curriculum(
  level: CurriculumLevel,
  title: string,
  description: string,
  units: RawUnitBlueprint[]
): CurriculumBlueprint {
  return {
    level,
    title,
    description,
    units: units.map((unit, index) => createUnit(unit, level, index + 1)),
  };
}

export const CURRICULUM_BLUEPRINTS: CurriculumBlueprint[] = [
  curriculum(
    "very_basic",
    "Very Basic English",
    "A practical survival curriculum for learners who are building first confidence with everyday English.",
    [
      {
        slug: "introductions-and-personal-information",
        title: "Introductions and Personal Information",
        summary: "Start with greetings, names, age, country, and simple personal details.",
        canDoStatement: "I can introduce myself and ask simple personal questions.",
        theme: "First day introductions",
        keyVocabulary: ["hello", "name", "from", "country", "age", "student"],
        languageFocus: ["be statements", "wh- questions", "subject pronouns"],
        performanceTask: "Introduce yourself to a new classmate and ask two basic questions.",
        scenario: "You meet a new student before class starts.",
      },
      {
        slug: "family-friends-and-classroom-language",
        title: "Family, Friends, and Classroom Language",
        summary: "Talk about important people and use simple classroom words and requests.",
        canDoStatement: "I can describe family members and use simple classroom language.",
        theme: "My people and my classroom",
        keyVocabulary: ["mother", "friend", "teacher", "book", "pencil", "brother"],
        languageFocus: ["have and has", "this and that", "simple descriptions"],
        performanceTask: "Describe one family member and make one classroom request.",
        scenario: "You are talking about your family and asking for help in class.",
      },
      {
        slug: "daily-routines-time-and-schedules",
        title: "Daily Routines, Time, and Schedules",
        summary: "Talk about everyday habits, times, and simple schedules.",
        canDoStatement: "I can describe my daily routine and say when things happen.",
        theme: "A school day",
        keyVocabulary: ["wake up", "class", "morning", "afternoon", "study", "homework"],
        languageFocus: ["simple present", "time phrases", "frequency words"],
        performanceTask: "Explain your school-day routine from morning to evening.",
        scenario: "You are telling a classmate about your normal weekday.",
      },
      {
        slug: "food-shopping-and-likes-dislikes",
        title: "Food, Shopping, and Likes and Dislikes",
        summary: "Order simple food, talk about preferences, and ask about prices.",
        canDoStatement: "I can say what I like, buy simple items, and understand basic prices.",
        theme: "Food and everyday shopping",
        keyVocabulary: ["apple", "bread", "water", "price", "buy", "like"],
        languageFocus: ["like and do not like", "how much", "shopping phrases"],
        performanceTask: "Order a snack and explain what food you like or do not like.",
        scenario: "You are buying a snack after class.",
      },
      {
        slug: "home-school-and-neighborhood",
        title: "Home, School, and Neighborhood",
        summary: "Describe places around you and give simple directions.",
        canDoStatement: "I can describe my home or school area and give basic directions.",
        theme: "Places around me",
        keyVocabulary: ["home", "school", "library", "street", "near", "next to"],
        languageFocus: ["there is and there are", "place words", "direction phrases"],
        performanceTask: "Describe an important place and explain how to find it.",
        scenario: "A new student asks where places are near school.",
      },
      {
        slug: "simple-plans-weather-and-practical-review",
        title: "Simple Plans, Weather, and Practical Review",
        summary: "Talk about near-future plans, simple weather, and review key beginner communication.",
        canDoStatement: "I can talk about tomorrow, simple plans, and basic weather.",
        theme: "Tomorrow and daily life",
        keyVocabulary: ["tomorrow", "rain", "sunny", "weekend", "visit", "plan"],
        languageFocus: ["going to", "future time expressions", "review structures"],
        performanceTask: "Tell a friend your weekend plan and how the weather might affect it.",
        scenario: "You are making a simple weekend plan with a friend.",
      },
    ]
  ),
  curriculum(
    "basic",
    "Basic English",
    "A practical everyday curriculum that builds connected sentences, short stories, and simple opinions.",
    [
      {
        slug: "habits-and-routines-in-more-detail",
        title: "Habits and Routines in More Detail",
        summary: "Describe routines with more detail, frequency, and short connected ideas.",
        canDoStatement: "I can explain my routine with time, detail, and frequency.",
        theme: "A fuller picture of daily life",
        keyVocabulary: ["usually", "often", "before", "after", "homework", "exercise"],
        languageFocus: ["simple present detail", "frequency adverbs", "sequence words"],
        performanceTask: "Describe your normal weekday in a clear short paragraph.",
        scenario: "You are telling a teacher about your daily schedule.",
      },
      {
        slug: "past-events-and-weekend-stories",
        title: "Past Events and Weekend Stories",
        summary: "Use the simple past to tell short stories about completed events.",
        canDoStatement: "I can describe what happened last weekend in order.",
        theme: "Weekend stories",
        keyVocabulary: ["visited", "watched", "cooked", "later", "finally", "yesterday"],
        languageFocus: ["simple past", "time markers", "story sequence"],
        performanceTask: "Tell a short story about what you did over the weekend.",
        scenario: "A classmate asks what you did last weekend.",
      },
      {
        slug: "what-is-happening-now",
        title: "What Is Happening Now",
        summary: "Describe actions in progress and current situations clearly.",
        canDoStatement: "I can describe what is happening right now.",
        theme: "Live situations and current action",
        keyVocabulary: ["right now", "working", "reading", "talking", "wearing", "today"],
        languageFocus: ["present continuous", "action in progress", "scene description"],
        performanceTask: "Describe what people are doing in a current situation.",
        scenario: "You are describing what is happening in class and around you.",
      },
      {
        slug: "school-work-and-responsibilities",
        title: "School, Work, and Responsibilities",
        summary: "Explain duties, obligations, and simple problem-solving language.",
        canDoStatement: "I can talk about responsibilities and what I need to do.",
        theme: "Tasks and responsibilities",
        keyVocabulary: ["need to", "have to", "finish", "assignment", "project", "responsibility"],
        languageFocus: ["obligation language", "instructions", "short explanations"],
        performanceTask: "Explain a task you need to complete and how you will do it.",
        scenario: "You are talking with a teacher about assignments and deadlines.",
      },
      {
        slug: "health-travel-and-everyday-services",
        title: "Health, Travel, and Everyday Services",
        summary: "Handle simple service situations like asking for help, appointments, or directions.",
        canDoStatement: "I can ask for help and manage common service situations.",
        theme: "Solving everyday needs",
        keyVocabulary: ["appointment", "ticket", "medicine", "bus stop", "help", "problem"],
        languageFocus: ["requests", "service questions", "simple advice"],
        performanceTask: "Handle one short real-world service conversation clearly.",
        scenario: "You need help with transportation, health, or a public service.",
      },
      {
        slug: "comparing-choosing-and-short-narratives",
        title: "Comparing, Choosing, and Short Narratives",
        summary: "Compare options, explain preferences, and write short connected paragraphs.",
        canDoStatement: "I can compare two options and explain my choice.",
        theme: "Decisions and preferences",
        keyVocabulary: ["better", "more", "prefer", "choice", "because", "than"],
        languageFocus: ["comparatives", "preference language", "short connected writing"],
        performanceTask: "Compare two options and explain which one you prefer.",
        scenario: "You are choosing between two activities, classes, or plans.",
      },
    ]
  ),
  curriculum(
    "intermediate",
    "Intermediate English",
    "A connected communication curriculum focused on stories, opinions, summaries, and real-world interaction.",
    [
      {
        slug: "tell-stories-clearly",
        title: "Tell Stories Clearly",
        summary: "Build longer narratives with sequence, detail, and reflection.",
        canDoStatement: "I can tell a clear story with context, sequence, and detail.",
        theme: "Narrative communication",
        keyVocabulary: ["suddenly", "eventually", "detail", "experience", "memory", "reaction"],
        languageFocus: ["narrative sequencing", "past framing", "reflection"],
        performanceTask: "Tell a connected story about a meaningful past experience.",
        scenario: "You are sharing a memorable experience with a class or group.",
      },
      {
        slug: "explain-opinions-and-give-reasons",
        title: "Explain Opinions and Give Reasons",
        summary: "Move beyond yes-no answers and support your ideas clearly.",
        canDoStatement: "I can express an opinion and support it with reasons.",
        theme: "Opinion and explanation",
        keyVocabulary: ["opinion", "reason", "support", "benefit", "challenge", "evidence"],
        languageFocus: ["opinion frames", "because and so", "reason organization"],
        performanceTask: "Give an opinion on a familiar topic and support it clearly.",
        scenario: "You are answering a discussion question in class.",
      },
      {
        slug: "solve-problems-and-make-decisions",
        title: "Solve Problems and Make Decisions",
        summary: "Use modal verbs and collaborative language to discuss options and solutions.",
        canDoStatement: "I can discuss a problem, suggest solutions, and make a decision.",
        theme: "Planning and problem solving",
        keyVocabulary: ["should", "could", "option", "solution", "decision", "possible"],
        languageFocus: ["modals for advice", "suggestion language", "decision-making discussion"],
        performanceTask: "Discuss a problem and recommend the best solution.",
        scenario: "Your group needs to solve a school or travel problem together.",
      },
      {
        slug: "study-summarize-and-respond",
        title: "Study, Summarize, and Respond",
        summary: "Read for main ideas, summarize, and respond to information with your own words.",
        canDoStatement: "I can summarize key ideas from a text and respond thoughtfully.",
        theme: "Reading to learn",
        keyVocabulary: ["main idea", "detail", "summary", "response", "source", "evidence"],
        languageFocus: ["summary frames", "paraphrase basics", "response language"],
        performanceTask: "Summarize a short text and respond to its main idea.",
        scenario: "You are reading class material and need to show understanding.",
      },
      {
        slug: "future-plans-goals-and-possibilities",
        title: "Future Plans, Goals, and Possibilities",
        summary: "Describe goals, intentions, and possibilities using future forms.",
        canDoStatement: "I can explain future plans, goals, and possibilities.",
        theme: "Planning ahead",
        keyVocabulary: ["goal", "plan", "future", "possible", "next step", "prepare"],
        languageFocus: ["will", "going to", "future possibility language"],
        performanceTask: "Explain a future goal and the steps you will take to reach it.",
        scenario: "You are discussing goals for school, work, or travel.",
      },
      {
        slug: "real-world-interaction-travel-interviews-presentations",
        title: "Real-World Interaction, Travel, Interviews, Presentations",
        summary: "Handle common real-world situations with confidence and clarity.",
        canDoStatement: "I can manage familiar real-world interactions with connected language.",
        theme: "Interactive communication",
        keyVocabulary: ["interview", "presentation", "reservation", "experience", "strength", "explain"],
        languageFocus: ["functional interaction language", "clear explanations", "follow-up responses"],
        performanceTask: "Respond to a realistic speaking scenario with clear, confident language.",
        scenario: "You are traveling, interviewing, or presenting information.",
      },
    ]
  ),
  curriculum(
    "advanced",
    "Advanced English",
    "A high-rigor curriculum for argument, interpretation, academic writing, and professional communication.",
    [
      {
        slug: "analyze-arguments-and-evidence",
        title: "Analyze Arguments and Evidence",
        summary: "Identify claims, support, and reasoning in complex ideas and texts.",
        canDoStatement: "I can analyze an argument and evaluate the strength of its evidence.",
        theme: "Critical reading and reasoning",
        keyVocabulary: ["claim", "evidence", "reasoning", "assumption", "support", "counterpoint"],
        languageFocus: ["analytical framing", "evidence commentary", "evaluation language"],
        performanceTask: "Analyze an argument and explain whether its evidence is convincing.",
        scenario: "You are discussing a persuasive article or presentation.",
      },
      {
        slug: "speak-and-write-in-formal-registers",
        title: "Speak and Write in Formal Registers",
        summary: "Adapt language for academic, professional, and formal communication.",
        canDoStatement: "I can express ideas in a clear formal register when needed.",
        theme: "Register and tone control",
        keyVocabulary: ["formal", "register", "appropriate", "professional", "audience", "tone"],
        languageFocus: ["formal register", "tone shifts", "precise phrasing"],
        performanceTask: "Rewrite or present an idea in a more formal academic or professional style.",
        scenario: "You are writing or presenting for a teacher, employer, or formal audience.",
      },
      {
        slug: "debate-persuade-and-respond",
        title: "Debate, Persuade, and Respond",
        summary: "Use stance, rebuttal, and persuasive support in spoken and written argument.",
        canDoStatement: "I can defend a position, respond to objections, and persuade an audience.",
        theme: "Persuasion and debate",
        keyVocabulary: ["stance", "rebuttal", "counterargument", "persuade", "convincing", "position"],
        languageFocus: ["stance language", "counterargument moves", "rebuttal"],
        performanceTask: "Present a persuasive argument and respond to an opposing view.",
        scenario: "You are in a structured class debate or persuasive discussion.",
      },
      {
        slug: "interpret-complex-texts-and-implied-meaning",
        title: "Interpret Complex Texts and Implied Meaning",
        summary: "Read beyond the surface and explain implications, tone, and author purpose.",
        canDoStatement: "I can interpret implied meaning and explain how a text creates it.",
        theme: "Inference and interpretation",
        keyVocabulary: ["implicit", "inference", "tone", "purpose", "subtle", "implication"],
        languageFocus: ["interpretive language", "tone analysis", "purpose explanation"],
        performanceTask: "Explain what a text implies and how the author communicates it.",
        scenario: "You are reading a demanding text that requires interpretation.",
      },
      {
        slug: "academic-and-professional-communication",
        title: "Academic and Professional Communication",
        summary: "Communicate effectively in meetings, presentations, reports, and formal exchanges.",
        canDoStatement: "I can communicate clearly for academic and professional purposes.",
        theme: "Professional and academic use",
        keyVocabulary: ["proposal", "summary", "presentation", "objective", "recommendation", "clarify"],
        languageFocus: ["presentation structure", "formal explanation", "recommendation language"],
        performanceTask: "Deliver or draft a professional-style explanation or recommendation.",
        scenario: "You are presenting information in school or a workplace setting.",
      },
      {
        slug: "capstone-synthesize-argue-recommend",
        title: "Capstone: Synthesize, Argue, Recommend",
        summary: "Bring together advanced reading, speaking, and writing in one integrated unit.",
        canDoStatement: "I can synthesize information, build an argument, and recommend a course of action.",
        theme: "Integrated advanced communication",
        keyVocabulary: ["synthesize", "integrate", "justify", "recommendation", "impact", "tradeoff"],
        languageFocus: ["synthesis moves", "argument structure", "decision rationale"],
        performanceTask: "Analyze a complex issue, synthesize perspectives, and recommend a justified next step.",
        scenario: "You are presenting a recommendation on a complex social, academic, or professional issue.",
      },
    ]
  ),
];

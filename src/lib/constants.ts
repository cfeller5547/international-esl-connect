export const APP_VERSION = "0.1.0";

export const SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "vocabulary",
  "grammar",
] as const;

export const TARGET_LANGUAGES = ["english", "spanish", "chinese"] as const;
export const NATIVE_LANGUAGES = ["english", "spanish", "chinese"] as const;
export const AGE_BANDS = ["13-15", "16-18", "18-24"] as const;
export const SCHOOL_LEVELS = ["high_school", "college"] as const;

export const STREAK_MILESTONES = [3, 7, 14] as const;

export const FREE_TIER_LIMITS = {
  speakTextTurnsPerDay: 120,
  speakVoiceSecondsLifetimeTrial: 180,
  homeworkUploadsPerDay: 3,
  reassessmentsPer30Days: 1,
  testPrepPlansPer30Days: 2,
} as const;

export const TOP_NAV_ITEMS = [
  { label: "Home", href: "/app/home", key: "home" },
  { label: "Learn", href: "/app/learn", key: "learn" },
  { label: "Speak", href: "/app/speak", key: "speak" },
  { label: "Tools", href: "/app/tools", key: "tools" },
  { label: "Progress", href: "/app/progress", key: "progress" },
] as const;

export const SPEAK_STARTERS = [
  {
    key: "today",
    label: "Something from today",
    prompt: "Start with something that happened today.",
  },
  {
    key: "learning",
    label: "Something I'm learning",
    prompt: "Talk about something you are learning in class.",
  },
  {
    key: "say_better",
    label: "Something I want to say better",
    prompt: "Pick one idea you want to explain more clearly.",
  },
  {
    key: "surprise_me",
    label: "Surprise me",
    prompt: "Let the AI choose a good topic from your context.",
  },
] as const;

export const GUIDED_SCENARIOS = [
  {
    key: "class_discussion",
    title: "Class discussion",
    description: "Practice answering a teacher's follow-up questions.",
  },
  {
    key: "presentation_practice",
    title: "Presentation practice",
    description: "Rehearse a short academic explanation with feedback.",
  },
  {
    key: "office_hours",
    title: "Office hours",
    description: "Ask for help and clarify something from class.",
  },
] as const;

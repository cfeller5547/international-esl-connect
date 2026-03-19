export type SpeakTurnSignals = {
  fluencyIssue: boolean;
  grammarIssue: boolean;
  vocabOpportunity: boolean;
};

export type SpeakTurnCoaching = {
  label: string;
  note: string;
  signals: SpeakTurnSignals;
};

export type SpeakMissionDetails = {
  mode: "free_speech" | "guided";
  starterKey: string | null;
  starterLabel: string | null;
  scenarioTitle: string;
  scenarioSetup: string;
  counterpartRole: string | null;
  canDoStatement: string | null;
  performanceTask: string | null;
  targetPhrases: string[];
  recommendationReason: string | null;
  openingPrompt: string | null;
  activeTopic: string | null;
  contextHint: string | null;
};

export type SpeakReviewHighlight = {
  turnIndex: number;
  youSaid: string;
  tryInstead: string;
  why: string;
};

export type SpeakReviewTurn = {
  turnIndex: number;
  speaker: string;
  text: string;
  inlineCorrections: Array<{
    span: string;
    suggestion: string;
    reason: string;
  }>;
};

export type SpeakReviewVocabularyItem = {
  term: string;
  definition: string;
  translation: string;
};

export type SpeakSessionReview = {
  status: "ready" | "almost_there" | "practice_once_more";
  strength: string;
  improvement: string;
  highlights: SpeakReviewHighlight[];
  turns: SpeakReviewTurn[];
  vocabulary: SpeakReviewVocabularyItem[];
};

export type SpeakTranscriptTurn = {
  turnIndex: number;
  speaker: "ai" | "student";
  text: string;
  coaching?: SpeakTurnCoaching | null;
};

const SPEAK_FILLER_PREFIX =
  /^(yeah|yes|well|okay|ok|um|uh|hmm|honestly|actually)[,\s]+/i;

export function normalizeSpeakTurnSignals(
  value?: Partial<SpeakTurnSignals> | null
): SpeakTurnSignals {
  return {
    fluencyIssue: Boolean(value?.fluencyIssue),
    grammarIssue: Boolean(value?.grammarIssue),
    vocabOpportunity: Boolean(value?.vocabOpportunity),
  };
}

export function formatSpeakSkillLabel(skill: string | null | undefined) {
  if (!skill) {
    return "speaking";
  }

  return skill.replaceAll("_", " ");
}

export function getSpeakCounterpartLabel(counterpartRole: string | null | undefined) {
  switch ((counterpartRole ?? "").toLowerCase()) {
    case "teacher":
      return "Teacher";
    case "classmate":
      return "Classmate";
    case "placement_coach":
      return "Placement coach";
    case "interviewer":
      return "Interviewer";
    case "customer":
      return "Customer";
    case "cashier":
      return "Cashier";
    case "staff_member":
      return "Staff";
    case "manager":
      return "Manager";
    case "audience_member":
      return "Audience";
    default:
      return "Conversation partner";
  }
}

export function buildSpeakTurnCoaching({
  microCoaching,
  turnSignals,
  mode = "guided",
}: {
  microCoaching?: string | null;
  turnSignals?: Partial<SpeakTurnSignals> | null;
  mode?: "free_speech" | "guided";
}): SpeakTurnCoaching | null {
  const normalizedSignals = normalizeSpeakTurnSignals(turnSignals);
  const note = microCoaching?.trim() ?? "";

  if (
    mode === "free_speech" &&
    !normalizedSignals.grammarIssue &&
    !normalizedSignals.fluencyIssue
  ) {
    return null;
  }

  if (
    !note &&
    !normalizedSignals.fluencyIssue &&
    !normalizedSignals.grammarIssue &&
    !normalizedSignals.vocabOpportunity
  ) {
    return null;
  }

  return {
    label: buildSpeakCoachLabel(normalizedSignals, note),
    note:
      note ||
      (normalizedSignals.grammarIssue
        ? "Tighten the sentence and keep the verb form consistent."
        : normalizedSignals.fluencyIssue
          ? "Add one more clear detail so the idea feels complete."
          : normalizedSignals.vocabOpportunity
            ? "Use one stronger phrase from the topic to sound more natural."
            : "Keep the conversation moving with one more clear idea."),
    signals: normalizedSignals,
  };
}

function buildSpeakCoachLabel(signals: SpeakTurnSignals, note: string) {
  const normalizedNote = note.toLowerCase();

  if (signals.grammarIssue || normalizedNote.includes("tense") || normalizedNote.includes("grammar")) {
    return "Tighten the wording";
  }

  if (signals.fluencyIssue || normalizedNote.includes("longer") || normalizedNote.includes("detail")) {
    return "Add one more detail";
  }

  if (
    signals.vocabOpportunity ||
    normalizedNote.includes("phrase") ||
    normalizedNote.includes("word")
  ) {
    return "Use a stronger phrase";
  }

  return "Keep this move";
}

export function buildSpeakHelpPrompt({
  mission,
  latestAiTurn,
  studentTurnCount,
}: {
  mission: SpeakMissionDetails;
  latestAiTurn?: string | null;
  studentTurnCount: number;
}) {
  if (mission.mode === "free_speech") {
    const topic = mission.activeTopic?.trim() || mission.starterLabel?.toLowerCase() || "today";
    const firstPhrase = mission.targetPhrases[0] ?? "I want to say...";
    const secondPhrase = mission.targetPhrases[1] ?? "For example...";
    const latestQuestion = latestAiTurn?.trim().toLowerCase() ?? "";

    if (studentTurnCount === 0) {
      if (mission.starterKey === "learning") {
        return `Start with "${firstPhrase}" and talk about one thing you are learning right now.`;
      }

      if (mission.starterKey === "say_better") {
        return `Start with "${firstPhrase}" and say the main idea in one simple sentence.`;
      }

      return `Start with one clear sentence about ${topic}.`;
    }

    if (latestQuestion.includes("why")) {
      return `Start with one reason, then add "${secondPhrase}" and one real example.`;
    }

    if (latestQuestion.includes("example")) {
      return `Use "${secondPhrase}" and give one concrete detail from class or daily life.`;
    }

    if (latestQuestion.includes("what") || latestQuestion.includes("tell me")) {
      return `Answer simply first, then add one more detail with "${secondPhrase}".`;
    }

    return `Try "${firstPhrase}" and add one connected detail so the conversation keeps moving.`;
  }

  const topic =
    mission.activeTopic?.trim() ||
    mission.scenarioTitle.trim().replace(/^practice\s+/i, "").toLowerCase();
  const firstPhrase = mission.targetPhrases[0] ?? "I think...";
  const secondPhrase = mission.targetPhrases[1] ?? "For example...";
  const latestQuestion = latestAiTurn?.trim().toLowerCase() ?? "";

  if (studentTurnCount === 0) {
    return `Start with "${firstPhrase}" and give one clear sentence about ${topic}.`;
  }

  if (latestQuestion.includes("why")) {
    return `Answer with one reason first, then add "${secondPhrase}" and one real example.`;
  }

  if (latestQuestion.includes("example")) {
    return `Use "${secondPhrase}" and give one concrete detail from class or daily life.`;
  }

  if (latestQuestion.includes("help") || latestQuestion.includes("confusing")) {
    return `Name the difficult part first, then say what you understand so far.`;
  }

  if (latestQuestion.includes("what") || latestQuestion.includes("tell me")) {
    return `Answer the question directly first, then add one useful detail with "${secondPhrase}".`;
  }

  return `Try "${firstPhrase}" and add one more connected idea about ${topic}.`;
}

export function sanitizeSpeakPhraseTerm(value: string) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(SPEAK_FILLER_PREFIX, "")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.!?]+$/g, "")
    .trim();

  if (!cleaned || cleaned.includes("?")) {
    return null;
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 8) {
    return null;
  }

  if (!/[A-Za-z]/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function inferSpeakPhraseDefinition(term: string) {
  const normalized = term.toLowerCase();

  if (normalized.startsWith("i think")) {
    return "A natural way to share an opinion clearly.";
  }

  if (normalized.startsWith("because")) {
    return "A useful connector for giving a reason.";
  }

  if (normalized.startsWith("my name is")) {
    return "A clear way to introduce yourself.";
  }

  if (normalized.startsWith("i'm from") || normalized.startsWith("i am from")) {
    return "A simple way to say where you are from.";
  }

  if (normalized.startsWith("i like to")) {
    return "A natural way to describe what you enjoy doing.";
  }

  if (normalized.startsWith("one thing about me is")) {
    return "A helpful phrase for adding one personal detail.";
  }

  if (normalized.startsWith("what stands out to me is")) {
    return "A strong phrase for explaining what feels important.";
  }

  if (normalized.startsWith("the part that confuses me is")) {
    return "A clear way to say what still feels difficult.";
  }

  if (normalized.startsWith("for example")) {
    return "A good phrase for adding a concrete example.";
  }

  return "A reusable phrase from your speaking session.";
}

export function filterSpeakVocabulary(
  items: SpeakReviewVocabularyItem[],
  limit = 4
) {
  const seen = new Set<string>();
  const filtered: SpeakReviewVocabularyItem[] = [];

  for (const item of items) {
    const normalizedTerm = sanitizeSpeakPhraseTerm(item.term);
    if (!normalizedTerm) {
      continue;
    }

    const key = normalizedTerm.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    filtered.push({
      term: normalizedTerm,
      definition:
        item.definition?.trim() &&
        item.definition.trim() !== "Useful academic phrase from your session."
          ? item.definition.trim()
          : inferSpeakPhraseDefinition(normalizedTerm),
      translation: item.translation?.trim() || normalizedTerm,
    });

    if (filtered.length >= limit) {
      break;
    }
  }

  return filtered;
}

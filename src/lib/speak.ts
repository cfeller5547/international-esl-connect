import type { LiveStudentTurnDisposition, LiveStudentTurnReasonCode } from "@/lib/conversation-utils";

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

export type SpeakSpeakerRole = "coach" | "counterpart" | "student";

export type SpeakVoiceProfile =
  | "coach_guide"
  | "scene_counterpart"
  | "system_default";

export type SpeakDeliveryMode = "spoken" | "text_only";

export type SpeakMissionStageKey =
  | "coffee_shop"
  | "directions"
  | "classroom"
  | "open_conversation"
  | "generic";

export type SpeakSceneBeatTrigger =
  | "mission_started"
  | "ai_opening"
  | "student_phrase_landed"
  | "repair_requested"
  | "mission_resolved";

export type SpeakTargetPhraseProgressState = "unseen" | "attempted" | "landed";

export type SpeakTargetPhraseProgress = {
  phrase: string;
  state: SpeakTargetPhraseProgressState;
};

export type SpeakSceneActorState =
  | "idle"
  | "speaking"
  | "listening"
  | "confused"
  | "resolved";

export type SpeakSceneActor = {
  id: string;
  role: string;
  label: string;
  state: SpeakSceneActorState;
};

export type SpeakScenePropState =
  | "hidden"
  | "incoming_drink"
  | "wrong_drink_on_counter"
  | "correct_drink_ready"
  | "static";

export type SpeakSceneProp = {
  id: string;
  kind: string;
  state: SpeakScenePropState;
  label?: string;
};

export type SpeakSceneBeat = {
  id: string;
  trigger: SpeakSceneBeatTrigger;
  description: string;
};

export type SpeakSceneSubtitle = {
  speaker: "ai" | "student";
  text: string;
  emphasis?: "normal" | "highlight";
};

export type SpeakAvatarState =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "repair"
  | "success";

export type SpeakCoachCue = {
  id: string;
  label: string;
  text: string;
  tone: "hint" | "repair" | "success" | "prompt";
  speakerRole: "coach";
  channel: "coach";
  voiceProfile: SpeakVoiceProfile;
  deliveryMode: SpeakDeliveryMode;
};

export type SpeakMissionStageSpec = {
  sceneType: "cinematic_2d";
  stageKey: SpeakMissionStageKey;
  counterpartOnStage: boolean;
  beats: SpeakSceneBeat[];
};

export type SpeakSceneState = {
  spec: SpeakMissionStageSpec;
  actor: SpeakSceneActor;
  props: SpeakSceneProp[];
  subtitles: SpeakSceneSubtitle[];
  targetPhraseProgress: SpeakTargetPhraseProgress[];
  resolved: boolean;
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
  sceneType?: "cinematic_2d" | null;
  stageKey?: SpeakMissionStageKey | null;
  sceneBeats?: SpeakSceneBeat[] | null;
  coachPersonaKey?: string | null;
  coachEnabled?: boolean;
  coachCueTemplates?: Partial<Record<"start" | "repair" | "success" | "wrap", string>> | null;
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

export type SpeakWordAnnotation = {
  startIndex: number;
  endIndex: number;
  original: string;
  correction: string;
  reason: string;
  type: "grammar" | "vocabulary" | "fluency";
};

export type SpeakTranscriptTurn = {
  turnIndex: number;
  speaker: "ai" | "student";
  speakerRole?: SpeakSpeakerRole;
  channel?: "coach" | "scene";
  voiceProfile?: SpeakVoiceProfile | null;
  deliveryMode?: SpeakDeliveryMode;
  text: string;
  coaching?: SpeakTurnCoaching | null;
  disposition?: LiveStudentTurnDisposition | null;
  countsTowardProgress?: boolean;
  reasonCode?: LiveStudentTurnReasonCode | null;
  annotations?: SpeakWordAnnotation[];
};

// Common grammar error patterns for inline annotation
const GRAMMAR_ERROR_PATTERNS: Array<{ pattern: RegExp; correction: (match: string) => string; reason: string }> = [
  { pattern: /\b(goed)\b/gi, correction: () => "went", reason: "Irregular past tense of 'go'" },
  { pattern: /\b(wented)\b/gi, correction: () => "went", reason: "Irregular past tense of 'go'" },
  { pattern: /\b(eated)\b/gi, correction: () => "ate", reason: "Irregular past tense of 'eat'" },
  { pattern: /\b(buyed)\b/gi, correction: () => "bought", reason: "Irregular past tense of 'buy'" },
  { pattern: /\b(thinked)\b/gi, correction: () => "thought", reason: "Irregular past tense of 'think'" },
  { pattern: /\b(gived)\b/gi, correction: () => "gave", reason: "Irregular past tense of 'give'" },
  { pattern: /\b(maked)\b/gi, correction: () => "made", reason: "Irregular past tense of 'make'" },
  { pattern: /\b(teached)\b/gi, correction: () => "taught", reason: "Irregular past tense of 'teach'" },
  { pattern: /\b(catched)\b/gi, correction: () => "caught", reason: "Irregular past tense of 'catch'" },
  { pattern: /\b(drawed)\b/gi, correction: () => "drew", reason: "Irregular past tense of 'draw'" },
  { pattern: /\bhe don['']?t\b/gi, correction: () => "he doesn't", reason: "Use 'doesn't' for third person singular" },
  { pattern: /\bshe don['']?t\b/gi, correction: () => "she doesn't", reason: "Use 'doesn't' for third person singular" },
  { pattern: /\bit don['']?t\b/gi, correction: () => "it doesn't", reason: "Use 'doesn't' for third person singular" },
  { pattern: /\bhe have\b/gi, correction: () => "he has", reason: "Use 'has' for third person singular" },
  { pattern: /\bshe have\b/gi, correction: () => "she has", reason: "Use 'has' for third person singular" },
  { pattern: /\bmore better\b/gi, correction: () => "better", reason: "Don't use 'more' with 'better' — 'better' is already comparative" },
  { pattern: /\bmore bigger\b/gi, correction: () => "bigger", reason: "Don't use 'more' with 'bigger' — 'bigger' is already comparative" },
  { pattern: /\bi is\b/gi, correction: () => "I am", reason: "Use 'am' with 'I'" },
  { pattern: /\bthey is\b/gi, correction: () => "they are", reason: "Use 'are' with 'they'" },
  { pattern: /\bwe is\b/gi, correction: () => "we are", reason: "Use 'are' with 'we'" },
];

export function deriveWordAnnotations(text: string): SpeakWordAnnotation[] {
  const annotations: SpeakWordAnnotation[] = [];

  for (const rule of GRAMMAR_ERROR_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      annotations.push({
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        original: match[0],
        correction: rule.correction(match[0]),
        reason: rule.reason,
        type: "grammar",
      });
    }
  }

  // Detect lowercase "i" used as pronoun
  const iRegex = /(?:^|\s)(i)(?:\s|[,.'!?]|$)/g;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = iRegex.exec(text)) !== null) {
    const offset = iMatch[0].startsWith(" ") ? 1 : 0;
    const idx = iMatch.index + offset;
    if (text[idx] === "i" && text[idx + 1] !== "'") {
      annotations.push({
        startIndex: idx,
        endIndex: idx + 1,
        original: "i",
        correction: "I",
        reason: "Always capitalize 'I' when referring to yourself",
        type: "grammar",
      });
    }
  }

  // Sort by position
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  // Remove overlapping annotations
  const filtered: SpeakWordAnnotation[] = [];
  let lastEnd = -1;
  for (const ann of annotations) {
    if (ann.startIndex >= lastEnd) {
      filtered.push(ann);
      lastEnd = ann.endIndex;
    }
  }

  return filtered;
}

export function resolveSpeakMissionStageKey(
  stageKey: string | null | undefined,
  scenarioTitle: string
): SpeakMissionStageKey {
  if (
    stageKey === "coffee_shop" ||
    stageKey === "directions" ||
    stageKey === "classroom" ||
    stageKey === "open_conversation" ||
    stageKey === "generic"
  ) {
    return stageKey;
  }

  const lower = scenarioTitle.toLowerCase();

  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("order")) {
    return "coffee_shop";
  }

  if (lower.includes("direction") || lower.includes("library") || lower.includes("lost")) {
    return "directions";
  }

  if (
    lower.includes("class") ||
    lower.includes("teacher") ||
    lower.includes("office hour") ||
    lower.includes("presentation")
  ) {
    return "classroom";
  }

  if (lower.includes("free speech") || lower.includes("open conversation")) {
    return "open_conversation";
  }

  return "generic";
}

export function buildSpeakTargetPhraseProgress(
  targetPhrases: string[],
  spokenText: string
): SpeakTargetPhraseProgress[] {
  const lowerSpoken = spokenText.toLowerCase();

  return targetPhrases.map((phrase) => {
    const lowerPhrase = phrase.toLowerCase();

    if (lowerSpoken.includes(lowerPhrase)) {
      return { phrase, state: "landed" as const };
    }

    const tokens = lowerPhrase
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z']/gi, ""))
      .filter(Boolean);
    const tokenHits = tokens.filter((token) => lowerSpoken.includes(token)).length;

    return {
      phrase,
      state: tokenHits > 0 ? ("attempted" as const) : ("unseen" as const),
    };
  });
}

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

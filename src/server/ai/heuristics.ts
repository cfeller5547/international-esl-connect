import { addDays, differenceInCalendarDays, formatISO } from "date-fns";

import { FREE_TIER_LIMITS, SKILLS } from "@/lib/constants";
import {
  buildSpeakTurnCoaching,
  filterSpeakVocabulary,
  inferSpeakPhraseDefinition,
  sanitizeSpeakPhraseTerm,
} from "@/lib/speak";
import { clamp, percentDelta } from "@/lib/utils";

type ObjectiveAnswer = {
  questionId: string;
  value: string;
  skill: (typeof SKILLS)[number];
  correctValue?: string;
};

type ConversationTurn = {
  prompt: string;
  answer: string;
};

export function getLevelLabel(
  score: number
): "very_basic" | "basic" | "intermediate" | "advanced" {
  if (score <= 25) return "very_basic";
  if (score <= 50) return "basic";
  if (score <= 75) return "intermediate";
  return "advanced";
}

export function calculateOverallScore(skillScores: Record<string, number>) {
  const total = SKILLS.reduce((sum, skill) => sum + (skillScores[skill] ?? 0), 0);
  return clamp(Math.round(total / SKILLS.length));
}

export function getAssessmentPrompt(phase: "quick" | "full", turnIndex: number) {
  const prompts =
    phase === "quick"
      ? [
          "Tell me one thing you studied this week.",
          "What was easy for you, and what felt hard?",
          "How would you explain today's topic to a classmate?",
        ]
      : [
          "Describe a class activity you completed recently.",
          "What did you understand well, and what still feels confusing?",
          "Give an example sentence using this week's topic.",
          "What would you ask your teacher if you needed more help?",
        ];

  return prompts[Math.min(turnIndex, prompts.length - 1)];
}

export function scoreAssessment({
  objectiveAnswers,
  conversationTurns,
  writingSample,
}: {
  objectiveAnswers: ObjectiveAnswer[];
  conversationTurns: ConversationTurn[];
  writingSample?: string;
}) {
  const grouped = Object.fromEntries(
    SKILLS.map((skill) => [skill, objectiveAnswers.filter((answer) => answer.skill === skill)])
  ) as Record<(typeof SKILLS)[number], ObjectiveAnswer[]>;

  const conversationText = conversationTurns.map((turn) => turn.answer).join(" ").trim();
  const writingText = writingSample?.trim() ?? "";
  const lexicalVariety = new Set(
    `${conversationText} ${writingText}`
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
  ).size;

  const skillScores = {
    listening: objectiveAccuracy(grouped.listening) * 0.7 + responseRelevance(conversationTurns) * 0.3,
    speaking: fluencyScore(conversationText),
    reading: objectiveAccuracy(grouped.reading),
    writing: writingHeuristic(writingText || conversationText),
    vocabulary: objectiveAccuracy(grouped.vocabulary) * 0.6 + clamp(lexicalVariety * 4, 0, 40),
    grammar:
      objectiveAccuracy(grouped.grammar) * 0.6 +
      grammarHeuristic(`${conversationText} ${writingText}`) * 0.4,
  } as Record<(typeof SKILLS)[number], number>;

  const normalized = Object.fromEntries(
    Object.entries(skillScores).map(([skill, score]) => [skill, clamp(Math.round(score))])
  ) as Record<(typeof SKILLS)[number], number>;

  const overallScore = calculateOverallScore(normalized);
  const levelLabel = getLevelLabel(overallScore);

  const skills = SKILLS.map((skill) => ({
    skill,
    score: normalized[skill],
    evidence: [
      `${skill} objective accuracy: ${Math.round(objectiveAccuracy(grouped[skill]))}`,
      `Conversation length: ${conversationTurns.length} turns`,
    ],
  }));

  return {
    overallScore,
    levelLabel,
    skills,
    conversationMetrics: {
      turnCount: conversationTurns.length,
      durationSeconds: conversationTurns.length * 30,
      pronunciationScore: clamp(Math.round(normalized.speaking * 0.85)),
      fluencyScore: clamp(Math.round(normalized.speaking)),
      grammarUsageScore: clamp(Math.round(normalized.grammar)),
      listeningResponseScore: clamp(Math.round(normalized.listening)),
    },
  };
}

function objectiveAccuracy(answers: ObjectiveAnswer[]) {
  if (answers.length === 0) {
    return 55;
  }

  const correct = answers.filter((answer) => answer.correctValue === answer.value).length;
  return clamp((correct / answers.length) * 100);
}

function responseRelevance(turns: ConversationTurn[]) {
  if (turns.length === 0) {
    return 45;
  }

  const relevantTurns = turns.filter((turn) => turn.answer.trim().split(/\s+/).length >= 4).length;
  return clamp((relevantTurns / turns.length) * 100);
}

function fluencyScore(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sentenceCount = text.split(/[.!?]/).filter(Boolean).length;
  return clamp(words * 4 + sentenceCount * 6, 35, 92);
}

function writingHeuristic(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const punctuationBonus = /[.!?]/.test(text) ? 12 : 0;
  return clamp(words * 3 + punctuationBonus, 30, 96);
}

function grammarHeuristic(text: string) {
  const hasCapitalI = /\bI\b/.test(text);
  const hasPeriod = /[.!?]/.test(text);
  const penalties = /(goed|wented|eated)\b/i.test(text) ? 15 : 0;
  return clamp(55 + (hasCapitalI ? 10 : 0) + (hasPeriod ? 10 : 0) - penalties, 25, 92);
}

export function generateReportNarration({
  skillScores,
  previousSkillScores,
}: {
  skillScores: Record<string, number>;
  previousSkillScores?: Record<string, number> | null;
}) {
  const weakestSkill = Object.entries(skillScores).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "grammar";
  const strongestSkill = Object.entries(skillScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "reading";

  const strengths = [`You are strongest in ${strongestSkill}.`, "Your evidence is consistent across this report."];
  const risks = [`Focus on ${weakestSkill} next week to raise your overall score.`];
  const nextWeekPlan = [
    `Practice ${weakestSkill} first for 15 minutes.`,
    "Complete one worksheet and one short speaking activity.",
    "Review saved phrases before your next class.",
  ];

  const summary = previousSkillScores
    ? `You improved most in ${bestImprovement(skillScores, previousSkillScores)}.`
    : `Your strongest area is ${strongestSkill}, and your next focus is ${weakestSkill}.`;

  return { summary, strengths, risks, nextWeekPlan };
}

function bestImprovement(current: Record<string, number>, previous: Record<string, number>) {
  return Object.entries(current)
    .map(([skill, score]) => [skill, score - (previous[skill] ?? 0)] as const)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "grammar";
}

export function createComparisonPayload(
  current: Record<string, number>,
  previous: Record<string, number>
) {
  return {
    skills: SKILLS.map((skill) => {
      const deltaAbs = current[skill] - (previous[skill] ?? 0);
      return {
        skill,
        currentScore: current[skill],
        previousScore: previous[skill] ?? 0,
        deltaAbs,
        deltaPct: percentDelta(current[skill], previous[skill] ?? 0),
        category: deltaAbs > 0 ? "improved" : deltaAbs < 0 ? "declined" : "unchanged",
      };
    }),
  };
}

export function generateShareCardSvg({
  title,
  subtitle,
  score,
  label,
}: {
  title: string;
  subtitle: string;
  score: number;
  label: string;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" fill="none">
  <rect width="1080" height="1350" rx="56" fill="#F8FAFC"/>
  <circle cx="910" cy="170" r="170" fill="#F4A261" fill-opacity="0.24"/>
  <circle cx="160" cy="250" r="220" fill="#2A9D8F" fill-opacity="0.16"/>
  <rect x="72" y="92" width="936" height="1166" rx="42" fill="white" stroke="#E2E8F0"/>
  <text x="132" y="182" fill="#2A9D8F" font-family="sans-serif" font-size="32" font-weight="700">ESL INTERNATIONAL CONNECT</text>
  <text x="132" y="314" fill="#0F172A" font-family="sans-serif" font-size="78" font-weight="700">${escapeXml(title)}</text>
  <text x="132" y="402" fill="#64748B" font-family="sans-serif" font-size="36">${escapeXml(subtitle)}</text>
  <rect x="132" y="492" width="816" height="408" rx="34" fill="#1F4E79"/>
  <text x="540" y="650" fill="white" font-family="sans-serif" font-size="40" font-weight="700" text-anchor="middle">${escapeXml(label)}</text>
  <text x="540" y="790" fill="white" font-family="sans-serif" font-size="160" font-weight="800" text-anchor="middle">${score}</text>
  <text x="132" y="1048" fill="#0F172A" font-family="sans-serif" font-size="54" font-weight="700">Measured progress, clear next steps.</text>
  <text x="132" y="1112" fill="#64748B" font-family="sans-serif" font-size="32">Built for assignment confidence, speaking growth, and teacher-aligned practice.</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function generateTranscriptAnnotations(turns: Array<{ speaker: string; text: string }>) {
  const annotatedTurns = turns.map((turn, index) => {
    const corrections: Array<{ span: string; suggestion: string; reason: string }> = [];
    if (/goed/i.test(turn.text)) {
      corrections.push({
        span: "goed",
        suggestion: "went",
        reason: "irregular past tense",
      });
    }
    if (/\bi\b/.test(turn.text) && !/\bI\b/.test(turn.text)) {
      corrections.push({
        span: "i",
        suggestion: "I",
        reason: "capitalize the pronoun I",
      });
    }

    return {
      turnIndex: index + 1,
      speaker: turn.speaker,
      text: turn.text,
      inlineCorrections: corrections,
    };
  });

  return {
    turns: annotatedTurns,
    vocabulary: extractSpeakVocabulary(turns),
  };
}

function extractSpeakVocabulary(turns: Array<{ speaker: string; text: string }>) {
  const candidates = turns
    .filter((turn) => turn.speaker === "student")
    .flatMap((turn) => extractPhraseCandidates(turn.text))
    .map((term) => ({
      term,
      definition: inferSpeakPhraseDefinition(term),
      translation: term,
    }));

  return filterSpeakVocabulary(candidates, 4);
}

function extractPhraseCandidates(text: string) {
  const matches = new Set<string>();
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(I think [^,.!?;]+)/gi,
    /\b(Because [^,.!?;]+)/gi,
    /\b(My name is [^,.!?;]+)/gi,
    /\b(I(?:'m| am) from [^,.!?;]+)/gi,
    /\b(I like to [^,.!?;]+)/gi,
    /\b(One thing about me is [^,.!?;]+)/gi,
    /\b(What stands out to me is [^,.!?;]+)/gi,
    /\b(The part that confuses me is [^,.!?;]+)/gi,
    /\b(In my opinion [^,.!?;]+)/gi,
    /\b(For example,? [^,.!?;]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const phrase = sanitizeSpeakPhraseTerm(match[1] ?? "");
      if (phrase) {
        matches.add(phrase);
      }
    }
  }

  if (matches.size > 0) {
    return Array.from(matches);
  }

  const clauses = normalizedText
    .split(/[.!?]/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const phrase = sanitizeSpeakPhraseTerm(clause);
    if (!phrase) {
      continue;
    }

    if (/^(i|because|my|one|what|the|for)\b/i.test(phrase)) {
      matches.add(phrase);
    }
  }

  return Array.from(matches);
}

export function generateSpeakReply({
  missionKind,
  starterPrompt,
  activeTopic,
  studentInput,
}: {
  missionKind: "free_speech" | "guided";
  starterPrompt: string;
  activeTopic?: string | null;
  studentInput: string;
}) {
  const trimmed = studentInput.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const aiResponseText =
    missionKind === "free_speech"
      ? wordCount < 5
        ? activeTopic
          ? `I heard that. Can you tell me a little more about ${activeTopic}?`
          : "I heard that. Can you tell me a little more?"
        : /why/i.test(trimmed)
          ? "That's interesting. What made you ask that?"
          : "That makes sense. What stands out most about it for you?"
      : trimmed.length < 12
        ? `Tell me a little more. Start with one specific example from ${starterPrompt.toLowerCase()}.`
        : "Good detail. Now explain why that mattered and use one past-tense sentence.";

  const microCoaching = /goed/i.test(trimmed)
    ? "Use the irregular past form 'went' instead of 'goed'."
    : trimmed.split(/\s+/).length < 5
      ? "Try answering with one longer sentence."
      : missionKind === "free_speech"
        ? ""
        : "Nice start. Keep your verb tense consistent.";

  const turnSignals = {
    fluencyIssue: wordCount < 5,
    grammarIssue: /goed/i.test(trimmed),
    vocabOpportunity: wordCount < 10,
  };
  const coachLabel =
    buildSpeakTurnCoaching({
      microCoaching,
      turnSignals,
      mode: missionKind,
    })?.label ?? "Keep this move";

  return {
    aiResponseText,
    microCoaching,
    coachLabel,
    turnSignals,
  };
}

export function generateHomeworkFeedback({
  prompt,
  answer,
  hintLevel,
}: {
  prompt: string;
  answer: string;
  hintLevel: number;
}): {
  result: "correct" | "incorrect" | "partial";
  feedback: string;
  hintLevelServed: number;
  nextHintLevelAvailable: number;
} {
  const normalized = answer.trim().toLowerCase();
  const result: "correct" | "incorrect" | "partial" =
    normalized.length === 0 ? "incorrect" : normalized.length < 12 ? "partial" : "correct";

  const hints = [
    `Start by identifying what the question is asking you to explain.`,
    `Break the prompt into parts and answer one piece at a time.`,
    `Use the key rule from class before you write your full response.`,
  ];

  return {
    result,
    feedback:
      result === "correct"
        ? `Good direction. Check whether every part of "${prompt}" is covered.`
        : hints[Math.min(hintLevel, hints.length - 1)],
    hintLevelServed: Math.min(hintLevel, 3),
    nextHintLevelAvailable: Math.min(hintLevel + 1, 3),
  };
}

export function parseHomeworkText(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questions = rawLines
    .filter((line) => /^\d+[\).\s]/.test(line))
    .map((line, index) => ({
      index: index + 1,
      promptText: line.replace(/^\d+[\).\s]*/, ""),
      questionType: inferQuestionType(line),
    }));

  const parseConfidence =
    questions.length === 0
      ? 0.3
      : Math.min(0.95, 0.55 + questions.length * 0.08 + Math.min(text.length, 1200) / 5000);

  return {
    questions,
    parseConfidence,
  };
}

function inferQuestionType(line: string) {
  if (/\btranslate\b/i.test(line)) return "translation";
  if (/[A-D]\)/.test(line)) return "multiple_choice";
  if (line.includes("?")) return "short_answer";
  return "other";
}

export function buildTestPrepPlan({
  targetDate,
  topics,
  weakestSkills,
}: {
  targetDate: Date;
  topics: string[];
  weakestSkills: string[];
}) {
  const daysAvailable = Math.max(1, Math.min(5, differenceInCalendarDays(targetDate, new Date()) + 1));

  return {
    days: Array.from({ length: daysAvailable }, (_, index) => ({
      dayIndex: index + 1,
      focusSkills: weakestSkills.slice(0, 2),
      recommendedActivities: [
        { type: "lesson", targetId: "11111111-1111-1111-1111-111111111101" },
        { type: "worksheet", targetId: "11111111-1111-1111-1111-111111111102" },
      ],
      topic: topics[index % topics.length] ?? topics[0] ?? "core review",
      scheduledDate: formatISO(addDays(new Date(), index), { representation: "date" }),
    })),
    miniMockRecommendedAt: formatISO(addDays(new Date(), Math.max(daysAvailable - 1, 0))),
  };
}

export function createUsageSnapshot() {
  return {
    plan: "free",
    limits: FREE_TIER_LIMITS,
  };
}

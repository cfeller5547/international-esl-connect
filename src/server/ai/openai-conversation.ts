import { toFile } from "openai/uploads";

import { buildSpeakTurnCoaching, filterSpeakVocabulary } from "@/lib/speak";
import { clamp } from "@/lib/utils";
import { env } from "@/server/env";
import { createLearnOpeningPrompt } from "@/server/learn-speaking-prompts";
import { openai } from "@/server/openai";

import {
  generateSpeakReply,
  generateTranscriptAnnotations,
} from "./heuristics";

export type ConversationSurface = "assessment" | "learn" | "speak";
export type ConversationMissionKind =
  | "free_speech"
  | "guided"
  | "unit_speaking"
  | "unit_benchmark";

export type ConversationContext = {
  surface: ConversationSurface;
  missionKind: ConversationMissionKind;
  interactionMode: "text" | "voice";
  scenarioKey?: string | null;
  starterKey?: string | null;
  starterLabel?: string | null;
  scenarioTitle: string;
  scenarioSetup: string;
  canDoStatement?: string | null;
  performanceTask?: string | null;
  counterpartRole?: string | null;
  introductionText?: string | null;
  openingQuestion?: string | null;
  targetPhrases: string[];
  followUpPrompts: string[];
  successCriteria: string[];
  modelExample?: string | null;
  starterPrompt?: string | null;
  learnerLevel?: string | null;
  focusSkill?: string | null;
  recommendationReason?: string | null;
  activeTopic?: string | null;
  contextHint?: string | null;
  isBenchmark?: boolean;
};

export type ConversationTurnLike = {
  speaker: "ai" | "student";
  text: string;
};

export type ConversationReply = {
  aiResponseText: string;
  microCoaching: string;
  coachLabel: string;
  turnSignals: {
    fluencyIssue: boolean;
    grammarIssue: boolean;
    vocabOpportunity: boolean;
  };
  aiAudioBase64?: string | null;
  studentTranscriptText?: string | null;
};

export type MissionHighlight = {
  turnIndex: number;
  youSaid: string;
  tryInstead: string;
  why: string;
};

export type MissionTurnReview = {
  turnIndex: number;
  speaker: "ai" | "student";
  text: string;
  inlineCorrections: Array<{
    span: string;
    suggestion: string;
    reason: string;
  }>;
};

export type MissionReview = {
  status: "ready" | "almost_there" | "practice_once_more";
  score: number;
  strength: string;
  improvement: string;
  pronunciationNote: string | null;
  highlights: MissionHighlight[];
  turns: MissionTurnReview[];
  vocabulary: Array<{
    term: string;
    definition: string;
    translation: string;
  }>;
};

function getAudioFileExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("mp4") || normalized.includes("m4a")) {
    return "m4a";
  }

  if (normalized.includes("mpeg") || normalized.includes("mp3")) {
    return "mp3";
  }

  if (normalized.includes("wav") || normalized.includes("wave")) {
    return "wav";
  }

  if (normalized.includes("ogg") || normalized.includes("opus")) {
    return "ogg";
  }

  if (normalized.includes("aac")) {
    return "aac";
  }

  return "webm";
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain JSON.");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function getResponseText(response: unknown) {
  const candidate = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof candidate.output_text === "string") {
    return candidate.output_text;
  }

  const nestedText = candidate.output
    ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
    .map((content: { text?: string }) => content.text)
    .find((value: string | undefined) => typeof value === "string");

  if (!nestedText) {
    throw new Error("Model response did not contain text.");
  }

  return nestedText;
}

function createFallbackReview({
  turns,
  interactionMode,
  context,
}: {
  turns: ConversationTurnLike[];
  interactionMode: "text" | "voice";
  context: ConversationContext;
}): MissionReview {
  const annotated = generateTranscriptAnnotations(turns);
  const studentTurns = turns.filter((turn) => turn.speaker === "student");
  const studentText = studentTurns.map((turn) => turn.text).join(" ").trim();
  const wordCount = studentText.split(/\s+/).filter(Boolean).length;
  const score = clamp(
    Math.round(
      wordCount * 5 +
        Math.min(studentTurns.length, 5) * 8 +
        Math.min(context.targetPhrases.length, 4) * 3
    ),
    48,
    context.isBenchmark ? 88 : 92
  );

  const status: MissionReview["status"] =
    score >= (context.isBenchmark ? 74 : 70)
      ? "ready"
      : score >= 58
        ? "almost_there"
        : "practice_once_more";

  const firstStudentTurn = annotated.turns.find((turn) => turn.speaker === "student");
  const correction = firstStudentTurn?.inlineCorrections[0];

  const highlights: MissionHighlight[] = correction
    ? [
        {
          turnIndex: firstStudentTurn.turnIndex,
          youSaid: correction.span,
          tryInstead: correction.suggestion,
          why: correction.reason,
        },
      ]
    : studentTurns.slice(0, 1).map((turn, index) => ({
        turnIndex: index + 1,
        youSaid: turn.text,
        tryInstead:
          context.targetPhrases[0] ??
          context.successCriteria[0] ??
          "Use one more detail in your answer.",
        why: "Aim for clearer, more connected language that fits the unit goal.",
      }));

  return {
    status,
    score,
    strength:
      context.missionKind === "free_speech"
        ? studentTurns.length >= 3
          ? "You kept the conversation moving and sounded natural in places."
          : "You got the conversation started and stayed with the topic."
        : studentTurns.length >= 3
          ? "You stayed in the conversation and answered with useful detail."
          : "You responded clearly enough to keep the scenario moving.",
    improvement:
      correction
        ? `Focus on ${correction.reason.toLowerCase()} in your next attempt.`
        : context.missionKind === "free_speech"
          ? "Next time, add one more clear detail when an answer feels short."
          : "Use one more target phrase and make your answer a little more specific.",
    pronunciationNote:
      interactionMode === "voice" ? "Slow down slightly on key words for clearer delivery." : null,
    highlights: highlights.slice(0, 3),
    turns: annotated.turns.map((turn) => ({
      turnIndex: turn.turnIndex,
      speaker: turn.speaker as "ai" | "student",
      text: turn.text,
      inlineCorrections: turn.inlineCorrections,
    })),
    vocabulary: filterSpeakVocabulary(annotated.vocabulary, 4),
  };
}

async function synthesizeSpeech(text: string) {
  if (!openai) {
    return null;
  }

  const audio = await openai.audio.speech.create({
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    input: text,
  });

  return Buffer.from(await audio.arrayBuffer()).toString("base64");
}

function normalizeQuestion(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  return /[?!]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

function stripImperativePrefix(value: string) {
  return value
    .replace(/^respond to this scenario:\s*/i, "")
    .replace(/^start with this:\s*/i, "")
    .replace(/^answer this question:\s*/i, "")
    .replace(/^say a little more about that\.?\s*/i, "")
    .trim();
}

function summarizeLearnerPoint(text: string) {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);

  if (words.length === 0) {
    return "that";
  }

  return words.join(" ").replace(/[.,!?]$/, "");
}

function getCounterpartLabel(context: ConversationContext) {
  switch ((context.counterpartRole ?? "").toLowerCase()) {
    case "teacher":
      return "teacher";
    case "classmate":
      return "classmate";
    case "placement_coach":
      return "placement coach";
    case "interviewer":
      return "interviewer";
    case "customer":
      return "customer";
    case "cashier":
      return "cashier";
    case "staff_member":
      return "staff member";
    case "manager":
      return "manager";
    case "audience_member":
      return "audience member";
    default:
      return "conversation partner";
  }
}

function generateFallbackConversationReply({
  context,
  turns,
  studentInput,
}: {
  context: ConversationContext;
  turns: ConversationTurnLike[];
  studentInput: string;
}) {
  if (context.surface === "assessment") {
    const learnerWordCount = studentInput.trim().split(/\s+/).filter(Boolean).length;
    const learnerTurnCount = turns.filter((turn) => turn.speaker === "student").length + 1;
    const nextPromptRaw =
      context.followUpPrompts[learnerTurnCount] ??
      context.followUpPrompts.at(-1) ??
      "Can you tell me a little more about that?";
    const nextPrompt = normalizeQuestion(stripImperativePrefix(nextPromptRaw));
    const learnerPoint = summarizeLearnerPoint(studentInput);

    const turnSignals = {
      fluencyIssue: learnerWordCount < 6,
      grammarIssue: /\bgoed\b/i.test(studentInput),
      vocabOpportunity: learnerWordCount < 14,
    };

    return {
      aiResponseText:
        learnerWordCount < 6
          ? `Thanks. Can you tell me a little more about ${learnerPoint === "that" ? "that" : `"${learnerPoint}"`} ?`.replace(
              /\s+\?/g,
              "?"
            )
          : `That helps me understand you better. ${nextPrompt || "Can you give me one example?"}`,
      microCoaching: "",
      coachLabel:
        buildSpeakTurnCoaching({
          microCoaching: "",
          turnSignals,
        })?.label ?? "Keep this move",
      turnSignals,
    };
  }

  if (context.surface !== "learn") {
    return generateSpeakReply({
      missionKind: context.missionKind === "free_speech" ? "free_speech" : "guided",
      starterPrompt: context.starterPrompt ?? context.scenarioSetup,
      activeTopic: context.activeTopic,
      studentInput,
    });
  }

  const learnerWordCount = studentInput.trim().split(/\s+/).filter(Boolean).length;
  const learnerTurnCount = turns.filter((turn) => turn.speaker === "student").length + 1;
  const nextPromptRaw =
    context.followUpPrompts[learnerTurnCount] ??
    context.followUpPrompts.at(-1) ??
    "Can you tell me one more detail?";
  const nextPrompt = normalizeQuestion(stripImperativePrefix(nextPromptRaw));
  const learnerPoint = summarizeLearnerPoint(studentInput);
  const aiResponseText =
    learnerWordCount < 6
      ? `I heard "${learnerPoint}." Can you say a little more?`
      : `That helps. ${nextPrompt || "Can you give one more example?"}`;

  const learnTurnSignals = {
    fluencyIssue: learnerWordCount < 6,
    grammarIssue: /\bgoed\b/i.test(studentInput),
    vocabOpportunity: learnerWordCount < 14,
  };

  return {
    aiResponseText,
    microCoaching: "",
    coachLabel:
      buildSpeakTurnCoaching({
        microCoaching: "",
        turnSignals: learnTurnSignals,
      })?.label ?? "Keep this move",
    turnSignals: learnTurnSignals,
  };
}

export function createOpeningPrompt(context: ConversationContext) {
  if (context.surface === "assessment") {
    const introduction =
      context.introductionText?.trim() ||
      "Hi, I'm Maya. I want to get a feel for how you use English in class.";
    const question = normalizeQuestion(
      context.openingQuestion?.trim() || "What's your name, and what class are you taking right now?"
    );

    return `${introduction} ${question}`.trim();
  }

  if (context.surface === "learn") {
    return createLearnOpeningPrompt({
      scenarioTitle: context.scenarioTitle,
      scenarioSetup: context.scenarioSetup,
      canDoStatement: context.canDoStatement,
      performanceTask: context.performanceTask,
      counterpartRole: context.counterpartRole,
      openingQuestion: context.openingQuestion,
    });
  }

  if (context.missionKind === "free_speech") {
    return normalizeQuestion(
      context.openingQuestion?.trim() ||
        context.starterPrompt?.trim() ||
        "What's on your mind right now?"
    );
  }

  const introduction = context.introductionText?.trim() ?? "";
  const question = normalizeQuestion(
    context.openingQuestion?.trim() ||
      context.starterPrompt?.trim() ||
      context.scenarioSetup ||
      `Talk about ${context.scenarioTitle.toLowerCase()}.`
  );

  return [introduction, question].filter(Boolean).join(" ").trim();
}

export async function transcribeAudioInput({
  audioDataUrl,
  mimeType,
}: {
  audioDataUrl: string;
  mimeType?: string | null;
}) {
  if (!openai) {
    throw new Error("OpenAI is not configured.");
  }

  const [header, base64] = audioDataUrl.split(",");
  const resolvedMime = mimeType ?? header.match(/data:(.*?);base64/)?.[1] ?? "audio/webm";
  const extension = getAudioFileExtension(resolvedMime);

  const file = await toFile(Buffer.from(base64, "base64"), `turn.${extension}`, {
    type: resolvedMime,
  });

  const transcription = await openai.audio.transcriptions.create({
    model: env.OPENAI_TRANSCRIPTION_MODEL,
    file,
  });

  return transcription.text.trim();
}

export async function generateConversationReply({
  context,
  turns,
  studentInput,
  includeAudio,
}: {
  context: ConversationContext;
  turns: ConversationTurnLike[];
  studentInput: string;
  includeAudio: boolean;
}): Promise<ConversationReply> {
  if (!openai) {
    const fallback = generateFallbackConversationReply({
      context,
      turns,
      studentInput,
    });

    return {
      aiResponseText: fallback.aiResponseText,
      microCoaching: fallback.microCoaching,
      coachLabel: fallback.coachLabel,
      turnSignals: fallback.turnSignals,
      aiAudioBase64: null,
      studentTranscriptText: studentInput,
    };
  }

  const transcriptBlock = turns
    .map((turn, index) => `${index + 1}. ${turn.speaker.toUpperCase()}: ${turn.text}`)
    .join("\n");
  const followUpHint =
    context.followUpPrompts[turns.filter((turn) => turn.speaker === "student").length] ??
    context.followUpPrompts.at(-1) ??
    "Ask one short follow-up question that helps the learner continue.";
  const counterpartLabel = getCounterpartLabel(context);
  const systemText =
    context.surface === "learn"
      ? [
          `You are role-playing as the learner's ${counterpartLabel} in a short ESL scenario.`,
          "Sound like a real human inside the scene, not a coach or worksheet.",
          "Acknowledge the learner's last point naturally before you move the exchange forward.",
          "Ask exactly one short follow-up question.",
          "Do not mention exercises, unit goals, target phrases, scores, or feedback while the conversation is live.",
          "Keep your reply brief enough to sound spoken, usually one or two short sentences.",
          "Return JSON only with this shape:",
          '{"reply":"string","microCoaching":"string","turnSignals":{"fluencyIssue":false,"grammarIssue":false,"vocabOpportunity":false}}',
        ].join(" ")
      : context.surface === "assessment"
        ? [
            `You are a warm ${counterpartLabel} having a short English placement conversation with a learner.`,
            "Sound like a real person, not a test engine, script, or worksheet.",
            "Acknowledge what the learner just said naturally before you move forward.",
            "If the learner asks for clarification with something like 'why?', 'what do you mean?', or 'can you repeat that?', do not answer for the learner or switch roles. Rephrase your last question in simpler English and invite a real answer.",
            "Ask exactly one short follow-up question unless the conversation already has enough detail, in which case close warmly without another question.",
            "Do not mention scores, evaluation, pronunciation analysis, rubrics, or that you are grading the learner.",
            "Keep your reply brief enough to sound spoken, usually one or two short sentences.",
            "Do not correct the learner during the live exchange.",
            "Return JSON only with this shape:",
            '{"reply":"string","microCoaching":"string","turnSignals":{"fluencyIssue":false,"grammarIssue":false,"vocabOpportunity":false}}',
          ].join(" ")
      : context.missionKind === "free_speech"
        ? [
            "You are a warm English conversation partner for an ESL learner.",
            "Continue a natural conversation in a human, lightly supportive tone.",
            "Do not frame the exchange as a scenario, lesson, worksheet, or speaking task.",
            "Do not introduce yourself as a teacher or classmate unless the learner explicitly asks for that kind of help.",
            "Keep each reply to 1-2 short spoken sentences and usually one open follow-up question.",
            "Allow mild topic drift if the learner takes the conversation somewhere real and related.",
            "Model better English naturally inside your reply by recasting or expanding the learner's idea without explicit correction language.",
            "Use the learner's level, active topic, and weak skill quietly to choose simpler or richer follow-ups.",
            "Do not mention scores, rubrics, evaluation, target phrases, or coaching language while the conversation is live.",
            "Return JSON only with this shape:",
            '{"reply":"string","microCoaching":"string","turnSignals":{"fluencyIssue":false,"grammarIssue":false,"vocabOpportunity":false}}',
          ].join(" ")
        : [
            "You are ESL International Connect.",
            "Continue a short English-learning conversation in a warm, professional tone.",
            "Sound like a real teacher, classmate, or conversation partner inside the scene, not a chatbot or worksheet.",
            "Keep each reply to 1-2 short spoken sentences.",
            "Stay inside the scenario and adapt to the learner's level.",
            "Model better English naturally inside your reply when useful by recasting or expanding the learner's idea.",
            "Prefer natural recasts and follow-up prompts over explicit correction language.",
            "Use follow-up questions that help the learner show the target skill.",
            "Do not mention scores, rubrics, evaluation, or coaching language while the conversation is live.",
            "Return JSON only with this shape:",
            '{"reply":"string","microCoaching":"string","turnSignals":{"fluencyIssue":false,"grammarIssue":false,"vocabOpportunity":false}}',
          ].join(" ");

  const response = await openai.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemText,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Surface: ${context.surface}`,
              `Mission kind: ${context.missionKind}`,
              `Starter lane: ${context.starterLabel ?? context.starterKey ?? "n/a"}`,
              `Scenario title: ${context.scenarioTitle}`,
              `Scenario setup: ${context.scenarioSetup}`,
              `Counterpart role: ${counterpartLabel}`,
              `Introduction style: ${context.introductionText ?? "n/a"}`,
              `Can-do goal: ${context.canDoStatement ?? "n/a"}`,
              `Performance task: ${context.performanceTask ?? "n/a"}`,
              `Target phrases: ${context.targetPhrases.join(", ") || "n/a"}`,
              `Success criteria: ${context.successCriteria.join(", ") || "n/a"}`,
              `Learner level: ${context.learnerLevel ?? "n/a"}`,
              `Current focus skill: ${context.focusSkill ?? "n/a"}`,
              `Active class topic: ${context.activeTopic ?? "n/a"}`,
              `Context hint: ${context.contextHint ?? "n/a"}`,
              `Why this session matters now: ${context.recommendationReason ?? "n/a"}`,
              `Suggested next follow-up: ${followUpHint}`,
              "Conversation so far:",
              transcriptBlock || "(no turns yet)",
              `Latest learner input: ${studentInput}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = extractJsonObject(getResponseText(response)) as {
    reply?: string;
    microCoaching?: string;
    turnSignals?: {
      fluencyIssue?: boolean;
      grammarIssue?: boolean;
      vocabOpportunity?: boolean;
    };
  };

  const aiResponseText =
    parsed.reply?.trim() ||
    (context.surface === "learn"
      ? "I see. Can you give one more detail?"
      : context.surface === "assessment"
        ? "Thanks. Can you tell me a little more about that?"
        : "Good start. Add one more detail so I can understand the situation better.");

  const microCoaching =
    parsed.microCoaching?.trim() ||
    (context.surface === "learn" || context.surface === "assessment"
      ? ""
      : context.missionKind === "free_speech"
        ? ""
        : "Keep your answer clear and connected.");
  const turnSignals = {
    fluencyIssue: Boolean(parsed.turnSignals?.fluencyIssue),
    grammarIssue: Boolean(parsed.turnSignals?.grammarIssue),
    vocabOpportunity: Boolean(parsed.turnSignals?.vocabOpportunity),
  };
  const coachLabel =
    buildSpeakTurnCoaching({
      microCoaching,
      turnSignals,
      mode: context.missionKind === "free_speech" ? "free_speech" : "guided",
    })?.label ?? "Keep this move";

  return {
    aiResponseText,
    microCoaching,
    coachLabel,
    turnSignals,
    aiAudioBase64: includeAudio ? await synthesizeSpeech(aiResponseText) : null,
    studentTranscriptText: studentInput,
  };
}

export async function evaluateMissionTranscript({
  context,
  turns,
}: {
  context: ConversationContext;
  turns: ConversationTurnLike[];
}): Promise<MissionReview> {
  if (!openai) {
    return createFallbackReview({
      turns,
      interactionMode: context.interactionMode,
      context,
    });
  }

  const transcript = turns
    .map((turn, index) => `${index + 1}. ${turn.speaker.toUpperCase()}: ${turn.text}`)
    .join("\n");

  const response = await openai.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are evaluating a short ESL speaking mission.",
              "Be supportive, concrete, and brief.",
              context.missionKind === "free_speech"
                ? "For free-speech conversations, use lighter, more natural coaching language instead of task-heavy teacher language."
                : "For guided scenarios, keep the feedback tied to the task and scenario.",
              "Return JSON only with this shape:",
              '{"status":"ready","score":78,"strength":"string","improvement":"string","pronunciationNote":"string or null","highlights":[{"turnIndex":1,"youSaid":"string","tryInstead":"string","why":"string"}],"vocabulary":[{"term":"string","definition":"string","translation":"string"}]}',
              "Use only these status values: ready, almost_there, practice_once_more.",
              "Return 2-3 highlights maximum.",
              "Vocabulary must be reusable 2-6 word chunks, not isolated single words.",
              "Prefer phrases the learner used well or should reuse next time.",
              "Do not return names, broad topic labels, or generic standalone words.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Mission kind: ${context.missionKind}`,
              `Scenario title: ${context.scenarioTitle}`,
              `Scenario setup: ${context.scenarioSetup}`,
              `Can-do goal: ${context.canDoStatement ?? "n/a"}`,
              `Performance task: ${context.performanceTask ?? "n/a"}`,
              `Target phrases: ${context.targetPhrases.join(", ") || "n/a"}`,
              `Success criteria: ${context.successCriteria.join(", ") || "n/a"}`,
              `Interaction mode: ${context.interactionMode}`,
              "Transcript:",
              transcript,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = extractJsonObject(getResponseText(response)) as {
    status?: MissionReview["status"];
    score?: number;
    strength?: string;
    improvement?: string;
    pronunciationNote?: string | null;
    highlights?: MissionHighlight[];
    vocabulary?: Array<{ term: string; definition: string; translation: string }>;
  };

  const fallback = createFallbackReview({
    turns,
    interactionMode: context.interactionMode,
    context,
  });
  const filteredVocabulary =
    Array.isArray(parsed.vocabulary) && parsed.vocabulary.length > 0
      ? filterSpeakVocabulary(parsed.vocabulary, 4)
      : [];

  return {
    status:
      parsed.status === "ready" ||
      parsed.status === "almost_there" ||
      parsed.status === "practice_once_more"
        ? parsed.status
        : fallback.status,
    score:
      typeof parsed.score === "number"
        ? clamp(Math.round(parsed.score))
        : fallback.score,
    strength: parsed.strength?.trim() || fallback.strength,
    improvement: parsed.improvement?.trim() || fallback.improvement,
    pronunciationNote:
      typeof parsed.pronunciationNote === "string" || parsed.pronunciationNote === null
        ? parsed.pronunciationNote
        : fallback.pronunciationNote,
    highlights:
      Array.isArray(parsed.highlights) && parsed.highlights.length > 0
        ? parsed.highlights.slice(0, 3)
        : fallback.highlights,
    turns: fallback.turns,
    vocabulary:
      filteredVocabulary.length > 0
        ? filteredVocabulary
        : filterSpeakVocabulary(fallback.vocabulary, 4),
  };
}

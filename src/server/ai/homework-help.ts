import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  inferHomeworkContentShape,
  type HomeworkContentShape,
  type HomeworkCoachAction,
} from "@/lib/homework-help";
import { clamp } from "@/lib/utils";
import { env } from "@/server/env";
import { openai } from "@/server/openai";

import { parseHomeworkText } from "./heuristics";

export type HomeworkQuestion = {
  index: number;
  promptText: string;
  questionType: string;
  focusSkill: string;
  studentGoal: string;
  answerFormat: string;
  successCriteria: string[];
  planSteps: string[];
  commonPitfalls: string[];
};

export type HomeworkParseResult = {
  assignmentTitle: string;
  assignmentSummary: string;
  subject: string;
  difficultyLevel: string;
  contentShape: HomeworkContentShape;
  parseConfidence: number;
  reviewNotes: string[];
  questions: HomeworkQuestion[];
};

export type HomeworkCoachReply = {
  coachTitle: string;
  coachMessage: string;
  checklist: string[];
  suggestedStarter: string | null;
  shouldAdvance: boolean;
  result: "keep_working" | "ready";
};

export type HomeworkExtractionResult = {
  rawText: string;
  extractionNotes: string[];
  extractionConfidence: number;
  extractionMethod: string;
};

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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeTextList(value: unknown, limit = 4) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function inferQuestionType(promptText: string) {
  const normalized = promptText.toLowerCase();

  if (/[a-d]\)/i.test(promptText) || /\bchoose\b/.test(normalized)) {
    return "multiple_choice";
  }

  if (/\btranslate\b/.test(normalized)) {
    return "translation";
  }

  if (/\bcompare\b|\bexplain\b|\bdescribe\b/.test(normalized)) {
    return "extended_response";
  }

  if (/\bshow\b.+\bwork\b|\bsolve\b/.test(normalized)) {
    return "show_work";
  }

  if (promptText.includes("?")) {
    return "short_answer";
  }

  return "other";
}

function guessFocusSkill(promptText: string, questionType: string) {
  const normalized = promptText.toLowerCase();

  if (/\bwrite\b|\bparagraph\b|\bessay\b/.test(normalized)) {
    return "writing";
  }

  if (/\bgrammar\b|\bverb\b|\btense\b|\bsentence\b/.test(normalized)) {
    return "grammar";
  }

  if (/\bvocabulary\b|\bword\b|\bdefine\b|\btranslate\b/.test(normalized)) {
    return "vocabulary";
  }

  if (questionType === "multiple_choice") {
    return "reading";
  }

  return "reading_and_writing";
}

function buildSuccessCriteria(promptText: string, questionType: string) {
  const criteria = [
    "Answer the exact question before adding extra detail.",
    questionType === "multiple_choice"
      ? "Use the passage or prompt details to justify the choice."
      : "Include at least one concrete detail from the assignment.",
    /\bwhy\b|\bbecause\b/i.test(promptText)
      ? "Give a reason, not only a short opinion."
      : "Check that your response is complete and clear.",
  ];

  return criteria.slice(0, 3);
}

function buildPlanSteps(promptText: string, questionType: string) {
  const steps = [
    "Underline the part of the prompt that tells you what to do.",
    questionType === "multiple_choice"
      ? "Eliminate answers that do not match the evidence."
      : "Draft the main idea you want to say before writing the full answer.",
    "Review your answer and make sure every part of the prompt is covered.",
  ];

  if (/\bcompare\b|\bdifference\b|\bsimilar\b/i.test(promptText)) {
    steps[1] = "List the two things you need to compare before you write.";
  }

  return steps;
}

function buildCommonPitfalls(promptText: string, questionType: string) {
  const pitfalls = [
    "Answering only part of the question.",
    questionType === "multiple_choice"
      ? "Picking an answer without checking the evidence."
      : "Writing a sentence that is too short to show your thinking.",
  ];

  if (/\bwhy\b|\bhow\b/i.test(promptText)) {
    pitfalls.push("Giving a fact without explaining why it matters.");
  }

  return pitfalls.slice(0, 3);
}

function normalizeQuestion(
  question: unknown,
  index: number,
  fallbackPrompt?: string
): HomeworkQuestion | null {
  const candidate = question as Record<string, unknown>;
  const promptText = normalizeText(candidate.promptText) || fallbackPrompt || "";

  if (!promptText) {
    return null;
  }

  const questionType =
    normalizeText(candidate.questionType) || inferQuestionType(promptText);
  const focusSkill =
    normalizeText(candidate.focusSkill) || guessFocusSkill(promptText, questionType);
  const successCriteria = normalizeTextList(candidate.successCriteria, 4);
  const planSteps = normalizeTextList(candidate.planSteps, 4);
  const commonPitfalls = normalizeTextList(candidate.commonPitfalls, 4);

  return {
    index: index + 1,
    promptText,
    questionType,
    focusSkill,
    studentGoal:
      normalizeText(candidate.studentGoal) ||
      "Show that you understand what the question is asking and answer it clearly.",
    answerFormat:
      normalizeText(candidate.answerFormat) ||
      (questionType === "multiple_choice"
        ? "Choose the best answer and explain why it fits."
        : "Write a clear answer in 1-3 sentences."),
    successCriteria:
      successCriteria.length > 0
        ? successCriteria
        : buildSuccessCriteria(promptText, questionType),
    planSteps:
      planSteps.length > 0 ? planSteps : buildPlanSteps(promptText, questionType),
    commonPitfalls:
      commonPitfalls.length > 0
        ? commonPitfalls
        : buildCommonPitfalls(promptText, questionType),
  };
}

export function createReviewedHomeworkQuestion({
  promptText,
  index,
  existingQuestion,
}: {
  promptText: string;
  index: number;
  existingQuestion?: Partial<HomeworkQuestion> | null;
}) {
  return normalizeQuestion(
    {
      ...existingQuestion,
      promptText,
    },
    index,
    promptText
  );
}

function createFallbackHomeworkParse(rawText: string, note?: string): HomeworkParseResult {
  const parsed = parseHomeworkText(rawText);
  const questions = parsed.questions
    .map((question, index) =>
      normalizeQuestion(
        {
          ...question,
          focusSkill: guessFocusSkill(question.promptText, question.questionType),
        },
        index,
        question.promptText
      )
    )
    .filter((question): question is HomeworkQuestion => Boolean(question));
  const firstPrompt = questions[0]?.promptText ?? "your assignment";
  const normalizedText = rawText.trim();
  const contentShape = inferHomeworkContentShape({
    rawText: normalizedText,
    questionCount: questions.length,
  });

  return {
    assignmentTitle:
      questions.length === 1
        ? "Homework question"
        : questions.length > 0
        ? `Homework set with ${questions.length} question${questions.length === 1 ? "" : "s"}`
        : "Homework assignment",
    assignmentSummary:
      questions.length === 1
        ? `Detected one question to work through. Start with "${firstPrompt}".`
        : questions.length > 0
        ? `Detected ${questions.length} question${questions.length === 1 ? "" : "s"} to work through. Start with "${firstPrompt}".`
        : "We could not confidently segment the assignment into clear questions yet.",
    subject:
      /\bbiology|science|experiment\b/i.test(normalizedText)
        ? "science"
        : /\bhistory|government|civil\b/i.test(normalizedText)
          ? "social studies"
          : /\balgebra|equation|fraction|geometry\b/i.test(normalizedText)
          ? "math"
            : "general coursework",
    difficultyLevel:
      questions.length >= 5 ? "moderate" : questions.length >= 2 ? "light" : "unknown",
    contentShape,
    parseConfidence: clamp(Math.round(parsed.parseConfidence * 100)) / 100,
    reviewNotes: note ? [note] : [],
    questions,
  };
}

function looksLikeUsableNativePdfText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length < 140) {
    return false;
  }

  const alphaMatches = normalized.match(/[a-z]/gi) ?? [];
  return alphaMatches.length / normalized.length > 0.45;
}

function getMimeTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

async function extractDocumentTextWithOpenAI({
  filePath,
  inputType,
  originalFileName,
}: {
  filePath: string;
  inputType: "pdf" | "image";
  originalFileName?: string | null;
}) {
  if (!openai) {
    throw new Error("OpenAI is not configured.");
  }

  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");
  const mimeType = getMimeTypeFromPath(filePath);
  const filename = originalFileName ?? path.basename(filePath);

  const response = await openai.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are extracting text from a student homework document.",
              "Return JSON only.",
              'Use this shape: {"rawText":"string","extractionNotes":["string"],"confidence":0.88}.',
              "Preserve question numbering, answer choices, and line order when possible.",
              "Do not summarize. Extract the assignment text itself.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Extract the homework text from this ${inputType === "pdf" ? "PDF" : "image"} file.`,
          },
          inputType === "image"
            ? ({
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              } as const)
            : ({
                type: "input_file",
                file_data: base64,
                filename,
                detail: "high",
              } as const),
        ],
      },
    ],
  });

  const parsed = extractJsonObject(getResponseText(response)) as {
    rawText?: string;
    extractionNotes?: unknown[];
    confidence?: number;
  };

  return {
    rawText: typeof parsed.rawText === "string" ? parsed.rawText.trim() : "",
    extractionNotes: normalizeTextList(parsed.extractionNotes, 5),
    extractionConfidence:
      typeof parsed.confidence === "number" ? clamp(Math.round(parsed.confidence * 100)) / 100 : 0.74,
    extractionMethod: inputType === "image" ? "openai_vision_image" : "openai_vision_pdf",
  } satisfies HomeworkExtractionResult;
}

export async function extractHomeworkTextFromSource({
  filePath,
  inputType,
  originalFileName,
}: {
  filePath: string;
  inputType: "pdf" | "image" | "text";
  originalFileName?: string | null;
}): Promise<HomeworkExtractionResult> {
  if (inputType === "text") {
    const rawText = await readFile(filePath, "utf8");
    return {
      rawText,
      extractionNotes: ["Loaded the pasted assignment text directly."],
      extractionConfidence: rawText.trim().length > 0 ? 0.95 : 0.2,
      extractionMethod: "direct_text",
    };
  }

  if (inputType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const fileBuffer = await readFile(filePath);
    const parser = new PDFParse({ data: fileBuffer });

    try {
      const parsed = await parser.getText();
      const rawText = parsed.text.trim();

      if (looksLikeUsableNativePdfText(rawText) || !openai) {
        return {
          rawText,
          extractionNotes: [
            looksLikeUsableNativePdfText(rawText)
              ? "Extracted text directly from the PDF."
              : "Used the native PDF text extraction fallback.",
          ],
          extractionConfidence: looksLikeUsableNativePdfText(rawText) ? 0.86 : 0.42,
          extractionMethod: "native_pdf",
        };
      }
    } finally {
      await parser.destroy();
    }

    try {
      return await extractDocumentTextWithOpenAI({
        filePath,
        inputType: "pdf",
        originalFileName,
      });
    } catch {
      return {
        rawText: "",
        extractionNotes: [
          "The PDF text was weak and AI extraction was unavailable. Paste the assignment text if this upload preview looks incomplete.",
        ],
        extractionConfidence: 0.2,
        extractionMethod: "pdf_fallback_unreadable",
      };
    }
  }

  if (!openai) {
    return {
      rawText: "",
      extractionNotes: [
        "Image uploads need AI vision support. Paste the assignment text if the screenshot preview looks incomplete.",
      ],
      extractionConfidence: 0.15,
      extractionMethod: "image_unavailable",
    };
  }

  return extractDocumentTextWithOpenAI({
    filePath,
    inputType: "image",
    originalFileName,
  });
}

export async function parseHomeworkAssignment({
  rawText,
  inputType,
  originalFileName,
}: {
  rawText: string;
  inputType: "pdf" | "image" | "text";
  originalFileName?: string | null;
}): Promise<HomeworkParseResult> {
  const fallback = createFallbackHomeworkParse(rawText);

  if (!openai || rawText.trim().length < 80) {
    return fallback;
  }

  try {
    const response = await openai.responses.create({
      model: env.OPENAI_TEXT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are turning a student assignment into a guided homework-help plan for an ESL learning coach.",
                "Return JSON only.",
                'Use this shape: {"assignmentTitle":"string","assignmentSummary":"string","subject":"string","difficultyLevel":"light|moderate|challenging","parseConfidence":0.84,"reviewNotes":["string"],"questions":[{"promptText":"string","questionType":"string","focusSkill":"string","studentGoal":"string","answerFormat":"string","successCriteria":["string"],"planSteps":["string"],"commonPitfalls":["string"]}]}',
                "Segment the assignment into discrete questions or tasks.",
                "Do not dump full answers.",
                "If the assignment is partially unreadable, salvage what is usable and note the uncertainty in reviewNotes.",
                "Keep question guidance concise and practical for a student coach workflow.",
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
                `Input type: ${inputType}`,
                `Original file name: ${originalFileName ?? "n/a"}`,
                "Assignment text:",
                rawText.slice(0, 18000),
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const parsed = extractJsonObject(getResponseText(response)) as Record<string, unknown>;
    const parsedQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = parsedQuestions
      .map((question, index) =>
        normalizeQuestion(
          question,
          index,
          fallback.questions[index]?.promptText
        )
      )
      .filter((question): question is HomeworkQuestion => Boolean(question));

    if (questions.length === 0) {
      return {
        ...fallback,
        reviewNotes: ["We needed the simpler parser because the assignment structure was still unclear."],
      };
    }

    return {
      assignmentTitle:
        normalizeText(parsed.assignmentTitle) ||
        fallback.assignmentTitle,
      assignmentSummary:
        normalizeText(parsed.assignmentSummary) ||
        fallback.assignmentSummary,
      subject: normalizeText(parsed.subject) || fallback.subject,
      difficultyLevel:
        normalizeText(parsed.difficultyLevel) || fallback.difficultyLevel,
      contentShape: inferHomeworkContentShape({
        rawText,
        questionCount: questions.length,
      }),
      parseConfidence:
        typeof parsed.parseConfidence === "number"
          ? clamp(Math.round(parsed.parseConfidence * 100)) / 100
          : Math.max(fallback.parseConfidence, 0.72),
      reviewNotes: normalizeTextList(parsed.reviewNotes, 4),
      questions,
    };
  } catch {
    return {
      ...fallback,
      reviewNotes: ["We used the local parser because the richer assignment analysis was unavailable."],
    };
  }
}

function createFallbackHomeworkCoachReply({
  action,
  question,
  studentAnswer,
  hintLevel,
}: {
  action: HomeworkCoachAction;
  question: HomeworkQuestion;
  studentAnswer: string;
  hintLevel: number;
}): HomeworkCoachReply {
  const wordCount = studentAnswer.trim().split(/\s+/).filter(Boolean).length;
  const generalizedChecklist = question.successCriteria.slice(0, 3);

  if (action === "explain") {
    return {
      coachTitle: "What this question wants",
      coachMessage: `${question.studentGoal} Keep the answer focused on "${question.promptText}".`,
      checklist: generalizedChecklist,
      suggestedStarter:
        question.questionType === "multiple_choice"
          ? "I think the best answer is ___ because ..."
          : "This question is mainly asking me to explain ...",
      shouldAdvance: false,
      result: "keep_working",
    };
  }

  if (action === "plan") {
    return {
      coachTitle: "Simple plan",
      coachMessage: "Take the question one move at a time instead of trying to write everything at once.",
      checklist: question.planSteps.slice(0, 3),
      suggestedStarter:
        question.questionType === "multiple_choice"
          ? "First, I will look for the detail in the text that matches ..."
          : "First, I want to say ... Then I can add ...",
      shouldAdvance: false,
      result: "keep_working",
    };
  }

  if (action === "hint") {
    const hints = [
      question.planSteps[0] ?? "Start by naming what the question is asking.",
      question.planSteps[1] ?? question.successCriteria[0] ?? "Answer one part of the question first.",
      question.commonPitfalls[0]
        ? `Watch out for this mistake: ${question.commonPitfalls[0].toLowerCase()}`
        : "Before you finish, check whether you answered every part of the question.",
    ];

    return {
      coachTitle: `Hint ${Math.min(hintLevel, 3)} of 3`,
      coachMessage: hints[Math.min(Math.max(hintLevel, 1), 3) - 1],
      checklist: generalizedChecklist,
      suggestedStarter: null,
      shouldAdvance: false,
      result: "keep_working",
    };
  }

  if (action === "check") {
    const missing = generalizedChecklist.filter(
      (_, index) => (index === 0 && wordCount < 8) || (index > 0 && wordCount < 16)
    );

    return {
      coachTitle: wordCount >= 18 ? "Strong direction" : "What to improve",
      coachMessage:
        wordCount >= 18
          ? "You have enough here to keep shaping the answer. Tighten it so every sentence supports the question."
          : "Your answer needs one more clear detail so it fully addresses the prompt.",
      checklist: missing.length > 0 ? missing : generalizedChecklist,
      suggestedStarter:
        wordCount < 8 ? "One key detail I should add is ..." : null,
      shouldAdvance: false,
      result: wordCount >= 18 ? "ready" : "keep_working",
    };
  }

  const readyToAdvance = wordCount >= 18 || (question.questionType === "multiple_choice" && wordCount >= 8);

  return {
    coachTitle: readyToAdvance ? "Ready to move on" : "Not quite yet",
    coachMessage: readyToAdvance
      ? "This covers the core task well enough to move to the next question."
      : "Add one more specific detail or explanation before you submit this step.",
    checklist: readyToAdvance ? [] : generalizedChecklist,
    suggestedStarter: readyToAdvance ? null : "To make this clearer, I should add ...",
    shouldAdvance: readyToAdvance,
    result: readyToAdvance ? "ready" : "keep_working",
  };
}

export async function generateHomeworkCoachReply({
  action,
  question,
  assignmentTitle,
  assignmentSummary,
  studentAnswer,
  hintLevel,
}: {
  action: HomeworkCoachAction;
  question: HomeworkQuestion;
  assignmentTitle: string;
  assignmentSummary: string;
  studentAnswer: string;
  hintLevel: number;
}): Promise<HomeworkCoachReply> {
  const fallback = createFallbackHomeworkCoachReply({
    action,
    question,
    studentAnswer,
    hintLevel,
  });

  if (!openai) {
    return fallback;
  }

  try {
    const response = await openai.responses.create({
      model: env.OPENAI_TEXT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are an ESL homework coach.",
                "Your job is to help the student think, plan, and improve, not to dump answers.",
                "Return JSON only.",
                'Use this shape: {"coachTitle":"string","coachMessage":"string","checklist":["string"],"suggestedStarter":"string or null","shouldAdvance":false,"result":"keep_working|ready"}.',
                "Use short, direct coaching language.",
                "Never reveal a full completed answer.",
                "When the action is hint, give only the next laddered hint based on the hint level.",
                "When the action is submit, set shouldAdvance true only if the draft covers the core task well enough to move on.",
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
                `Action: ${action}`,
                `Hint level requested: ${hintLevel}`,
                `Assignment title: ${assignmentTitle}`,
                `Assignment summary: ${assignmentSummary}`,
                `Question: ${question.promptText}`,
                `Question type: ${question.questionType}`,
                `Focus skill: ${question.focusSkill}`,
                `Student goal: ${question.studentGoal}`,
                `Answer format: ${question.answerFormat}`,
                `Success criteria: ${question.successCriteria.join(" | ") || "n/a"}`,
                `Plan steps: ${question.planSteps.join(" | ") || "n/a"}`,
                `Common pitfalls: ${question.commonPitfalls.join(" | ") || "n/a"}`,
                `Current student draft: ${studentAnswer.trim() || "(empty)"}`,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const parsed = extractJsonObject(getResponseText(response)) as Record<string, unknown>;
    const checklist = normalizeTextList(parsed.checklist, 4);

    return {
      coachTitle: normalizeText(parsed.coachTitle) || fallback.coachTitle,
      coachMessage: normalizeText(parsed.coachMessage) || fallback.coachMessage,
      checklist: checklist.length > 0 ? checklist : fallback.checklist,
      suggestedStarter:
        normalizeText(parsed.suggestedStarter) || fallback.suggestedStarter,
      shouldAdvance:
        typeof parsed.shouldAdvance === "boolean"
          ? parsed.shouldAdvance
          : fallback.shouldAdvance,
      result: parsed.result === "ready" ? "ready" : fallback.result,
    };
  } catch {
    return fallback;
  }
}

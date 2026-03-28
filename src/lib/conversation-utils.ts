export type LiveStudentTurnDisposition =
  | "accepted_answer"
  | "clarification_request"
  | "acknowledgement_only"
  | "noise_or_unintelligible"
  | "off_task_short";

export type LiveStudentTurnReasonCode =
  | "accepted"
  | "clarification_repeat"
  | "clarification_non_english"
  | "acknowledgement_only"
  | "ambient_noise"
  | "unintelligible_audio"
  | "fragment_answer";

export type LiveStudentTurnFeedback = {
  disposition: LiveStudentTurnDisposition;
  countsTowardProgress: boolean;
  reasonCode: LiveStudentTurnReasonCode;
};

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/[?!.,;:]+$/g, "");
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsNonLatinConfusion(text: string) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text);
}

function looksLikeAmbientNoise(text: string) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return true;
  }

  if (/^\[.*\]$/.test(normalized)) {
    return true;
  }

  if (/^(uh|um|erm|hmm|mm|mmm|ah|eh)+$/.test(normalized)) {
    return true;
  }

  if (!/[a-z]/i.test(normalized) && !containsNonLatinConfusion(normalized)) {
    return true;
  }

  return false;
}

export function isClarificationRequest(text: string) {
  const normalized = normalizeText(text);

  return (
    [
      "why",
      "what",
      "what do you mean",
      "what do you mean by that",
      "can you repeat that",
      "could you repeat that",
      "say that again",
      "tell me again",
      "repeat that",
      "i dont understand",
      "i don't understand",
      "which one",
      "sorry",
      "pardon",
      "huh",
      "come again",
      "excuse me",
    ].includes(normalized) || containsNonLatinConfusion(normalized)
  );
}

export function isAcknowledgementOnly(text: string) {
  const normalized = normalizeText(text);

  return [
    "yes",
    "yeah",
    "yep",
    "okay",
    "ok",
    "sure",
    "thank you",
    "thanks",
    "got it",
    "i see",
    "right",
    "alright",
    "sounds good",
    "good",
  ].includes(normalized);
}

export function classifyLiveStudentTurn(text: string): LiveStudentTurnFeedback {
  const normalized = normalizeText(text);
  const wordCount = countWords(text);

  if (!normalized || looksLikeAmbientNoise(normalized)) {
    return {
      disposition: "noise_or_unintelligible",
      countsTowardProgress: false,
      reasonCode: normalized ? "ambient_noise" : "unintelligible_audio",
    };
  }

  if (containsNonLatinConfusion(normalized) || isClarificationRequest(normalized)) {
    return {
      disposition: "clarification_request",
      countsTowardProgress: false,
      reasonCode: containsNonLatinConfusion(normalized)
        ? "clarification_non_english"
        : "clarification_repeat",
    };
  }

  if (isAcknowledgementOnly(normalized)) {
    return {
      disposition: "acknowledgement_only",
      countsTowardProgress: false,
      reasonCode: "acknowledgement_only",
    };
  }

  if (
    wordCount <= 5 &&
    /^(to|for|with|about|at|in|on|from|because|and|but)\b/i.test(normalized)
  ) {
    return {
      disposition: "off_task_short",
      countsTowardProgress: false,
      reasonCode: "fragment_answer",
    };
  }

  return {
    disposition: "accepted_answer",
    countsTowardProgress: true,
    reasonCode: "accepted",
  };
}

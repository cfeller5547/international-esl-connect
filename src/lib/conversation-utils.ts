export function isClarificationRequest(text: string) {
  const normalized = text.trim().toLowerCase().replace(/[?!.,]+$/g, "");

  return [
    "why",
    "what",
    "what do you mean",
    "what do you mean by that",
    "can you repeat that",
    "say that again",
    "i dont understand",
    "i don't understand",
    "which one",
    "sorry",
    "pardon",
    "huh",
  ].includes(normalized);
}

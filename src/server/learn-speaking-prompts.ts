type LearnOpeningSeed = {
  scenarioTitle?: string | null;
  scenarioSetup: string;
  canDoStatement?: string | null;
  performanceTask?: string | null;
  counterpartRole?: string | null;
  openingQuestion?: string | null;
};

function normalizeQuestion(text: string | null | undefined) {
  const trimmed = (text ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  return /[?!]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

function createSource(seed: LearnOpeningSeed) {
  return [
    seed.scenarioTitle ?? "",
    seed.scenarioSetup,
    seed.canDoStatement ?? "",
    seed.performanceTask ?? "",
    seed.counterpartRole ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function hasAny(source: string, patterns: string[]) {
  return patterns.some((pattern) => source.includes(pattern));
}

export function isGenericLearnOpeningQuestion(text: string | null | undefined) {
  const normalized = normalizeQuestion(text).toLowerCase();

  return (
    normalized === "can you answer that in your own words?" ||
    normalized === "what would you say?" ||
    normalized === "what would you say first?" ||
    normalized === "what happened?" ||
    normalized === "what are you going to do?"
  );
}

export function inferLearnOpeningQuestion(seed: LearnOpeningSeed) {
  const source = createSource(seed);

  if (hasAny(source, ["introduce", "new student", "personal information"])) {
    return "What's your name?";
  }

  if (hasAny(source, ["family"])) {
    return "Can you tell me about one person in your family?";
  }

  if (
    hasAny(source, [
      "daily routine",
      "weekday",
      "school day",
      "schedule",
      "habit",
      "frequency",
    ])
  ) {
    return "What does a normal school day look like for you?";
  }

  if (hasAny(source, ["food", "shopping", "snack", "price", "buy"])) {
    return "What would you like to buy?";
  }

  if (hasAny(source, ["home", "school area", "neighborhood", "direction", "near school"])) {
    return "Can you tell me about an important place near your school?";
  }

  if (hasAny(source, ["weekend plan", "tomorrow", "weather"])) {
    return "What are you going to do this weekend?";
  }

  if (hasAny(source, ["weekend", "past", "story", "yesterday", "experience"])) {
    return "What did you do last weekend?";
  }

  if (hasAny(source, ["happening right now", "around you", "present continuous", "today"])) {
    return "What is happening around you right now?";
  }

  if (hasAny(source, ["assignment", "deadline", "responsibilit", "need to", "have to"])) {
    return "What do you need to finish first?";
  }

  if (
    hasAny(source, [
      "transportation",
      "health",
      "public service",
      "appointment",
      "ticket",
      "medicine",
      "help",
      "problem",
    ])
  ) {
    return "What kind of help do you need?";
  }

  if (hasAny(source, ["compare", "prefer", "choice", "better than"])) {
    return "Which option would you choose, and why?";
  }

  if (hasAny(source, ["opinion", "discussion question"])) {
    return "What do you think, and why?";
  }

  if (hasAny(source, ["solution", "decision", "should", "could"])) {
    return "What do you think we should do?";
  }

  if (hasAny(source, ["summary", "summarize", "main idea", "text", "source"])) {
    return "What is the main idea, in your own words?";
  }

  if (hasAny(source, ["goal", "future", "prepare", "next step", "possible"])) {
    return "What goal are you working toward?";
  }

  if (hasAny(source, ["interview"])) {
    return "Can you tell me a little about yourself and your experience?";
  }

  if (hasAny(source, ["presentation"])) {
    return "Can you explain your topic clearly for us?";
  }

  if (hasAny(source, ["argument", "claim", "evidence"])) {
    return "What is the main claim, and do you think the evidence is strong?";
  }

  if (hasAny(source, ["formal", "register", "tone"])) {
    return "How would you say that in a more formal way?";
  }

  if (hasAny(source, ["debate", "persuade", "position", "counterargument"])) {
    return "What is your position, and why?";
  }

  if (hasAny(source, ["implied meaning", "inference", "implicit", "interpret"])) {
    return "What do you think the text is implying?";
  }

  if (hasAny(source, ["recommend", "recommendation"])) {
    return "What do you recommend, and why?";
  }

  return "What would you say first?";
}

export function createLearnOpeningPrompt(seed: LearnOpeningSeed) {
  const source = createSource(seed);
  const explicitQuestion = normalizeQuestion(seed.openingQuestion);
  const question =
    explicitQuestion && !isGenericLearnOpeningQuestion(explicitQuestion)
      ? explicitQuestion
      : inferLearnOpeningQuestion(seed);

  if (hasAny(source, ["introduce", "new student", "personal information"])) {
    return "Hi, I don't think we've met yet. What's your name?";
  }

  if (hasAny(source, ["food", "shopping", "snack", "price", "buy"])) {
    return "Hi. What would you like to buy?";
  }

  if (
    hasAny(source, [
      "transportation",
      "health",
      "public service",
      "appointment",
      "ticket",
      "medicine",
      "help",
      "problem",
    ])
  ) {
    return "Hi. What kind of help do you need?";
  }

  if (hasAny(source, ["interview"])) {
    return "Thanks for meeting with me. Can you tell me a little about yourself and your experience?";
  }

  if (hasAny(source, ["presentation"])) {
    return "Go ahead when you're ready. Can you explain your topic clearly for us?";
  }

  return question;
}

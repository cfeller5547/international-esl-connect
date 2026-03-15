/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { createOpeningPrompt } from "@/server/ai/openai-conversation";

describe("openai conversation helpers", () => {
  it("creates a concrete scenario opener for introductions units", () => {
    const opening = createOpeningPrompt({
      surface: "learn",
      missionKind: "unit_speaking",
      interactionMode: "text",
      scenarioTitle: "Introductions and Personal Information",
      scenarioSetup: "You meet a new student before class starts.",
      counterpartRole: "classmate",
      openingQuestion: "Can you answer that in your own words?",
      canDoStatement: "I can introduce myself and ask simple personal questions.",
      performanceTask: "Introduce yourself to a new classmate and ask two basic questions.",
      targetPhrases: ["hello", "name"],
      followUpPrompts: ["Ask one more personal question."],
      successCriteria: ["Introduce yourself clearly."],
      modelExample: "Hi, I'm Ana. What's your name?",
      isBenchmark: false,
    });

    expect(opening).toBe("Hi, I don't think we've met yet. What's your name?");
    expect(opening).not.toMatch(/answer that in your own words/i);
  });

  it("creates a natural opening question for Learn missions", () => {
    const opening = createOpeningPrompt({
      surface: "learn",
      missionKind: "unit_speaking",
      interactionMode: "text",
      scenarioTitle: "Explain Opinions and Give Reasons",
      scenarioSetup: "You are answering a discussion question in class.",
      counterpartRole: "teacher",
      openingQuestion: "What do you think, and why?",
      canDoStatement: "I can express an opinion and support it with reasons.",
      performanceTask: "Give an opinion on a familiar topic and support it clearly.",
      targetPhrases: ["I think", "because"],
      followUpPrompts: ["Why do you think that?"],
      successCriteria: ["Give one clear answer and one supporting detail."],
      modelExample: "I think uniforms can help because they reduce pressure.",
      isBenchmark: false,
    });

    expect(opening).toBe("What do you think, and why?");
    expect(opening).not.toMatch(/let's practice/i);
    expect(opening).not.toMatch(/start with this/i);
  });
});

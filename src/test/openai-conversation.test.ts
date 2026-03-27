/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  createOpeningPrompt,
  selectFollowUpPrompt,
} from "@/server/ai/openai-conversation";

describe("openai conversation helpers", () => {
  it("creates a human introduction for assessment conversations", () => {
    const opening = createOpeningPrompt({
      surface: "assessment",
      missionKind: "guided",
      interactionMode: "text",
      scenarioTitle: "Diagnostic conversation",
      scenarioSetup: "You are talking with a placement coach about your classes.",
      counterpartRole: "placement_coach",
      introductionText:
        "Hi, I'm Maya. I want to get a feel for how you use English in class.",
      openingQuestion: "What's your name, and what class are you taking right now?",
      canDoStatement: "I can answer simple questions about my classes and goals.",
      performanceTask: "Have a short placement conversation.",
      targetPhrases: ["I'm taking", "I want to improve"],
      followUpPrompts: ["What do you usually do in that class?"],
      successCriteria: ["Answer naturally with clear details."],
      modelExample: "I'm Ana, and I'm taking biology.",
      evidenceTargets: [],
      followUpObjectives: [],
      benchmarkFocus: [],
      requiredTurns: 3,
      minimumFollowUpResponses: 0,
      isBenchmark: false,
    });

    expect(opening).toBe(
      "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?"
    );
    expect(opening).not.toMatch(/let's begin/i);
  });

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
      evidenceTargets: [],
      followUpObjectives: [],
      benchmarkFocus: [],
      requiredTurns: 3,
      minimumFollowUpResponses: 0,
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
      evidenceTargets: [],
      followUpObjectives: [],
      benchmarkFocus: [],
      requiredTurns: 3,
      minimumFollowUpResponses: 0,
      isBenchmark: false,
    });

    expect(opening).toBe("What do you think, and why?");
    expect(opening).not.toMatch(/let's practice/i);
    expect(opening).not.toMatch(/start with this/i);
  });

  it("creates a short human opener for free speech without role-play framing", () => {
    const opening = createOpeningPrompt({
      surface: "speak",
      missionKind: "free_speech",
      interactionMode: "text",
      starterKey: "learning",
      starterLabel: "Something I'm learning",
      scenarioTitle: "Something I'm learning",
      scenarioSetup: "Have an open conversation about something the learner is studying.",
      openingQuestion: "What are you learning right now?",
      targetPhrases: ["I'm learning...", "One part that stands out is..."],
      followUpPrompts: ["Ask what part feels easiest right now."],
      successCriteria: [],
      starterPrompt: "Talk about something you are learning right now.",
      activeTopic: "cell division",
      contextHint: "Use cell division or another class idea that feels current.",
      evidenceTargets: [],
      followUpObjectives: [],
      benchmarkFocus: [],
      requiredTurns: 3,
      minimumFollowUpResponses: 0,
      isBenchmark: false,
    });

    expect(opening).toBe("What are you learning right now?");
    expect(opening).not.toMatch(/teacher|classmate|practice session/i);
  });

  it("uses the first authored follow-up after the first learner turn", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: [
          "Why do you think that?",
          "Can you give one example?",
          "What is one drawback?",
        ],
        followUpObjectives: [],
        evidenceTargets: [],
        benchmarkFocus: [],
        minimumFollowUpResponses: 0,
        successCriteria: [],
      },
      studentTurnCount: 1,
      fallback: "Tell me a little more.",
    });

    expect(prompt).toBe("Why do you think that?");
  });

  it("falls back to the last authored follow-up once the learner goes beyond the authored list", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: ["What happened next?", "Why do you still remember it?"],
        followUpObjectives: [],
        evidenceTargets: [],
        benchmarkFocus: [],
        minimumFollowUpResponses: 0,
        successCriteria: [],
      },
      studentTurnCount: 4,
      fallback: "Tell me one more detail.",
    });

    expect(prompt).toBe("Why do you still remember it?");
  });

  it("prefers the follow-up that targets the missing evidence", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: [
          "What is one reason for your choice?",
          "What is one drawback of the other option?",
        ],
        followUpObjectives: [
          "Ask for one reason that supports the choice.",
          "Ask for one drawback of the other option.",
        ],
        evidenceTargets: [
          {
            key: "supported-reason",
            label: "Support the choice with a reason",
            kind: "detail",
            cues: ["because", "one reason"],
          },
          {
            key: "drawback",
            label: "Mention one drawback of the other option",
            kind: "detail",
            cues: ["drawback", "however", "on the other hand"],
          },
        ],
        benchmarkFocus: ["Support the choice with a reason."],
        minimumFollowUpResponses: 2,
        successCriteria: ["Make a clear choice."],
      },
      studentTurnCount: 2,
      turns: [
        { speaker: "ai", text: "Which option fits your week better?" },
        { speaker: "student", text: "I'd choose the workshop." },
        { speaker: "ai", text: "Good. Tell me more." },
      ],
      fallback: "Tell me a little more.",
    });

    expect(prompt).toBe("What is one reason for your choice?");
  });

  it("uses authored Very Basic benchmark follow-ups to target missing weather evidence", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: [
          "What will you do if the weather changes?",
          "Who are you going with?",
          "What time are you going to go?",
        ],
        followUpObjectives: [
          "Ask what the learner will do if the weather changes.",
          "Ask who they are going with or when they are going.",
          "Prompt for one more simple detail if the plan is still too short.",
        ],
        evidenceTargets: [
          {
            key: "weekend-plan",
            label: "State one weekend plan clearly",
            kind: "task",
            cues: ["i'm going to", "weekend", "visit"],
          },
          {
            key: "weather-language",
            label: "Mention the weather",
            kind: "language",
            cues: ["rain", "sunny", "if it rains", "it will be"],
          },
          {
            key: "backup-idea",
            label: "Add one backup idea or extra detail",
            kind: "detail",
            cues: ["maybe we can", "instead", "if it rains"],
          },
        ],
        benchmarkFocus: [
          "Say the main plan clearly.",
          "Connect the plan to the weather.",
          "Answer one follow-up with a useful detail.",
        ],
        minimumFollowUpResponses: 1,
        successCriteria: ["State one plan clearly."],
      },
      studentTurnCount: 2,
      turns: [
        { speaker: "ai", text: "What are you going to do this weekend?" },
        { speaker: "student", text: "I'm going to visit my friend on Saturday." },
        { speaker: "ai", text: "Nice." },
      ],
      fallback: "Tell me one more detail.",
    });

    expect(prompt).toBe("What will you do if the weather changes?");
  });

  it("uses authored Intermediate benchmark follow-ups to target a missing tradeoff", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: [
          "Why do you think that is the best option?",
          "What is one problem with the other idea?",
          "How can the group make a final decision?",
        ],
        followUpObjectives: [
          "Ask why the learner's preferred option is stronger than the other idea.",
          "Ask for one weakness or tradeoff in the rejected option or the chosen plan.",
          "Prompt the learner to move the group toward a final decision instead of staying in brainstorming mode.",
        ],
        evidenceTargets: [
          {
            key: "decision-problem",
            label: "Define the group problem and one real option",
            kind: "task",
            cues: ["raise money", "class trip", "we could", "we should"],
          },
          {
            key: "decision-comparison",
            label: "Compare at least two options clearly",
            kind: "language",
            cues: ["better", "could", "should", "another option", "compared with"],
          },
          {
            key: "decision-justification",
            label: "Justify the recommendation with a reason or tradeoff",
            kind: "detail",
            cues: ["because", "faster", "more people can join", "problem", "tradeoff"],
          },
          {
            key: "decision-follow-up",
            label: "Handle follow-up pressure without losing the decision",
            kind: "follow_up",
            cues: ["best option", "other idea", "final decision"],
          },
        ],
        benchmarkFocus: [
          "Define the problem and compare more than one option.",
          "Justify the recommendation with a concrete tradeoff or reason.",
          "Handle follow-up questions without losing the final decision.",
        ],
        minimumFollowUpResponses: 2,
        successCriteria: [
          "Suggest at least one solution.",
          "Compare options.",
          "Help move the group toward a decision.",
        ],
      },
      studentTurnCount: 2,
      turns: [
        { speaker: "ai", text: "We need to raise money for the class trip. What do you think we should do?" },
        { speaker: "student", text: "We should do a weekend car wash for the class trip." },
        { speaker: "ai", text: "Okay." },
      ],
      fallback: "Tell me a little more.",
    });

    expect(prompt).toBe("What is one problem with the other idea?");
  });

  it("uses authored Advanced benchmark follow-ups to target a missing rebuttal", () => {
    const prompt = selectFollowUpPrompt({
      context: {
        followUpPrompts: [
          "What is your strongest reason?",
          "How would you answer the other side?",
          "What would you say to someone who disagrees?",
        ],
        followUpObjectives: [
          "Ask for the strongest reason behind the learner's position.",
          "Ask how the learner would answer the other side or a likely objection.",
          "Prompt the learner to defend the position again without repeating the same sentence word for word.",
        ],
        evidenceTargets: [
          {
            key: "debate-position",
            label: "State a clear position immediately",
            kind: "task",
            cues: ["i believe", "my position", "should be reduced"],
          },
          {
            key: "debate-support",
            label: "Support the position with a persuasive reason",
            kind: "language",
            cues: ["my main reason is", "because", "the strongest reason"],
          },
          {
            key: "debate-rebuttal",
            label: "Respond to an objection with a real rebuttal",
            kind: "detail",
            cues: ["however", "i would respond that", "on the other hand"],
          },
          {
            key: "debate-pressure",
            label: "Sustain the position across benchmark follow-up pressure",
            kind: "follow_up",
            cues: ["disagrees", "objection", "other side"],
          },
        ],
        benchmarkFocus: [
          "Open with a clear position and a strong reason.",
          "Answer objections without losing the stance.",
          "Keep the rebuttal coherent across multiple follow-up questions.",
        ],
        minimumFollowUpResponses: 3,
        successCriteria: [
          "State a clear position.",
          "Support it persuasively.",
          "Respond to one objection or opposing view.",
        ],
      },
      studentTurnCount: 2,
      turns: [
        { speaker: "ai", text: "What is your position on reducing homework?" },
        { speaker: "student", text: "I believe homework should be reduced in lower grades because too much of it can hurt balance and sleep." },
        { speaker: "ai", text: "Go on." },
      ],
      fallback: "Tell me a little more.",
    });

    expect(prompt).toBe("How would you answer the other side?");
  });
});

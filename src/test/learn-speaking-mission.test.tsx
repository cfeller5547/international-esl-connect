import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LearnSpeakingMission } from "@/features/learn/learn-speaking-mission";

function buildMissionProps() {
  return {
    unitSlug: "intermediate-unit-2",
    unitTitle: "Explain Opinions and Give Reasons",
    unitOrder: 2,
    canDoStatement: "I can express an opinion and support it with reasons.",
    performanceTask: "Give an opinion on a familiar topic and support it clearly.",
    mission: {
      scenarioTitle: "Explain Opinions and Give Reasons",
      scenarioSetup: "You are answering a discussion question in class.",
      counterpartRole: "teacher",
      openingQuestion: "What do you think, and why?",
      warmupPrompts: ["Say one opinion and one supporting reason."],
      targetPhrases: ["I think", "because", "for example"],
      followUpPrompts: ["Why do you think that?"],
      successCriteria: ["Give one clear answer and one supporting detail."],
      modelExample: "I think school uniforms can help because they reduce pressure.",
      isBenchmark: false,
      requiredTurns: 3,
      minimumFollowUpResponses: 1,
      benchmarkFocus: [],
    },
    completionEndpoint: "/api/v1/learn/curriculum/activity/complete",
    fallbackHref: "/app/learn",
  };
}

describe("LearnSpeakingMission", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak: vi.fn(),
    });
    class MockSpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
  });

  it("opens in a voice-first brief for Pro users", () => {
    render(
      <LearnSpeakingMission
        {...buildMissionProps()}
        plan="pro"
        voiceEnabled
        progressStatus="unlocked"
        initialSession={null}
        savedReview={null}
      />
    );

    expect(screen.getByRole("heading", { name: /explain opinions and give reasons/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start conversation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use keyboard instead/i })).toBeInTheDocument();
    expect(screen.queryByText(/choose your mode/i)).not.toBeInTheDocument();
  });

  it("keeps the conversation state focused and hides feedback until enough replies are complete", async () => {
    const user = userEvent.setup();

    render(
      <LearnSpeakingMission
        {...buildMissionProps()}
        plan="pro"
        voiceEnabled
        progressStatus="unlocked"
        initialSession={{
          id: "session-1",
          status: "active",
          interactionMode: "voice",
          retryOfSessionId: null,
          turns: [
            { turnIndex: 1, speaker: "ai", text: "What is your opinion?" },
            { turnIndex: 2, speaker: "student", text: "I think uniforms can help." },
            { turnIndex: 3, speaker: "ai", text: "Why do you think that?" },
            { turnIndex: 4, speaker: "student", text: "Because they reduce pressure." },
            { turnIndex: 5, speaker: "ai", text: "Can you add one example?" },
          ],
        }}
        savedReview={null}
      />
    );

    expect(screen.getByRole("button", { name: /reconnect live voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /type instead/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /see feedback/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/mission details/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of 3 replies done/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /type instead/i }));

    expect(screen.getByPlaceholderText(/type your reply/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try live voice again/i })).toBeInTheDocument();
  });

  it("shows See feedback only after the required number of learner replies", () => {
    render(
      <LearnSpeakingMission
        {...buildMissionProps()}
        plan="free"
        voiceEnabled={false}
        progressStatus="unlocked"
        initialSession={{
          id: "session-2",
          status: "active",
          interactionMode: "text",
          retryOfSessionId: null,
          turns: [
            { turnIndex: 1, speaker: "ai", text: "What is your opinion?" },
            { turnIndex: 2, speaker: "student", text: "I think uniforms can help." },
            { turnIndex: 3, speaker: "ai", text: "Why do you think that?" },
            { turnIndex: 4, speaker: "student", text: "Because they reduce pressure." },
            { turnIndex: 5, speaker: "ai", text: "Can you add one example?" },
            { turnIndex: 6, speaker: "student", text: "For example, students feel more equal." },
            { turnIndex: 7, speaker: "ai", text: "That is a clear answer." },
          ],
        }}
        savedReview={null}
      />
    );

    expect(screen.getByRole("button", { name: /see feedback/i })).toBeInTheDocument();
    expect(screen.getByText(/open feedback whenever you are ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/replies unlock feedback/i)).not.toBeInTheDocument();
  });

  it("does not count rejected voice turns toward feedback unlocks", () => {
    render(
      <LearnSpeakingMission
        {...buildMissionProps()}
        plan="pro"
        voiceEnabled
        progressStatus="unlocked"
        initialSession={{
          id: "session-3",
          status: "active",
          interactionMode: "voice",
          retryOfSessionId: null,
          turns: [
            { turnIndex: 1, speaker: "ai", text: "What is your opinion?" },
            {
              turnIndex: 2,
              speaker: "student",
              text: "Thank you.",
              countsTowardProgress: false,
              coaching: {
                label: "Answer the question",
                note: "Answer the question itself first, then add one detail.",
                signals: {
                  fluencyIssue: false,
                  grammarIssue: false,
                  vocabOpportunity: false,
                },
              },
            },
            { turnIndex: 3, speaker: "ai", text: "What do you think, and why?" },
            { turnIndex: 4, speaker: "student", text: "I think uniforms can help." },
            { turnIndex: 5, speaker: "ai", text: "Why do you think that?" },
            { turnIndex: 6, speaker: "student", text: "Because they reduce pressure." },
            { turnIndex: 7, speaker: "ai", text: "Can you add one example?" },
          ],
        }}
        savedReview={null}
      />
    );

    expect(screen.queryByRole("button", { name: /see feedback/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/one more thought/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/answer the question itself first, then add one detail/i)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeakSessionPanel } from "@/features/speak/speak-session-panel";

const mission = {
  scenarioTitle: "Office hours: photosynthesis",
  scenarioSetup:
    "You are meeting your teacher during office hours to talk about photosynthesis.",
  counterpartRole: "teacher",
  canDoStatement: "I can explain a class problem clearly and ask one follow-up question.",
  performanceTask:
    "State the problem, give one detail from class, and respond naturally to the teacher's next question.",
  targetPhrases: ["I think...", "Could you explain that part again?"],
  recommendationReason:
    "Your latest report points to grammar as the next focus, and photosynthesis gives you a real topic to practice right now.",
  openingPrompt:
    "Hi, I'm your teacher for office hours today. What part of photosynthesis feels hardest right now?",
  activeTopic: "photosynthesis",
};

describe("SpeakSessionPanel", () => {
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

  it("starts with a mission brief before the first learner turn", async () => {
    const user = userEvent.setup();

    render(
      <SpeakSessionPanel
        sessionId="session-1"
        mission={mission}
        interactionMode="text"
        status="active"
        initialTurns={[
          {
            turnIndex: 1,
            speaker: "ai",
            text: "Hi, I'm your teacher for office hours today. What part of photosynthesis feels hardest right now?",
            coaching: null,
          },
        ]}
        initialReview={null}
      />
    );

    expect(screen.getByText(/mission brief/i)).toBeInTheDocument();
    expect(screen.getByText(/why now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /begin conversation/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /begin conversation/i }));

    expect(screen.getByText(/what part of photosynthesis feels hardest right now/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write your next answer/i)).toBeInTheDocument();
  });

  it("shows one contextual help prompt without sending a turn", async () => {
    const user = userEvent.setup();

    render(
      <SpeakSessionPanel
        sessionId="session-2"
        mission={mission}
        interactionMode="text"
        status="active"
        initialTurns={[
          {
            turnIndex: 1,
            speaker: "ai",
            text: "Why does photosynthesis matter in this lesson?",
            coaching: null,
          },
          {
            turnIndex: 2,
            speaker: "student",
            text: "It is important.",
            coaching: {
              label: "Add one more detail",
              note: "Add one more clear detail so the answer feels complete.",
              signals: {
                fluencyIssue: true,
                grammarIssue: false,
                vocabOpportunity: false,
              },
            },
          },
        ]}
        initialReview={null}
      />
    );

    expect(screen.queryByText(/Answer with one reason first/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /help me/i }));

    expect(screen.getByText(/Answer with one reason first/i)).toBeInTheDocument();
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url]) => typeof url === "string" && url.includes("/api/v1/speak/session/turn")
      )
    ).toBe(false);
  });

  it("switches completed sessions into review mode without live controls", () => {
    render(
      <SpeakSessionPanel
        sessionId="session-3"
        mission={mission}
        interactionMode="text"
        status="completed"
        initialTurns={[
          {
            turnIndex: 1,
            speaker: "ai",
            text: "Tell me one thing you understood about photosynthesis.",
            coaching: null,
          },
          {
            turnIndex: 2,
            speaker: "student",
            text: "I think plants use light to make food.",
            coaching: {
              label: "Keep this move",
              note: "Clear answer. Keep using direct statements first.",
              signals: {
                fluencyIssue: false,
                grammarIssue: false,
                vocabOpportunity: false,
              },
            },
          },
        ]}
        initialReview={{
          status: "almost_there",
          strength: "You answered directly and stayed on topic.",
          improvement: "Add one more supporting detail to make each answer feel complete.",
          highlights: [
            {
              turnIndex: 2,
              youSaid: "I think plants use light to make food.",
              tryInstead: "I think plants use sunlight to make their own food.",
              why: "Adding one concrete noun makes the idea sound more complete.",
            },
          ],
          turns: [
            {
              turnIndex: 1,
              speaker: "ai",
              text: "Tell me one thing you understood about photosynthesis.",
              inlineCorrections: [],
            },
            {
              turnIndex: 2,
              speaker: "student",
              text: "I think plants use light to make food.",
              inlineCorrections: [
                {
                  span: "light",
                  suggestion: "sunlight",
                  reason: "More precise word choice.",
                },
              ],
            },
          ],
          vocabulary: [
            {
              term: "I think",
              definition: "A natural way to share an opinion clearly.",
              translation: "I think",
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByText(/what to keep and what to refine/i)).toBeInTheDocument();
    expect(screen.getByText(/keep these phrases for next time/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /help me/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish session/i })).not.toBeInTheDocument();
  });
});

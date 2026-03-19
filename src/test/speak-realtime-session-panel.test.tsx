import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeakRealtimeSessionPanel } from "@/features/speak/speak-realtime-session-panel";

const mission = {
  scenarioTitle: "Class discussion: introductions",
  scenarioSetup: "You are having a short class discussion with your teacher.",
  counterpartRole: "teacher",
  canDoStatement: "I can answer a class question clearly and keep the conversation moving.",
  performanceTask: "Answer naturally and add one follow-up detail.",
  targetPhrases: ["I think...", "For example..."],
  recommendationReason: "This matches your current class topic and keeps speaking momentum high.",
  openingPrompt: "Tell me one thing people should know about you.",
  activeTopic: "introductions",
};

describe("SpeakRealtimeSessionPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("switches from live session chrome to review mode after finishing", async () => {
    const user = userEvent.setup();

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studentCoachings: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ready",
          strength: "You answered directly and kept the conversation moving.",
          improvement: "Add one more detail after each first answer.",
          highlights: [
            {
              turnIndex: 2,
              youSaid: "My name is Chris.",
              tryInstead: "My name is Chris, and I enjoy meeting new people.",
              why: "Adding one personal detail makes the introduction sound more natural.",
            },
          ],
          turns: [
            {
              turnIndex: 1,
              speaker: "ai",
              text: "Tell me one thing people should know about you.",
              inlineCorrections: [],
            },
            {
              turnIndex: 2,
              speaker: "student",
              text: "My name is Chris.",
              inlineCorrections: [],
            },
          ],
          vocabulary: [
            {
              term: "My name is",
              definition: "A clear way to introduce yourself.",
              translation: "My name is",
            },
          ],
        }),
      });

    render(
      <SpeakRealtimeSessionPanel
        sessionId="live-session-1"
        mission={mission}
        initialTurns={[
          {
            turnIndex: 1,
            speaker: "ai",
            text: "Tell me one thing people should know about you.",
            coaching: null,
          },
          {
            turnIndex: 2,
            speaker: "student",
            text: "My name is Chris.",
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
      />
    );

    expect(screen.getByRole("button", { name: /help me/i })).toBeInTheDocument();
    expect(screen.getByText(/student turns recorded/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /finish session/i }));

    await waitFor(() => {
      expect(screen.getByText(/what to keep and what to refine/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /help me/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish session/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/student turns recorded/i)).not.toBeInTheDocument();
    expect(screen.getByText(/keep these phrases for next time/i)).toBeInTheDocument();
  });
});

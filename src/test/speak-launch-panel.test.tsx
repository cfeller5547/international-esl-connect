import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeakLaunchPanel } from "@/features/speak/speak-launch-panel";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

const starters = [
  {
    key: "today",
    label: "Something from today",
    prompt: "Start with something that happened today.",
    hint: "Anything from class or daily life is a good place to start.",
  },
  {
    key: "learning",
    label: "Something I'm learning",
    prompt: "Talk about something you are learning in class.",
    hint: "Use cell division or another class idea that feels current.",
  },
  {
    key: "say_better",
    label: "Something I want to say better",
    prompt: "Pick one idea you want to explain more clearly.",
    hint: "A good fit if you want to sound clearer in speaking.",
  },
  {
    key: "surprise_me",
    label: "Surprise me",
    prompt: "Let the AI choose a good topic from your context.",
    hint: "We will choose a natural topic from your level and recent context.",
  },
] as const;

describe("SpeakLaunchPanel", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "speak-session-1" }),
    }));
  });

  it("shows explicit mode switches and starts free speech from the selected lane", async () => {
    const user = userEvent.setup();

    render(
      <SpeakLaunchPanel
        recommendation={{
          mode: "free_speech",
          starterKey: "learning",
          starterLabel: "Something I'm learning",
          scenarioKey: null,
          recommendedInteractionMode: "text",
          title: "Pick a topic and start talking",
          description: "Start from class or daily life and let the conversation move naturally.",
          speakingGoal: null,
          whyNow: null,
          mission: {
            scenarioTitle: "Something I'm learning",
            scenarioSetup: "Have an open conversation about something the learner is studying.",
            counterpartRole: null,
            canDoStatement: null,
            performanceTask: null,
            openingQuestion: "What are you learning right now?",
            introductionText: null,
            targetPhrases: ["I'm learning...", "One part that stands out is..."],
            followUpPrompts: ["Ask what part feels easiest right now."],
            successCriteria: ["Keep the conversation moving with clear, connected answers."],
            starterPrompt: "Talk about something you are learning right now.",
            recommendationReason:
              "Cell division gives you a real topic to practice instead of a generic prompt.",
            activeTopic: "cell division",
            focusSkill: null,
            learnerLevel: "intermediate",
            contextHint: "Use cell division or another class idea that feels current.",
            starterKey: "learning",
            starterLabel: "Something I'm learning",
          },
        }}
        starters={[...starters]}
        guidedScenarios={[
          {
            key: "class_discussion",
            title: "Class discussion",
            description: "Practice answering a teacher's follow-up questions.",
          },
        ]}
        voiceConfigured
        plan="free"
      />
    );

    expect(screen.getByText(/choose how you want to practice/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /free speech/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /guided scenario/i }).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/^Free speech$/i, {
        selector: "h2",
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/class discussion/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /something i'm learning/i }));
    await user.click(screen.getByRole("button", { name: /start free speech/i }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/speak/session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "free_speech",
          interactionMode: "text",
          starterKey: "learning",
          scenarioKey: null,
        }),
      })
    );
    expect(push).toHaveBeenCalledWith("/app/speak/session/speak-session-1");
  });

  it("shows only guided content when guided mode is selected", async () => {
    const user = userEvent.setup();

    render(
      <SpeakLaunchPanel
        recommendation={{
          mode: "free_speech",
          starterKey: "today",
          starterLabel: "Something from today",
          scenarioKey: null,
          recommendedInteractionMode: "text",
          title: "Pick a topic and start talking",
          description: "Start from class or daily life and let the conversation move naturally.",
          speakingGoal: null,
          whyNow: null,
          mission: {
            scenarioTitle: "Something from today",
            scenarioSetup: "Have an open conversation about something from today.",
            counterpartRole: null,
            canDoStatement: null,
            performanceTask: null,
            openingQuestion: "What happened today?",
            introductionText: null,
            targetPhrases: ["Today I...", "One thing that happened was..."],
            followUpPrompts: ["Ask what stood out most from today."],
            successCriteria: ["Keep the conversation moving with clear, connected answers."],
            starterPrompt: "Talk about something from today.",
            recommendationReason: "Start from a real moment from today.",
            activeTopic: null,
            focusSkill: null,
            learnerLevel: "intermediate",
            contextHint: "Anything from class or daily life is a good place to start.",
            starterKey: "today",
            starterLabel: "Something from today",
          },
        }}
        starters={[...starters]}
        guidedScenarios={[
          {
            key: "class_discussion",
            title: "Class discussion",
            description: "Practice answering a teacher's follow-up questions.",
          },
          {
            key: "office_hours",
            title: "Office hours",
            description: "Ask for help and clarify something from class.",
          },
        ]}
        voiceConfigured
        plan="pro"
      />
    );

    await user.click(screen.getByRole("button", { name: /guided scenario/i }));

    expect(screen.getByRole("button", { name: /start guided scenario/i })).toBeInTheDocument();
    expect(
      screen.getByText(/^Guided scenario$/i, {
        selector: "h2",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Class discussion$/i, {
        selector: "button p",
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/something i want to say better/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start guided scenario/i })).toBeInTheDocument();
  });
});

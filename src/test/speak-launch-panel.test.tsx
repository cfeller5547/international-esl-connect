import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeakLaunchPanel } from "@/features/speak/speak-launch-panel";
import { buildSpeakLaunchViewModel } from "@/features/speak/speak-view-model";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

describe("SpeakLaunchPanel", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "speak-session-1" }),
    }));
  });

  it("renders missions and free speech and can start a mission", async () => {
    const user = userEvent.setup();
    const viewModel = buildSpeakLaunchViewModel({
      currentLevel: "intermediate",
      weakestSkill: "grammar",
      activeTopics: ["photosynthesis"],
      currentLearnTitle: null,
      plan: "pro",
    });

    render(
      <SpeakLaunchPanel
        viewModel={viewModel}
        voiceConfigured
        plan="pro"
      />
    );

    expect(screen.getByText(/Speaking Confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Streak/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Start/i)[0]).toBeInTheDocument();

    const startButtons = screen.getAllByRole("button", { name: /Start/i });
    await user.click(startButtons[0]);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/speak/session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "mission",
          id: viewModel.missions[0].id,
          interactionMode: "voice",
        }),
      })
    );
    expect(push).toHaveBeenCalledWith("/app/speak/session/speak-session-1");
  });

  it("can switch to free speech and start a session", async () => {
    const user = userEvent.setup();
    const viewModel = buildSpeakLaunchViewModel({
      currentLevel: "intermediate",
      weakestSkill: "grammar",
      activeTopics: ["photosynthesis"],
      currentLearnTitle: null,
      plan: "pro",
    });

    render(
      <SpeakLaunchPanel
        viewModel={viewModel}
        voiceConfigured
        plan="pro"
      />
    );

    const freeSpeechTab = screen.getByRole("button", { name: /Free Speech/i });
    await user.click(freeSpeechTab);

    expect(screen.getByText(/Open Conversation/i)).toBeInTheDocument();
    
    const startButton = screen.getByRole("button", { name: /Start Free Speech/i });
    await user.click(startButton);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/speak/session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "free_speech",
          id: null,
          interactionMode: "voice",
        }),
      })
    );
  });

  it("falls back to text mode for free tier", async () => {
    const user = userEvent.setup();
    const viewModel = buildSpeakLaunchViewModel({
      currentLevel: "intermediate",
      weakestSkill: "grammar",
      activeTopics: ["photosynthesis"],
      currentLearnTitle: null,
      plan: "free",
    });

    render(
      <SpeakLaunchPanel
        viewModel={viewModel}
        voiceConfigured
        plan="free"
      />
    );

    const freeSpeechTab = screen.getByRole("button", { name: /Free Speech/i });
    await user.click(freeSpeechTab);

    const startButton = screen.getByRole("button", { name: /Start Free Speech/i });
    await user.click(startButton);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/speak/session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "free_speech",
          id: null,
          interactionMode: "text",
        }),
      })
    );
  });
});

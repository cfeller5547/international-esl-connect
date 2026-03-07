import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonPlayer } from "@/features/learn/lesson-player";

describe("LessonPlayer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows one lesson overview before moving into one check at a time", async () => {
    const user = userEvent.setup();

    render(
      <LessonPlayer
        lessonId="lesson-1"
        unitTitle="Tell Stories Clearly"
        sections={[
          {
            title: "Discover the scenario",
            body: "Read the first scenario carefully.",
          },
          {
            title: "Learn the language moves",
            body: "Notice how the story is sequenced.",
          },
        ]}
        checks={[
          {
            prompt: "Which option best matches the lesson goal?",
            options: ["The best answer", "The wrong answer"],
            correctIndex: 0,
          },
        ]}
      />
    );

    expect(screen.getByText("Discover the scenario")).toBeInTheDocument();
    expect(screen.getByText("Learn the language moves")).toBeInTheDocument();
    expect(screen.queryByText("Which option best matches the lesson goal?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start quick check/i }));

    expect(screen.queryByText("Discover the scenario")).not.toBeInTheDocument();
    expect(screen.queryByText("Learn the language moves")).not.toBeInTheDocument();
    expect(screen.getByText("Which option best matches the lesson goal?")).toBeInTheDocument();
    expect(screen.queryByText("Read the first scenario carefully.")).not.toBeInTheDocument();
  });
});

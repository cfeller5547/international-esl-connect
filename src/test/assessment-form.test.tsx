import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentForm } from "@/features/assessment/assessment-form";

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
}));

const questions = [
  {
    id: "q1",
    skill: "reading" as const,
    prompt: "Choose the sentence with correct past tense.",
    options: ["She go to class.", "She went to class."],
    correctValue: "1",
  },
];

const prompts = ["Tell me one thing you studied this week."];

function renderAssessmentForm() {
  return render(
    <AssessmentForm
      storageKey="assessment-form-test"
      assessmentAttemptId="attempt-1"
      endpoint="/api/v1/onboarding/session/assessment/complete"
      questions={questions}
      prompts={prompts}
      title="Quick baseline assessment"
      description="Complete the short baseline before signup."
      submitLabel="Finish quick baseline"
      backHref="/onboarding/profile"
    />
  );
}

describe("AssessmentForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows one step at a time and only reveals the conversation step after the objective answer", async () => {
    const user = userEvent.setup();

    renderAssessmentForm();

    expect(screen.getAllByText("Choose the sentence with correct past tense.")).toHaveLength(2);
    expect(screen.queryByText("Tell me one thing you studied this week.")).not.toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: /continue to conversation/i });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByText("She went to class."));

    expect(continueButton).toBeEnabled();

    await user.click(continueButton);

    expect(screen.getByText("Tell me one thing you studied this week.")).toBeInTheDocument();
    expect(screen.queryAllByText("Choose the sentence with correct past tense.")).toHaveLength(0);
  });

  it("submits the expected payload after the guided steps are completed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        redirectTo: "/onboarding/results",
      }),
    } as Response);

    renderAssessmentForm();

    await user.click(screen.getByText("She went to class."));
    await user.click(screen.getByRole("button", { name: /continue to conversation/i }));
    await user.type(
      screen.getByLabelText("Your response"),
      "I studied past tense and practiced with homework."
    );

    await user.click(screen.getByRole("button", { name: "Finish quick baseline" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      assessmentAttemptId: "attempt-1",
      payload: {
        objectiveAnswers: [
          {
            questionId: "q1",
            value: "1",
            correctValue: "1",
            skill: "reading",
          },
        ],
        conversationTurns: [
          {
            prompt: "Tell me one thing you studied this week.",
            answer: "I studied past tense and practiced with homework.",
          },
        ],
      },
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/onboarding/results");
    });
  });
});

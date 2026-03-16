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

const startLiveConversationMock = vi.fn();
const pauseLiveConversationMock = vi.fn();
let liveVoiceSupported = true;
let liveVoiceActive = false;
let liveVoiceState: "idle" | "starting" | "listening" | "thinking" | "speaking" | "error" =
  "idle";

vi.mock("@/features/assessment/use-assessment-live-voice", () => ({
  useAssessmentLiveVoice: () => ({
    isSupported: liveVoiceSupported,
    liveActive: liveVoiceActive,
    voiceState: liveVoiceState,
    startLiveConversation: startLiveConversationMock,
    pauseLiveConversation: pauseLiveConversationMock,
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

const conversationExperience = {
  scenarioTitle: "Diagnostic conversation",
  scenarioSetup: "You are talking with a placement coach about your classes.",
  counterpartRole: "placement_coach",
  introductionText: "Hi, I'm Maya.",
  openingQuestion: "What's your name, and what class are you taking right now?",
  openingTurn:
    "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
  helpfulPhrases: ["I'm taking...", "In that class, we usually..."],
  modelExample: "I'm Ana, and I'm taking biology.",
  responseTarget: 2,
  realtimeEndpoint: "/api/v1/onboarding/session/assessment/conversation/realtime",
  requireVoice: true,
} as const;

function renderAssessmentForm() {
  return render(
    <AssessmentForm
      storageKey="assessment-form-test"
      assessmentAttemptId="attempt-1"
      endpoint="/api/v1/onboarding/session/assessment/complete"
      questions={questions}
      prompts={[]}
      title="Full diagnostic assessment"
      description="Complete the full diagnostic before signup."
      submitLabel="Continue to signup"
      backHref="/onboarding/profile"
      conversationExperience={conversationExperience}
    />
  );
}

function renderAssessmentFormWithInitialState() {
  return render(
    <AssessmentForm
      storageKey="assessment-form-prefill-test"
      assessmentAttemptId="attempt-2"
      endpoint="/api/v1/assessment/full/complete"
      questions={questions}
      prompts={[]}
      title="Full diagnostic"
      description="Expand the baseline with more objective items."
      submitLabel="Complete full diagnostic"
        initialState={{
          answers: {
            q1: "1",
        },
        conversation: {},
        writingSample: "",
      }}
      introNote="We carried over your completed baseline questions."
      conversationExperience={{
        ...conversationExperience,
        realtimeEndpoint: "/api/v1/assessment/full/conversation/realtime",
      }}
    />
  );
}

describe("AssessmentForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    startLiveConversationMock.mockReset();
    pauseLiveConversationMock.mockReset();
    liveVoiceSupported = true;
    liveVoiceActive = false;
    liveVoiceState = "idle";
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows one step at a time and reveals the AI conversation after the objective answer", async () => {
    const user = userEvent.setup();

    renderAssessmentForm();

    expect(screen.getAllByText("Choose the sentence with correct past tense.")).toHaveLength(2);
    expect(screen.queryByText("Diagnostic conversation")).not.toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: /continue to conversation/i });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByText("She went to class."));
    expect(continueButton).toBeEnabled();

    await user.click(continueButton);

    expect(screen.getByText("Diagnostic conversation")).toBeInTheDocument();
    expect(
      screen.getByText("Maya will greet you first once the live interview starts.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start live conversation/i })
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your reply here/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
  });

  it("submits paired conversation turns after the live AI interview is completed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        redirectTo: "/signup",
      }),
    } as Response);

    render(
      <AssessmentForm
        storageKey="assessment-form-submit-test"
        assessmentAttemptId="attempt-submit"
        endpoint="/api/v1/onboarding/session/assessment/complete"
        questions={questions}
        prompts={[]}
        title="Full diagnostic assessment"
        description="Complete the full diagnostic before signup."
        submitLabel="Continue to signup"
        conversationExperience={conversationExperience}
        initialState={{
          answers: { q1: "1" },
          conversation: {},
          writingSample: "",
          conversationDurationSeconds: 18,
          conversationTranscript: [
            {
              speaker: "ai",
              text: "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
            },
            {
              speaker: "student",
              text: "Hi, I'm Ana, and I'm taking biology.",
              countsTowardProgress: true,
            },
            {
              speaker: "ai",
              text: "Nice to meet you, Ana. What do you usually do in that class?",
            },
            {
              speaker: "student",
              text: "We read short texts and talk about them in groups.",
              countsTowardProgress: true,
            },
            {
              speaker: "ai",
              text: "Thanks. That gives me a clear picture of how you use English right now.",
            },
          ],
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /continue to signup/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, submitInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(submitInit?.body));

    expect(body).toMatchObject({
      assessmentAttemptId: "attempt-submit",
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
            prompt:
              "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
            answer: "Hi, I'm Ana, and I'm taking biology.",
          },
          {
            prompt: "Nice to meet you, Ana. What do you usually do in that class?",
            answer: "We read short texts and talk about them in groups.",
          },
        ],
      },
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/signup");
    });
  }, 10000);

  it("starts from seeded progress instead of repeating imported answers", () => {
    renderAssessmentFormWithInitialState();

    expect(screen.getByText("We carried over your completed baseline questions.")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic conversation")).toBeInTheDocument();
    expect(screen.queryAllByText("Choose the sentence with correct past tense.")).toHaveLength(0);
  });

  it("does not advance the captured reply count when the learner only asks for clarification", async () => {
    render(
      <AssessmentForm
        storageKey="assessment-form-clarification-test"
        assessmentAttemptId="attempt-clarification"
        endpoint="/api/v1/onboarding/session/assessment/complete"
        questions={[]}
        prompts={[]}
        title="Full diagnostic assessment"
        description="Complete the full diagnostic before signup."
        submitLabel="Continue to signup"
        conversationExperience={conversationExperience}
        initialState={{
          answers: {},
          conversation: {},
          writingSample: "",
          conversationTranscript: [
            {
              speaker: "ai",
              text:
                "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
            },
            {
              speaker: "student",
              text: "why",
              countsTowardProgress: false,
            },
            {
              speaker: "ai",
              text:
                "I mean, which part of class do you like best, for example labs, reading, or discussion?",
            },
          ],
        }}
      />
    );

    expect(
      screen.getByText(
      "I mean, which part of class do you like best, for example labs, reading, or discussion?"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("0/2 captured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to signup/i })).toBeDisabled();
  });
});

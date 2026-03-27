"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  PencilLine,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HomeworkConfidenceState, HomeworkContentShape } from "@/lib/homework-help";

type HomeworkUploadPanelProps = {
  recentSessions: Array<{
    id: string;
    createdAt: string;
    status: string;
    assignmentTitle: string;
  }>;
};

type UploadPreviewQuestion = {
  index: number;
  promptText: string;
  questionType: string;
  focusSkill?: string;
};

type UploadPreview = {
  homeworkUploadId: string;
  status: string;
  detectedQuestionCount: number;
  parseConfidence: number | null;
  requiresReview: boolean;
  confidenceState: HomeworkConfidenceState;
  contentShape: HomeworkContentShape | null;
  errorCode?: string | null;
  assignmentTitle?: string | null;
  assignmentSummary?: string | null;
  subject?: string | null;
  difficultyLevel?: string | null;
  reviewNotes?: string[];
  extractionNotes?: string[];
  rawText?: string | null;
  questions?: UploadPreviewQuestion[];
};

type ReviewQuestion = {
  promptText: string;
};

function getStatusMessage(status: string) {
  if (status === "extracting_text") {
    return "Reading the assignment";
  }

  if (status === "segmenting_questions") {
    return "Finding the questions and building the workspace";
  }

  return "Preparing the workspace";
}

function getPreviewCountLabel(
  detectedQuestionCount: number,
  contentShape: HomeworkContentShape | null
) {
  if (detectedQuestionCount === 1 || contentShape === "single_question") {
    return "1 task detected";
  }

  return `${detectedQuestionCount} tasks detected`;
}

function getPreviewWarning(preview: UploadPreview) {
  if (preview.confidenceState !== "warning") {
    return null;
  }

  return (
    preview.reviewNotes?.[0] ??
    "We may have missed part of the structure. Review the detected questions or start anyway if it looks right."
  );
}

function getPrimaryStartLabel(preview: UploadPreview) {
  return preview.confidenceState === "warning"
    ? "Looks good, start anyway"
    : "Start homework help";
}

function getQuestionCardLabel(preview: UploadPreview, question: UploadPreviewQuestion) {
  if (preview.contentShape === "single_question") {
    return "Detected task";
  }

  return `Question ${question.index}`;
}

function createReviewQuestions(preview: UploadPreview | null) {
  return (preview?.questions ?? []).map((question) => ({
    promptText: question.promptText,
  }));
}

export function HomeworkUploadPanel({
  recentSessions,
}: HomeworkUploadPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [parsedUpload, setParsedUpload] = useState<UploadPreview | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorText(null);
    setParsedUpload(null);
    setReviewMode(false);
    setReviewQuestions([]);

    try {
      const formData = new FormData(event.currentTarget);
      const file = formData.get("file");
      const pastedText = String(formData.get("pastedText") ?? "").trim();

      if (!(file instanceof File && file.size > 0) && !pastedText) {
        throw new Error("Add a screenshot, PDF, or pasted homework first.");
      }

      const uploadFormData = new FormData();
      if (file instanceof File && file.size > 0) {
        uploadFormData.append("file", file);
        uploadFormData.append("inputType", file.type.includes("pdf") ? "pdf" : "image");
      } else {
        uploadFormData.append("text", pastedText);
        uploadFormData.append("inputType", "text");
      }

      const uploadResponse = await fetch("/api/v1/learn/homework/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadPayload = (await uploadResponse.json()) as {
        homeworkUploadId?: string;
        status?: string;
        message?: string;
        error?: { message?: string };
      };

      if (!uploadResponse.ok || !uploadPayload.homeworkUploadId) {
        throw new Error(
          uploadPayload.error?.message ??
            uploadPayload.message ??
            "We could not start the homework upload."
        );
      }

      let pollingPayload: UploadPreview = {
        homeworkUploadId: uploadPayload.homeworkUploadId,
        status: uploadPayload.status ?? "extracting_text",
        detectedQuestionCount: 0,
        parseConfidence: null,
        requiresReview: false,
        confidenceState: "warning",
        contentShape: null,
      };

      setStatusText(getStatusMessage(pollingPayload.status));

      while (
        pollingPayload.status === "extracting_text" ||
        pollingPayload.status === "segmenting_questions"
      ) {
        const pollResponse = await fetch(
          `/api/v1/learn/homework/upload/${uploadPayload.homeworkUploadId}`
        );
        const pollPayload = (await pollResponse.json()) as UploadPreview & {
          message?: string;
          error?: { message?: string };
        };

        if (!pollResponse.ok) {
          throw new Error(
            pollPayload.error?.message ??
              pollPayload.message ??
              "We could not finish preparing the homework workspace."
          );
        }

        pollingPayload = pollPayload;

        if (
          pollingPayload.status === "extracting_text" ||
          pollingPayload.status === "segmenting_questions"
        ) {
          setStatusText(getStatusMessage(pollingPayload.status));
          await new Promise((resolve) => window.setTimeout(resolve, 900));
        }
      }

      setStatusText(null);

      if (pollingPayload.status === "failed") {
        throw new Error(
          pollingPayload.errorCode === "HOMEWORK_PARSE_UNREADABLE"
            ? "We could not read enough of that homework. Try a clearer screenshot, another PDF, or paste the text."
            : "We could not turn that homework into a usable question map yet. Try a clearer upload or paste the text."
        );
      }

      setParsedUpload(pollingPayload);
      setReviewQuestions(createReviewQuestions(pollingPayload));
    } catch (error) {
      setStatusText(null);
      setErrorText(
        error instanceof Error ? error.message : "We could not process that homework."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleStartSession(previewOverride?: UploadPreview) {
    const activePreview = previewOverride ?? parsedUpload;

    if (!activePreview) {
      return;
    }

    setStartingSession(true);
    setErrorText(null);

    try {
      const sessionResponse = await fetch("/api/v1/learn/homework/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          homeworkUploadId: activePreview.homeworkUploadId,
        }),
      });
      const sessionPayload = (await sessionResponse.json()) as {
        sessionId?: string;
        message?: string;
        error?: { message?: string };
      };

      if (!sessionResponse.ok || !sessionPayload.sessionId) {
        throw new Error(
          sessionPayload.error?.message ??
            sessionPayload.message ??
            "We could not start Homework Help."
        );
      }

      router.push(`/app/tools/homework/session/${sessionPayload.sessionId}`);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "We could not start Homework Help."
      );
      setStartingSession(false);
    }
  }

  async function handleSaveReview(startAfterSave: boolean) {
    if (!parsedUpload) {
      return;
    }

    setSavingReview(true);
    setErrorText(null);

    try {
      const response = await fetch(
        `/api/v1/learn/homework/upload/${parsedUpload.homeworkUploadId}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questions: reviewQuestions
              .map((question) => ({
                promptText: question.promptText.trim(),
              }))
              .filter((question) => question.promptText.length > 0),
          }),
        }
      );
      const payload = (await response.json()) as UploadPreview & {
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            payload.message ??
            "We could not save those question edits."
        );
      }

      setParsedUpload(payload);
      setReviewQuestions(createReviewQuestions(payload));
      setReviewMode(false);

      if (startAfterSave) {
        await handleStartSession(payload);
      }
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "We could not save the question edits."
      );
    } finally {
      setSavingReview(false);
    }
  }

  function updateReviewQuestion(index: number, promptText: string) {
    setReviewQuestions((value) =>
      value.map((question, questionIndex) =>
        questionIndex === index ? { ...question, promptText } : question
      )
    );
  }

  function deleteReviewQuestion(index: number) {
    setReviewQuestions((value) => value.filter((_, questionIndex) => questionIndex !== index));
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
            Homework Help
          </p>
          <CardTitle className="text-2xl leading-tight sm:text-3xl">
            Bring in any homework and work through it calmly
          </CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Paste one question, upload a worksheet, drop in a screenshot, or send a PDF.
            We will read it, map the work, and guide you through the next best step.
          </p>
        </CardHeader>
      </Card>

      {parsedUpload ? (
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                  Preview
                </p>
                <CardTitle className="text-2xl">
                  {parsedUpload.assignmentTitle ?? "Homework workspace"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getPreviewCountLabel(
                    parsedUpload.detectedQuestionCount,
                    parsedUpload.contentShape
                  )}
                  {parsedUpload.subject ? ` in ${parsedUpload.subject}` : ""}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  parsedUpload.confidenceState === "warning"
                    ? "bg-amber-500/12 text-amber-700"
                    : "bg-emerald-500/12 text-emerald-700"
                }`}
              >
                {parsedUpload.confidenceState === "warning" ? "Review suggested" : "Ready"}
              </span>
            </div>

            {parsedUpload.assignmentSummary ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {parsedUpload.assignmentSummary}
              </p>
            ) : null}

            {getPreviewWarning(parsedUpload) ? (
              <div className="flex items-start gap-3 rounded-[1.15rem] border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-800 sm:rounded-3xl">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{getPreviewWarning(parsedUpload)}</span>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-4">
            {reviewMode ? (
              <div className="space-y-3">
                {reviewQuestions.map((question, index) => (
                  <div
                    key={`review-question-${index}`}
                    className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                        {parsedUpload.contentShape === "single_question"
                          ? "Detected task"
                          : `Question ${index + 1}`}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-muted-foreground"
                        onClick={() => deleteReviewQuestion(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={question.promptText}
                      onChange={(event) =>
                        updateReviewQuestion(index, event.target.value)
                      }
                      rows={3}
                      className="mt-3"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
                  parsedUpload.detectedQuestionCount > 1 ? "lg:grid-cols-2" : ""
                }`}
              >
                {(parsedUpload.questions ?? []).map((question) => (
                  <div
                    key={`${question.index}-${question.promptText}`}
                    className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                      {getQuestionCardLabel(parsedUpload, question)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {question.promptText}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {reviewMode ? (
                <>
                  <Button
                    size="lg"
                    className="w-full sm:min-w-56 sm:w-auto"
                    onClick={() => handleSaveReview(true)}
                    disabled={savingReview}
                  >
                    {savingReview ? "Saving review..." : "Save review and start"}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleSaveReview(false)}
                    disabled={savingReview}
                  >
                    Save review
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setReviewMode(false);
                      setReviewQuestions(createReviewQuestions(parsedUpload));
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full sm:min-w-56 sm:w-auto"
                    onClick={() => handleStartSession()}
                    disabled={startingSession}
                  >
                    {startingSession
                      ? "Starting..."
                      : getPrimaryStartLabel(parsedUpload)}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setReviewMode(true)}
                  >
                    <PencilLine className="size-4" />
                    Review questions
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setParsedUpload(null);
                      setReviewMode(false);
                      setReviewQuestions([]);
                    }}
                  >
                    Upload something else
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-2xl">Add homework</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-muted/20 p-4 sm:rounded-3xl sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-background p-2 text-secondary shadow-sm">
                    <Upload className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      Screenshot, photo, or PDF
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Clear crops and text PDFs work best.
                    </p>
                  </div>
                </div>
                <Input name="file" type="file" accept=".pdf,image/*" className="mt-4" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Or paste the text</p>
                <Textarea
                  name="pastedText"
                  rows={6}
                  placeholder="Paste one question, a worksheet, or a full assignment here."
                />
              </div>

              {statusText ? (
                <div className="flex items-center gap-3 rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:rounded-3xl">
                  <LoaderCircle className="size-4 animate-spin text-secondary" />
                  <span>{statusText}</span>
                </div>
              ) : null}

              {errorText ? (
                <div className="rounded-[1.2rem] border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive sm:rounded-3xl">
                  {errorText}
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? "Preparing workspace..." : "Open Homework Help"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {recentSessions.length > 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Pick up where you left off</CardTitle>
              <p className="text-sm text-muted-foreground">
                Recent Homework Help sessions stay ready to resume.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => router.push(`/app/tools/homework/session/${session.id}`)}
                  className="w-full rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-4 text-left transition hover:border-border hover:bg-muted/30 sm:rounded-3xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        {session.assignmentTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {session.status === "completed" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Sparkles className="size-4 text-secondary" />
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

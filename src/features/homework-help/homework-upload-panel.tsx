"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type HomeworkUploadPanelProps = {
  recentSessions: Array<{
    id: string;
    createdAt: string;
    status: string;
    assignmentTitle: string;
  }>;
};

type UploadPreview = {
  homeworkUploadId: string;
  status: string;
  detectedQuestionCount: number;
  parseConfidence: number | null;
  requiresReview: boolean;
  errorCode?: string | null;
  assignmentTitle?: string | null;
  assignmentSummary?: string | null;
  subject?: string | null;
  difficultyLevel?: string | null;
  reviewNotes?: string[];
  extractionNotes?: string[];
  rawText?: string | null;
  questions?: Array<{
    index: number;
    promptText: string;
    questionType: string;
    focusSkill?: string;
  }>;
};

function getStatusMessage(status: string) {
  if (status === "extracting_text") {
    return "Reading your assignment";
  }

  if (status === "segmenting_questions") {
    return "Building your guided question map";
  }

  return null;
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorText(null);
    setParsedUpload(null);

    try {
      const formData = new FormData(event.currentTarget);
      const file = formData.get("file");
      const pastedText = String(formData.get("pastedText") ?? "").trim();

      if (!(file instanceof File && file.size > 0) && !pastedText) {
        throw new Error("Add a screenshot, PDF, or pasted assignment text first.");
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
      };

      if (!uploadResponse.ok || !uploadPayload.homeworkUploadId) {
        throw new Error(uploadPayload.message ?? "We could not start the assignment upload.");
      }

      let pollingPayload: UploadPreview = {
        homeworkUploadId: uploadPayload.homeworkUploadId,
        status: uploadPayload.status ?? "failed",
        detectedQuestionCount: 0,
        parseConfidence: null,
        requiresReview: false,
      };

      while (
        pollingPayload.status === "extracting_text" ||
        pollingPayload.status === "segmenting_questions"
      ) {
        setStatusText(getStatusMessage(pollingPayload.status));
        await new Promise((resolve) => window.setTimeout(resolve, 900));

        const pollResponse = await fetch(
          `/api/v1/learn/homework/upload/${uploadPayload.homeworkUploadId}`
        );
        const pollPayload = (await pollResponse.json()) as UploadPreview & {
          message?: string;
        };

        if (!pollResponse.ok) {
          throw new Error(pollPayload.message ?? "We could not finish parsing the upload.");
        }

        pollingPayload = pollPayload;
      }

      setStatusText(null);

      if (pollingPayload.status === "failed") {
        throw new Error(
          pollingPayload.errorCode === "HOMEWORK_PARSE_UNREADABLE"
            ? "We could not read enough of that assignment. Try a clearer screenshot, another PDF, or paste the text."
            : "We could not break that assignment into guided questions yet. Try a cleaner upload or paste the text."
        );
      }

      setParsedUpload(pollingPayload);
    } catch (error) {
      setStatusText(null);
      setErrorText(
        error instanceof Error ? error.message : "We could not process that assignment."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleStartSession() {
    if (!parsedUpload) {
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
          homeworkUploadId: parsedUpload.homeworkUploadId,
        }),
      });
      const sessionPayload = (await sessionResponse.json()) as {
        sessionId?: string;
        message?: string;
      };

      if (!sessionResponse.ok || !sessionPayload.sessionId) {
        throw new Error(sessionPayload.message ?? "We could not start the guided session.");
      }

      router.push(`/app/tools/homework/session/${sessionPayload.sessionId}`);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "We could not start the guided session."
      );
      setStartingSession(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
            Homework Help
          </p>
          <CardTitle className="text-2xl leading-tight sm:text-3xl">Upload an assignment, get guided through it</CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            We read the assignment, split it into questions, and coach you through each one.
          </p>
        </CardHeader>
      </Card>

      {parsedUpload ? (
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {parsedUpload.assignmentTitle ?? "Homework assignment"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {parsedUpload.detectedQuestionCount} question{parsedUpload.detectedQuestionCount === 1 ? "" : "s"} detected
                  {parsedUpload.subject ? ` in ${parsedUpload.subject}` : ""}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  parsedUpload.requiresReview
                    ? "bg-amber-500/12 text-amber-700"
                    : "bg-emerald-500/12 text-emerald-700"
                }`}
              >
                {parsedUpload.requiresReview ? "Review suggested" : "Ready"}
              </span>
            </div>

            {parsedUpload.reviewNotes && parsedUpload.reviewNotes.length > 0 ? (
              <p className="text-sm text-amber-700">
                {parsedUpload.reviewNotes[0]}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {(parsedUpload.questions ?? []).slice(0, 4).map((question) => (
                <div
                  key={`${question.index}-${question.promptText}`}
                  className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    Question {question.index}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {question.promptText}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:min-w-56 sm:w-auto"
                onClick={handleStartSession}
                disabled={startingSession}
              >
                {startingSession ? "Starting session..." : "Start guided session"}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setParsedUpload(null)}
              >
                Upload something else
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-2xl">Upload assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-muted/20 p-4 sm:rounded-3xl sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-background p-2 text-secondary shadow-sm">
                    <Upload className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Screenshot, photo, or PDF</p>
                    <p className="text-xs text-muted-foreground">
                      Clear crops and text PDFs work best.
                    </p>
                  </div>
                </div>
                <Input
                  name="file"
                  type="file"
                  accept=".pdf,image/*"
                  className="mt-4"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Or paste the text</p>
                <Textarea
                  name="pastedText"
                  rows={6}
                  placeholder="Paste the assignment text or a single homework question here."
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
                {pending ? "Parsing assignment..." : "Upload assignment"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {recentSessions.length > 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-xl">Recent sessions</CardTitle>
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
                    <p className="font-semibold text-foreground">
                      {session.assignmentTitle}
                    </p>
                    {session.status === "completed" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

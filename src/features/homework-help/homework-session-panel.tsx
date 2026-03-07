"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type HomeworkQuestion = {
  index: number;
  promptText: string;
  questionType: string;
};

type HomeworkSessionPanelProps = {
  sessionId: string;
  rawText: string;
  questions: HomeworkQuestion[];
};

export function HomeworkSessionPanel({
  sessionId,
  rawText,
  questions,
}: HomeworkSessionPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(1);
  const [completed, setCompleted] = useState(false);

  const currentQuestion = useMemo(() => questions[currentIndex], [currentIndex, questions]);

  async function submitStep(requestHintLevel: number) {
    const response = await fetch("/api/v1/learn/homework/session/step", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        questionIndex: currentIndex,
        studentAnswer: answer,
        requestHintLevel,
      }),
    });

    const payload = (await response.json()) as {
      feedback: string;
      nextHintLevelAvailable: number;
    };

    setFeedback(payload.feedback);
    setHintLevel(payload.nextHintLevelAvailable);

    if (currentIndex >= questions.length - 1) {
      setCompleted(true);
      return;
    }

    setCurrentIndex((value) => value + 1);
    setAnswer("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Source assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {rawText}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">
            {completed ? "Session complete" : `Question ${currentIndex + 1} of ${questions.length}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {completed ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You completed the guided homework flow. Your next recommendation will
                update the next time you open Tools or Home.
              </p>
              <Button asChild className="w-full">
                <Link href="/app/tools">Return to Tools</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-muted/30 px-4 py-4">
                <p className="font-medium text-foreground">{currentQuestion?.promptText}</p>
              </div>
              <Textarea
                rows={6}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Work through your answer here."
              />
              {feedback ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  {feedback}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() => submitStep(hintLevel)}
                  disabled={!answer.trim()}
                >
                  Get hint
                </Button>
                <Button onClick={() => submitStep(0)} disabled={!answer.trim()}>
                  Submit step
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

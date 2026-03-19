"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SpeakMissionDetails, normalizeSpeakTurnSignals, type SpeakSessionReview, type SpeakTranscriptTurn } from "@/lib/speak";

function normalizePhrase(value: string) {
  return value.trim().toLowerCase();
}

function coachingToneClasses(turn: SpeakTranscriptTurn) {
  const signals = normalizeSpeakTurnSignals(turn.coaching?.signals);

  if (signals.grammarIssue) {
    return "border-amber-200 bg-amber-50/85 text-amber-950";
  }

  if (signals.fluencyIssue) {
    return "border-sky-200 bg-sky-50/85 text-sky-950";
  }

  if (signals.vocabOpportunity) {
    return "border-emerald-200 bg-emerald-50/85 text-emerald-950";
  }

  return "border-border/70 bg-card/90 text-foreground";
}

function getReviewStatusCopy(
  status: SpeakSessionReview["status"],
  mode: SpeakMissionDetails["mode"]
) {
  if (mode === "free_speech") {
    switch (status) {
      case "practice_once_more":
        return {
          label: "Keep it going",
          description:
            "You got the conversation moving. One more round with fuller answers will make it feel easier.",
        };
      case "almost_there":
        return {
          label: "Good session",
          description:
            "You kept the conversation going. The next gain comes from adding a little more detail.",
        };
      default:
        return {
          label: "You kept it going",
          description:
            "This conversation gave you useful language you can carry into the next one.",
        };
    }
  }

  switch (status) {
    case "practice_once_more":
      return {
        label: "One more round",
        description: "You have the core idea. One more conversation with fuller answers will make it stick.",
      };
    case "almost_there":
      return {
        label: "Almost there",
        description: "You kept the conversation moving. The next gain comes from adding a little more detail.",
      };
    default:
      return {
        label: "Ready to build on",
        description: "This session gave you useful language you can carry into the next conversation.",
      };
  }
}

export function SpeakTranscriptPane({
  turns,
  compact = false,
}: {
  turns: SpeakTranscriptTurn[];
  compact?: boolean;
}) {
  return (
    <div
      className={`space-y-4 overflow-auto rounded-[1.75rem] border border-border/70 bg-muted/15 p-4 sm:p-5 ${
        compact ? "max-h-[22rem]" : "max-h-[30rem]"
      }`}
    >
      {turns.map((turn) => (
        <div
          key={`${turn.speaker}-${turn.turnIndex}`}
          className={`flex flex-col gap-2 ${
            turn.speaker === "student" ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-sm shadow-sm ${
              turn.speaker === "student"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground"
            }`}
          >
            {turn.text}
          </div>
          {turn.speaker === "student" && turn.coaching ? (
            <div
              className={`max-w-[88%] rounded-2xl border px-3 py-2 text-xs ${coachingToneClasses(turn)}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                  {turn.coaching.label}
                </Badge>
                <span>{turn.coaching.note}</span>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SpeakCompletionCard({
  mission,
  counterpartLabel,
  review,
  studentTurnCount,
}: {
  mission: SpeakMissionDetails;
  counterpartLabel: string;
  review: SpeakSessionReview | null;
  studentTurnCount: number;
}) {
  const statusCopy = getReviewStatusCopy(review?.status ?? "ready", mission.mode);

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
              Session complete
            </Badge>
            {mission.mode === "guided" ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {counterpartLabel}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
              {statusCopy.label}
            </Badge>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              {mission.scenarioTitle}
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              {statusCopy.description}
            </p>
          </div>
        </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {mission.mode === "free_speech" ? "What sounded natural" : "What landed"}
              </p>
              <p className="mt-2 text-sm text-foreground">
                {review?.strength ?? "You stayed in the conversation and kept your ideas moving."}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Session snapshot
            </p>
            <p className="mt-2 text-sm text-foreground">
              {studentTurnCount} student {studentTurnCount === 1 ? "turn" : "turns"} recorded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Review the strongest language below and save anything you want to reuse.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SpeakReviewPanel({
  review,
  sessionId,
  mode,
}: {
  review: SpeakSessionReview;
  sessionId: string;
  mode: SpeakMissionDetails["mode"];
}) {
  const [savedPhrases, setSavedPhrases] = useState<Set<string>>(new Set());

  async function savePhrase(phraseText: string) {
    const response = await fetch(`/api/v1/speak/session/${sessionId}/phrases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phraseText,
        translationText: phraseText,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save that phrase.");
    }

    setSavedPhrases((current) => {
      const next = new Set(current);
      next.add(normalizePhrase(phraseText));
      return next;
    });
  }

  const highlights = review.highlights.slice(0, 3);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs uppercase">
            {mode === "free_speech" ? "Conversation takeaways" : "Coach summary"}
          </Badge>
          <CardTitle className="text-2xl">
            {mode === "free_speech"
              ? "What sounded natural and what to try next"
              : "What to keep and what to refine"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {mode === "free_speech" ? "What sounded natural" : "What to keep"}
              </p>
              <p className="mt-2 text-sm text-foreground">{review.strength}</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {mode === "free_speech" ? "Next thing to try" : "Next focus"}
              </p>
              <p className="mt-2 text-sm text-foreground">{review.improvement}</p>
            </div>
          </div>

          {highlights.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Key moments
              </p>
              <div className="grid gap-3">
                {highlights.map((highlight, index) => (
                  <div
                    key={`${highlight.turnIndex}-${index}`}
                    className="rounded-[1.5rem] border border-border/70 bg-muted/15 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Moment {index + 1}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">You said:</span> {highlight.youSaid}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">More natural:</span>{" "}
                      {highlight.tryInstead}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{highlight.why}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Accordion type="single" collapsible className="rounded-[1.5rem] border border-border/70 px-4">
            <AccordionItem value="snapshot" className="border-none">
              <AccordionTrigger className="py-4 text-sm font-medium hover:no-underline">
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium text-foreground">Conversation snapshot</p>
                  <p className="text-xs text-muted-foreground">
                    Expand the transcript only if you want to inspect exact turns.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  {review.turns.map((turn) => (
                    <div
                      key={`${turn.turnIndex}-${turn.speaker}`}
                      className="rounded-[1.25rem] border border-border/60 bg-muted/15 p-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {turn.speaker}
                      </p>
                      <p className="mt-2 text-sm text-foreground">{turn.text}</p>
                      {turn.inlineCorrections.slice(0, 1).map((correction) => (
                        <div
                          key={`${turn.turnIndex}-${correction.span}`}
                          className="mt-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">Try:</span> {correction.suggestion}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs uppercase">
            Phrase bank
          </Badge>
          <CardTitle className="text-2xl">
            {mode === "free_speech" ? "Phrases to reuse" : "Keep these phrases for next time"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Save reusable language from the session, not single words.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {review.vocabulary.map((item) => {
            const isSaved = savedPhrases.has(normalizePhrase(item.term));

            return (
              <button
                key={item.term}
                type="button"
                onClick={() => void savePhrase(item.term)}
                disabled={isSaved}
                className="w-full rounded-[1.5rem] border border-border/70 bg-muted/15 px-4 py-4 text-left transition hover:bg-muted/30 disabled:cursor-default disabled:opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.term}</p>
                    <p className="text-sm text-muted-foreground">{item.definition}</p>
                  </div>
                  <Badge variant={isSaved ? "default" : "secondary"} className="rounded-full px-3 py-1">
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Saved
                      </span>
                    ) : (
                      "Save"
                    )}
                  </Badge>
                </div>
              </button>
            );
          })}
          {review.vocabulary.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">No reusable phrase surfaced this round.</p>
                  <p className="mt-1">
                    Finish another session with a few longer answers and this bank will get smarter.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

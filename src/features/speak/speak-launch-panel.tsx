"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackClientEvent } from "@/lib/client-analytics";
import { getSpeakCounterpartLabel } from "@/lib/speak";
import type { SpeakMissionPlan } from "@/features/speak/speak-view-model";

type SpeakLaunchPanelProps = {
  recommendation: SpeakMissionPlan;
  starters: Array<{ key: string; label: string; prompt: string }>;
  guidedScenarios: Array<{ key: string; title: string; description: string }>;
  voiceConfigured: boolean;
  plan: "free" | "pro";
};

type StartPayload = {
  mode: "free_speech" | "guided";
  interactionMode: "text" | "voice";
  starterKey: string | null;
  scenarioKey: string | null;
};

export function SpeakLaunchPanel({
  recommendation,
  starters,
  guidedScenarios,
  voiceConfigured,
  plan,
}: SpeakLaunchPanelProps) {
  const router = useRouter();
  const recommendedInteractionMode =
    recommendation.recommendedInteractionMode === "voice" && voiceConfigured && plan === "pro"
      ? "voice"
      : "text";

  const [mode, setMode] = useState<"free_speech" | "guided">(recommendation.mode);
  const [interactionMode, setInteractionMode] = useState<"text" | "voice">(
    recommendedInteractionMode
  );
  const [starterKey, setStarterKey] = useState(
    recommendation.starterKey ?? starters[0]?.key ?? "school_day"
  );
  const [scenarioKey, setScenarioKey] = useState(
    recommendation.scenarioKey ?? guidedScenarios[0]?.key ?? "class_discussion"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(payload: StartPayload, source: "recommended" | "manual") {
    setPending(true);
    setError(null);

    if (source === "recommended") {
      trackClientEvent({
        eventName: "speak_recommendation_started",
        route: "/app/speak",
        properties: {
          mode: payload.mode,
          scenario_key: payload.scenarioKey ?? payload.starterKey,
        },
      });
    }

    const response = await fetch("/api/v1/speak/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = (await response.json()) as
      | { error?: { code?: string; message?: string } }
      | { sessionId?: string };

    if (!response.ok) {
      const maybeError = "error" in responsePayload ? responsePayload.error : undefined;

      if (maybeError?.code === "VOICE_MODE_UPGRADE_REQUIRED") {
        setInteractionMode("text");
        setError("Voice is available on Pro. You can keep going with text on this device.");
      } else {
        setError(maybeError?.message ?? "Unable to start session.");
      }

      setPending(false);
      return;
    }

    router.push(`/app/speak/session/${(responsePayload as { sessionId: string }).sessionId}`);
  }

  const counterpartLabel = getSpeakCounterpartLabel(recommendation.mission.counterpartRole);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
              Recommended next
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
              {counterpartLabel}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
              {recommendedInteractionMode === "voice" ? "Voice-first" : "Text-first"}
            </Badge>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-4">
              <div className="space-y-3">
                <CardTitle className="text-3xl leading-tight sm:text-4xl">
                  {recommendation.title}
                </CardTitle>
                <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                  {recommendation.description}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Speaking goal
                  </p>
                  <p className="mt-2 text-sm text-foreground">{recommendation.speakingGoal}</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Why now
                  </p>
                  <p className="mt-2 text-sm text-foreground">{recommendation.whyNow}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[2rem] border border-border/70 bg-muted/20 p-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Target phrases
                </p>
                <div className="flex flex-wrap gap-2">
                  {recommendation.mission.targetPhrases.slice(0, 3).map((phrase) => (
                    <Badge key={phrase} variant="outline" className="rounded-full px-3 py-1">
                      {phrase}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  void handleStart(
                    {
                      mode: recommendation.mode,
                      interactionMode: recommendedInteractionMode,
                      starterKey: recommendation.starterKey,
                      scenarioKey: recommendation.scenarioKey,
                    },
                    "recommended"
                  )
                }
              >
                {pending ? "Starting..." : "Start this practice"}
              </Button>
              {recommendedInteractionMode === "voice" ? (
                <p className="text-xs text-muted-foreground">
                  Live voice keeps the conversation flowing without manual send buttons.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Text-first keeps the coaching accessible anywhere and still gives you live-style guidance.
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" />
            Choose a different practice
          </div>
          <CardTitle className="text-2xl">Adjust the setup without losing the coaching</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("free_speech")}
              className={`rounded-[1.35rem] border px-4 py-4 text-left sm:rounded-3xl ${
                mode === "free_speech"
                  ? "border-primary bg-primary/8"
                  : "border-border/70 bg-muted/30"
              }`}
            >
              <p className="font-semibold">Free speech</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from a real prompt and keep the conversation moving naturally.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("guided")}
              className={`rounded-[1.35rem] border px-4 py-4 text-left sm:rounded-3xl ${
                mode === "guided" ? "border-primary bg-primary/8" : "border-border/70 bg-muted/30"
              }`}
            >
              <p className="font-semibold">Guided scenario</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice a specific academic speaking situation with a clear role and goal.
              </p>
            </button>
          </div>

          <div className="space-y-2">
            <Label>Interaction mode</Label>
            <Select
              value={interactionMode}
              onValueChange={(value: "text" | "voice") => setInteractionMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text-first</SelectItem>
                <SelectItem value="voice" disabled={!voiceConfigured}>
                  Voice {!voiceConfigured ? "(Unavailable)" : plan === "pro" ? "(Pro)" : "(Pro only)"}
                </SelectItem>
              </SelectContent>
            </Select>
            {interactionMode === "voice" && plan !== "pro" ? (
              <p className="text-sm text-muted-foreground">
                Voice practice is available on Pro. You can still use the same session in text mode right now.
              </p>
            ) : null}
          </div>

          {mode === "free_speech" ? (
            <div className="space-y-2">
              <Label>Starter prompt</Label>
              <div className="grid gap-3">
                {starters.map((starter) => (
                  <button
                    key={starter.key}
                    type="button"
                    onClick={() => setStarterKey(starter.key)}
                    className={`rounded-[1.1rem] border px-4 py-3 text-left sm:rounded-2xl ${
                      starterKey === starter.key
                        ? "border-primary bg-primary/8"
                        : "border-border/70 bg-muted/30"
                    }`}
                  >
                    <p className="font-semibold">{starter.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{starter.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Scenario</Label>
              <div className="grid gap-3">
                {guidedScenarios.map((scenario) => (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() => setScenarioKey(scenario.key)}
                    className={`rounded-[1.1rem] border px-4 py-3 text-left sm:rounded-2xl ${
                      scenarioKey === scenario.key
                        ? "border-primary bg-primary/8"
                        : "border-border/70 bg-muted/30"
                    }`}
                  >
                    <p className="font-semibold">{scenario.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scenario.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              The mission card and in-session coaching will adapt to this choice automatically.
            </p>
            <Button
              size="lg"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                void handleStart(
                  {
                    mode,
                    interactionMode,
                    starterKey: mode === "free_speech" ? starterKey : null,
                    scenarioKey: mode === "guided" ? scenarioKey : null,
                  },
                  "manual"
                )
              }
            >
              {interactionMode === "voice" ? <Mic className="size-4" /> : null}
              {pending ? "Starting..." : "Start custom practice"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

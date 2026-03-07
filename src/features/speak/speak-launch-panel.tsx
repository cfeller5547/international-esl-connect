"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type SpeakLaunchPanelProps = {
  starters: Array<{ key: string; label: string; prompt: string }>;
  guidedScenarios: Array<{ key: string; title: string; description: string }>;
};

export function SpeakLaunchPanel({
  starters,
  guidedScenarios,
}: SpeakLaunchPanelProps) {
  const router = useRouter();
  const [starterKey, setStarterKey] = useState(starters[0]?.key ?? "school_day");
  const [scenarioKey, setScenarioKey] = useState(guidedScenarios[0]?.key ?? "class_discussion");
  const [mode, setMode] = useState<"free_speech" | "guided">("free_speech");
  const [interactionMode, setInteractionMode] = useState<"text" | "voice">("text");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setPending(true);
    setError(null);

    const response = await fetch("/api/v1/speak/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        interactionMode,
        starterKey,
        scenarioKey: mode === "guided" ? scenarioKey : null,
      }),
    });

    const payload = (await response.json()) as
      | { error?: { message?: string } }
      | { sessionId?: string };

    if (!response.ok) {
      const maybeError = "error" in payload ? payload.error : undefined;
      setError(maybeError?.message ?? "Unable to start session.");
      setPending(false);
      return;
    }

    router.push(`/app/speak/session/${(payload as { sessionId: string }).sessionId}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Start practice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("free_speech")}
              className={`rounded-3xl border px-4 py-4 text-left ${
                mode === "free_speech"
                  ? "border-primary bg-primary/8"
                  : "border-border/70 bg-muted/30"
              }`}
            >
              <p className="font-semibold">Free speech</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from a guided prompt instead of a blank state.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("guided")}
              className={`rounded-3xl border px-4 py-4 text-left ${
                mode === "guided" ? "border-primary bg-primary/8" : "border-border/70 bg-muted/30"
              }`}
            >
              <p className="font-semibold">Guided scenario</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice a specific academic speaking situation.
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
                <SelectItem value="voice">Voice (Pro)</SelectItem>
              </SelectContent>
            </Select>
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
                    className={`rounded-2xl border px-4 py-3 text-left ${
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
                    className={`rounded-2xl border px-4 py-3 text-left ${
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
          <Button size="lg" className="w-full" onClick={handleStart} disabled={pending}>
            {pending ? "Starting..." : "Start practice"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">What to expect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Free plans default to text-first speaking practice with starter prompts.</p>
          <p>After each turn, you get one short improvement cue instead of a wall of corrections.</p>
          <p>Completed sessions unlock transcript review and phrase saving.</p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TestPrepPanelProps = {
  activePlan?: {
    id: string;
    targetDate: string;
    planPayload: {
      days?: Array<{
        dayIndex: number;
        topic: string;
        focusSkills: string[];
        scheduledDate: string;
      }>;
    };
  } | null;
};

export function TestPrepPanel({ activePlan }: TestPrepPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [miniMockResult, setMiniMockResult] = useState<null | {
    readinessScore: number;
    reportId: string;
  }>(null);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/test-prep/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetDate: formData.get("targetDate"),
        topics: String(formData.get("topics") ?? "")
          .split(/,|\n/)
          .map((topic) => topic.trim())
          .filter(Boolean),
      }),
    });

    const payload = (await response.json()) as { planId?: string };
    if (payload.planId) {
      router.refresh();
    }
    setPending(false);
  }

  async function runMiniMock() {
    if (!activePlan) return;
    setPending(true);
    const response = await fetch(`/api/v1/test-prep/plans/${activePlan.id}/mini-mock`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      readinessScore: number;
      reportId: string;
    };
    setMiniMockResult(payload);
    setPending(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Create prep plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={createPlan}>
            <div className="space-y-2">
              <Label htmlFor="targetDate">Target test date</Label>
              <Input id="targetDate" name="targetDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topics">Topics</Label>
              <Textarea
                id="topics"
                name="topics"
                rows={6}
                placeholder="chapter 3 preterite, direct object pronouns"
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Creating..." : "Create prep plan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Active plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activePlan ? (
            <p className="text-sm text-muted-foreground">
              No active plan yet. Add a date and topics to generate one.
            </p>
          ) : (
            <>
              <div className="rounded-2xl bg-muted/30 px-4 py-4">
                <p className="font-semibold text-foreground">
                  Test date: {new Date(activePlan.targetDate).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-3">
                {activePlan.planPayload.days?.map((day) => (
                  <div key={day.dayIndex} className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="font-semibold text-foreground">
                      Day {day.dayIndex} · {new Date(day.scheduledDate).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{day.topic}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                      {day.focusSkills.join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="w-full" onClick={runMiniMock} disabled={pending}>
                {pending ? "Running..." : "Run mini mock"}
              </Button>
              {miniMockResult ? (
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <p className="font-semibold text-foreground">
                    Readiness score: {miniMockResult.readinessScore}
                  </p>
                  <Button className="mt-3 w-full" onClick={() => router.push(`/app/progress/reports/${miniMockResult.reportId}`)}>
                    View mini mock report
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


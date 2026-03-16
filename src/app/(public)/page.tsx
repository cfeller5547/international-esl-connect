import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui-kit/logo";
import { StartAssessmentButton } from "@/features/onboarding/start-assessment-button";

export default function LandingPage() {
  return (
    <div className="grid flex-1 gap-8 py-4 lg:min-h-[calc(100vh-12rem)] lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-8">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-sm font-semibold text-secondary">
          <Logo kind="icon" className="w-5" priority />
          Academic language support built for real classwork
        </div>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            One place to assess, practice, speak, and get homework help fast.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            ESL International Connect keeps class context, urgent homework support,
            and measurable progress in one continuous learning flow.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <StartAssessmentButton />
          <Button variant="outline" size="lg" asChild>
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            "Full diagnostic before signup",
            "Level placement matched to your curriculum",
            "Saved report and clear next steps after signup",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-secondary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <Card className="surface-glow border-border/70 bg-card/95">
        <CardContent className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
          <div className="rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
            <Logo variant="onPrimary" className="w-[178px] sm:w-[220px]" priority />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/70">
              3-step flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold">From pressure to a plan</h2>
          </div>
          {[
            {
              title: "1. Full diagnostic",
              body: "Measure six skills with objective items, a writing sample, and an AI conversation before signup.",
            },
            {
              title: "2. Save and unlock report",
              body: "Create your account after the diagnostic to save the report, level placement, and curriculum starting point.",
            },
            {
              title: "3. Start with the right next step",
              body: "Enter the app with your assigned level, next lesson, and class support already aligned.",
            },
          ].map((step) => (
            <div key={step.title} className="rounded-3xl border border-border/70 bg-muted/30 px-5 py-4">
              <p className="text-base font-semibold">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
          <div id="how-it-works" className="rounded-3xl bg-accent/20 px-5 py-4 text-sm text-foreground">
            Complete the diagnostic first, unlock the report after signup, and enter the app with one clear next step.
            <ArrowRight className="ml-2 inline size-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

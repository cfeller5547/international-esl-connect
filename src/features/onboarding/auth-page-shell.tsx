import { CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type AuthPageShellProps = {
  mode: "signup" | "login";
  children: React.ReactNode;
};

const authPageCopy = {
  login: {
    eyebrow: "Return to your plan",
    title: "Log in and continue from your last learning step.",
    body:
      "Your reports, recommended lesson, homework help, and speaking practice stay ready the moment you sign back in.",
    bullets: [
      "Resume from your latest next action",
      "Keep progress reports and streak history in one place",
      "Get back to class-aligned practice without resetting anything",
    ],
  },
  signup: {
    eyebrow: "Save your progress",
    title: "Create your account and keep your baseline moving forward.",
    body:
      "Your baseline report carries into the full diagnostic so you can keep momentum instead of repeating setup.",
    bullets: [
      "Save your baseline report and recommendations",
      "Unlock the full diagnostic and next-step plan",
      "Continue from one connected learning flow after signup",
    ],
  },
} as const;

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const content = authPageCopy[mode];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center xl:gap-12">
      <section className="space-y-6">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-card/90 px-4 py-2 text-sm font-semibold text-secondary">
          {content.eyebrow}
        </div>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            {content.title}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{content.body}</p>
        </div>
        <Card className="surface-glow max-w-2xl border-border/70 bg-card/95">
          <CardContent className="space-y-4 px-6 py-6">
            {content.bullets.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-secondary" />
                <p className="text-sm text-muted-foreground sm:text-base">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="w-full max-w-[460px] lg:justify-self-end">{children}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { Logo } from "./logo";

type PreSignupStepperProps = {
  className?: string;
  showBrand?: boolean;
};

const steps = [
  {
    href: "/onboarding/profile",
    label: "Profile",
    description: "Personalize your plan",
  },
  {
    href: "/onboarding/assessment",
    label: "Full diagnostic",
    description: "Complete your skills test",
  },
  {
    href: "/signup",
    label: "Create account",
    description: "Unlock your report",
  },
] as const;

function getCurrentStepIndex(pathname: string) {
  if (pathname.startsWith("/onboarding/profile")) {
    return 0;
  }

  if (pathname.startsWith("/onboarding/assessment")) {
    return 1;
  }

  if (pathname.startsWith("/signup")) {
    return 2;
  }

  return 0;
}

export function PreSignupStepper({
  className,
  showBrand = true,
}: PreSignupStepperProps) {
  const pathname = usePathname();
  const currentStepIndex = getCurrentStepIndex(pathname);

  return (
    <div className={cn("space-y-5", className)}>
      {showBrand ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Link href="/" aria-label="ESL International Connect home">
            <Logo className="w-[190px] sm:w-[228px]" priority />
          </Link>
          <p className="text-sm text-muted-foreground">Three steps to start with the right plan.</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isReachable = index <= currentStepIndex;
          const stepClassName = cn(
            "rounded-3xl border px-4 py-4 transition-all",
            isCurrent
              ? "border-primary/35 bg-card/95 shadow-lg shadow-primary/10"
              : isCompleted
                ? "border-primary/20 bg-primary/5"
                : "border-border/70 bg-card/70",
            isReachable ? "hover:border-primary/35 hover:bg-card" : "opacity-70",
          );

          const stepContent = (
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Step {index + 1}
                </p>
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          );

          return isReachable ? (
            <Link
              key={step.href}
              href={step.href}
              aria-current={isCurrent ? "step" : undefined}
              className={stepClassName}
            >
              {stepContent}
            </Link>
          ) : (
            <div key={step.href} className={stepClassName}>
              {stepContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}

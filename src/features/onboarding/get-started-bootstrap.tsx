"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BootstrapErrorState = {
  code: string;
  message: string;
  requestId: string | null;
  stage: string | null;
  debugMessage: string | null;
};

function readErrorState(payload: unknown): BootstrapErrorState {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const errorPayload = payload.error as {
      code?: unknown;
      message?: unknown;
      details?: { requestId?: unknown; stage?: unknown } | null;
    };

    return {
      code:
        typeof errorPayload.code === "string"
          ? errorPayload.code
          : "ONBOARDING_BOOTSTRAP_FAILED",
      message:
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : "We could not start onboarding.",
      requestId:
        typeof errorPayload.details?.requestId === "string"
          ? errorPayload.details.requestId
          : null,
      stage:
        typeof errorPayload.details?.stage === "string"
          ? errorPayload.details.stage
          : null,
      debugMessage:
        typeof (errorPayload.details as { debugMessage?: unknown } | null)?.debugMessage ===
        "string"
          ? (errorPayload.details as { debugMessage: string }).debugMessage
          : null,
    };
  }

  return {
    code: "ONBOARDING_BOOTSTRAP_FAILED",
    message: "We could not start onboarding.",
    requestId: null,
    stage: null,
    debugMessage: null,
  };
}

export function GetStartedBootstrap() {
  const router = useRouter();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<BootstrapErrorState | null>(null);

  const bootstrap = useCallback(async (options?: { resetState?: boolean }) => {
    if (options?.resetState ?? true) {
      setPending(true);
      setError(null);
    }

    try {
      const response = await fetch("/api/v1/onboarding/session", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(readErrorState(payload));
        setPending(false);
        return;
      }

      router.replace("/onboarding/profile");
      router.refresh();
    } catch {
      setError({
        code: "ONBOARDING_BOOTSTRAP_FAILED",
        message: "We could not start onboarding.",
        requestId: null,
        stage: null,
        debugMessage: null,
      });
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void bootstrap({ resetState: false });
    }, 0);

    return () => {
      window.clearTimeout(bootstrapTimer);
    };
  }, [bootstrap]);

  if (pending) {
    return (
      <Card className="surface-glow mx-auto w-full max-w-2xl border-border/70 bg-card/95">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-sm font-medium text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Starting your diagnostic
          </div>
          <CardTitle className="text-3xl">Preparing your onboarding session</CardTitle>
          <p className="max-w-xl text-sm text-muted-foreground">
            We are creating or resuming your guest session so you can continue from
            the right step.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl border border-border/70 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
            This page should move automatically in a moment.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-glow mx-auto w-full max-w-2xl border-destructive/30 bg-card/95">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
          <AlertCircle className="size-4" />
          Start failed
        </div>
        <CardTitle className="text-3xl">We could not start onboarding</CardTitle>
        <p className="max-w-xl text-sm text-muted-foreground">
          This is now exposing the failure details instead of silently failing so we
          can trace the production issue quickly.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-5 py-4">
          <p className="text-sm font-semibold">What to capture</p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Code:</span> {error?.code}
            </p>
            <p>
              <span className="font-medium text-foreground">Message:</span>{" "}
              {error?.message}
            </p>
            <p>
              <span className="font-medium text-foreground">Request ID:</span>{" "}
              {error?.requestId ?? "Not provided"}
            </p>
            <p>
              <span className="font-medium text-foreground">Stage:</span>{" "}
              {error?.stage ?? "Unknown"}
            </p>
            <p>
              <span className="font-medium text-foreground">Debug:</span>{" "}
              {error?.debugMessage ?? "Not provided"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => void bootstrap({ resetState: true })}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

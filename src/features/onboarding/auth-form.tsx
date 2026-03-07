"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "signup" | "login";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const response = await fetch(`/api/v1/auth/${mode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        ageConfirmed13Plus: mode === "signup" ? true : undefined,
      }),
    });

    const payload = (await response.json()) as
      | { error?: { message?: string } }
      | { redirectTo?: string };

    if (!response.ok) {
      const maybeError = "error" in payload ? payload.error : undefined;
      setError(maybeError?.message ?? "Something went wrong.");
      setPending(false);
      return;
    }

    router.push((payload as { redirectTo?: string }).redirectTo ?? "/app/home");
    router.refresh();
  }

  return (
    <Card className="mx-auto w-full max-w-xl border-border/70 bg-card/95 shadow-lg shadow-primary/5">
      <CardHeader className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
          {isSignup ? "Step 4 of 4" : "Welcome back"}
        </p>
        <CardTitle className="text-2xl">{isSignup ? "Create account" : "Log in"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isSignup
            ? "Save your baseline report and unlock the full diagnostic."
            : "Pick up where you left off."}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="student@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending
              ? isSignup
                ? "Creating account..."
                : "Logging in..."
              : isSignup
                ? "Create account"
                : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Already have an account? " : "Need an account? "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="font-semibold text-foreground underline decoration-border underline-offset-4"
            >
              {isSignup ? "Log in" : "Create one"}
            </Link>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

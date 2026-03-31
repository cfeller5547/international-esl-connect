"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toTitleCase } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ACCOUNT_LINKS = [
  {
    href: "/app/more/profile",
    title: "Profile",
    body: "Update learner details and class context.",
    icon: UserRound,
  },
  {
    href: "/app/more/settings",
    title: "Settings",
    body: "Adjust app and accessibility preferences.",
    icon: Settings2,
  },
  {
    href: "/app/more/billing",
    title: "Billing",
    body: "Review limits and plan details.",
    icon: CreditCard,
  },
  {
    href: "/app/more/help",
    title: "Help",
    body: "Get support and troubleshooting guidance.",
    icon: CircleHelp,
  },
] as const;

const PREVIEW_LEVEL_OPTIONS = ["very_basic", "basic", "intermediate", "advanced"] as const;

function subscribeNoop() {
  return () => undefined;
}

type AccountMenuProps = {
  isAdmin: boolean;
  currentLevel: string | null;
  previewLevel: string | null;
};

export function AccountMenu({
  isAdmin,
  currentLevel,
  previewLevel,
}: AccountMenuProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [pendingPreviewLevel, setPendingPreviewLevel] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedPreviewLevel, setSelectedPreviewLevel] = useState(previewLevel ?? "assigned");

  useEffect(() => {
    setSelectedPreviewLevel(previewLevel ?? "assigned");
  }, [previewLevel]);

  async function handleLogout() {
    setPendingLogout(true);
    await fetch("/api/v1/auth/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  async function handlePreviewLevelChange(value: string) {
    setSelectedPreviewLevel(value);
    setPendingPreviewLevel(true);
    setPreviewError(null);

    try {
      const response = await fetch("/api/v1/admin/preview-level", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level: value === "assigned" ? null : value,
        }),
      });

      if (!response.ok) {
        throw new Error("Preview level update failed.");
      }

      router.refresh();
    } catch {
      setSelectedPreviewLevel(previewLevel ?? "assigned");
      setPreviewError("Preview level could not be updated right now.");
    } finally {
      setPendingPreviewLevel(false);
    }
  }

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-border/70 bg-background/90 px-4 shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.45)]"
        type="button"
      >
        Account
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-background/90 px-4 shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.45)]">
          Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-[2rem] border-border/70 bg-card/98 p-6 sm:p-7">
        <DialogHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
            Utilities
          </p>
          <DialogTitle className="text-2xl">Account and app settings</DialogTitle>
          <DialogDescription>
            Use this menu for profile, settings, billing, and support without adding another primary pillar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {ACCOUNT_LINKS.map((item) => {
            const Icon = item.icon;

            return (
              <DialogClose asChild key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-4 transition hover:bg-muted/35"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-background p-2 text-primary shadow-sm">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </Link>
              </DialogClose>
            );
          })}
        </div>

        {isAdmin ? (
          <div className="rounded-3xl border border-border/70 bg-muted/15 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Admin preview
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Preview Learn as another level
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                This only changes your current admin view. It does not rewrite the user&apos;s real
                assigned level.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Assigned level
                </p>
                <p className="text-sm font-medium text-foreground">
                  {currentLevel ? toTitleCase(currentLevel) : "Not assigned yet"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Preview level
                </p>
                <Select
                  value={selectedPreviewLevel}
                  onValueChange={handlePreviewLevelChange}
                  disabled={pendingPreviewLevel}
                >
                  <SelectTrigger className="w-full rounded-2xl bg-background/95">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Use assigned level</SelectItem>
                    {PREVIEW_LEVEL_OPTIONS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {toTitleCase(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 min-h-5 text-sm">
              {previewError ? (
                <p className="text-destructive">{previewError}</p>
              ) : selectedPreviewLevel !== "assigned" ? (
                <p className="text-muted-foreground">
                  Previewing {toTitleCase(selectedPreviewLevel)} across Learn and Home.
                </p>
              ) : (
                <p className="text-muted-foreground">Using the real assigned level.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground"
            onClick={handleLogout}
            disabled={pendingLogout}
          >
            <LogOut className="size-4" />
            {pendingLogout ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

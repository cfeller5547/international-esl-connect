"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);

  async function handleLogout() {
    setPendingLogout(true);
    await fetch("/api/v1/auth/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
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

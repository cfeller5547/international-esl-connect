"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartColumnBig, House, MicVocal, Wrench } from "lucide-react";

import { BottomNav } from "@/components/ui-kit/bottom-nav";
import { Logo } from "@/components/ui-kit/logo";
import { TrackedLink } from "@/components/ui-kit/tracked-link";
import { TOP_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { AccountMenu } from "./account-menu";

type AppShellProps = {
  children: React.ReactNode;
  accountMenu: {
    isAdmin: boolean;
    currentLevel: string | null;
    previewLevel: string | null;
  };
};

const NAV_ICONS = {
  home: House,
  learn: BookOpen,
  speak: MicVocal,
  tools: Wrench,
  progress: ChartColumnBig,
} as const;

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, accountMenu }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-20 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/45 bg-background/84 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-6 sm:py-2.5 lg:px-8">
          <Link href="/app/home" aria-label="ESL International Connect home">
            <Logo className="w-[138px] sm:w-[184px]" priority />
          </Link>

          <AccountMenu
            isAdmin={accountMenu.isAdmin}
            currentLevel={accountMenu.currentLevel}
            previewLevel={accountMenu.previewLevel}
          />
        </div>
      </header>

      <aside className="hidden border-r border-border/50 bg-card/55 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-5 lg:py-6">
        <Link href="/app/home" aria-label="ESL International Connect home" className="px-2">
          <Logo className="w-[190px]" priority />
        </Link>

        <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1.5">
          {TOP_NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const active = isActiveRoute(pathname, item.href);

            return (
              <TrackedLink
                key={item.key}
                href={item.href}
                eventName="nav_tab_clicked"
                route={pathname}
                properties={{
                  tab_name: item.key,
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-border/70 bg-background text-foreground shadow-[0_16px_30px_-24px_hsl(var(--foreground)/0.4)]"
                    : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-background/72 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
                <span>{item.label}</span>
              </TrackedLink>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border/50 px-2 pt-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              Workspace
            </p>
            <p className="text-sm text-muted-foreground">
              Consistent navigation for Home, Learn, Speak, Tools, and Progress.
            </p>
          </div>
          <AccountMenu
            isAdmin={accountMenu.isAdmin}
            currentLevel={accountMenu.currentLevel}
            previewLevel={accountMenu.previewLevel}
          />
        </div>
      </aside>

      <div className="min-w-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

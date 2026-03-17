"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/ui-kit/bottom-nav";
import { Logo } from "@/components/ui-kit/logo";
import { TrackedLink } from "@/components/ui-kit/tracked-link";
import { TOP_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { AccountMenu } from "./account-menu";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-20 xl:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/45 bg-background/84 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/app/home" aria-label="ESL International Connect home">
            <Logo className="w-[156px] sm:w-[184px]" priority />
          </Link>

          <nav className="hidden items-center gap-1.5 xl:flex">
            {TOP_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                    "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-border/70 bg-background/90 text-foreground shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.45)]"
                      : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-background/72 hover:text-foreground"
                  )}
                >
                  {item.label}
                </TrackedLink>
              );
            })}
          </nav>

          <AccountMenu />
        </div>
      </header>
      {children}
      <BottomNav />
    </div>
  );
}

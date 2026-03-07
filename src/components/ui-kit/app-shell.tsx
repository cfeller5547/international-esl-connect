"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/ui-kit/bottom-nav";
import { Logo } from "@/components/ui-kit/logo";
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
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/app/home" aria-label="ESL International Connect home">
            <Logo className="w-[156px] sm:w-[184px]" priority />
          </Link>

          <nav className="hidden items-center gap-2 xl:flex">
            {TOP_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
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

"use client";

import { usePathname } from "next/navigation";
import { BookOpen, ChartColumnBig, House, MicVocal, Wrench } from "lucide-react";

import { TrackedLink } from "@/components/ui-kit/tracked-link";
import { cn } from "@/lib/utils";

const ICONS = {
  home: House,
  learn: BookOpen,
  speak: MicVocal,
  tools: Wrench,
  progress: ChartColumnBig,
} as const;

const ITEMS = [
  { key: "home", label: "Home", href: "/app/home" },
  { key: "learn", label: "Learn", href: "/app/learn" },
  { key: "speak", label: "Speak", href: "/app/speak" },
  { key: "tools", label: "Tools", href: "/app/tools" },
  { key: "progress", label: "Progress", href: "/app/progress" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/92 backdrop-blur-xl xl:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {ITEMS.map((item) => {
          const Icon = ICONS[item.key];
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
                "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors",
                active
                  ? "bg-background/92 text-primary shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.45)]"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", active && "text-primary")} />
              <span>{item.label}</span>
            </TrackedLink>
          );
        })}
      </div>
    </nav>
  );
}

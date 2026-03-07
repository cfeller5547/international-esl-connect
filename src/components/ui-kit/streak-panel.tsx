import { Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type StreakPanelProps = {
  currentStreakDays: number;
  longestStreakDays: number;
  nextMilestoneDays?: number | null;
};

export function StreakPanel({
  currentStreakDays,
  longestStreakDays,
  nextMilestoneDays,
}: StreakPanelProps) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-accent/20 text-accent-foreground">
            <Flame className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {currentStreakDays}-day streak
            </p>
            <p className="text-sm text-muted-foreground">
              Longest streak: {longestStreakDays} days
            </p>
          </div>
        </div>
        {nextMilestoneDays ? (
          <Badge variant="secondary" className="rounded-full">
            Next milestone: {nextMilestoneDays}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}


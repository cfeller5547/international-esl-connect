import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, toTitleCase } from "@/lib/utils";

type SkillCardProps = {
  skill: string;
  score: number;
  interpretation: string;
  action: string;
  delta?: number | null;
  compact?: boolean;
};

export function SkillCard({
  skill,
  score,
  interpretation,
  action,
  delta,
  compact = false,
}: SkillCardProps) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className={cn("gap-3", compact && "pb-3")}>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">{toTitleCase(skill)}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-semibold text-primary">{score}</span>
            {delta !== undefined && delta !== null ? (
              <Badge variant="outline" className="gap-1 rounded-full">
                {delta > 0 ? (
                  <ArrowUp className="size-3 text-[hsl(var(--success))]" />
                ) : delta < 0 ? (
                  <ArrowDown className="size-3 text-destructive" />
                ) : (
                  <ArrowRight className="size-3 text-muted-foreground" />
                )}
                <span>{delta > 0 ? `+${delta}` : delta}</span>
              </Badge>
            ) : null}
          </div>
        </div>
        <Progress value={score} className="h-2.5" />
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "space-y-2")}>
        <p className="text-sm text-muted-foreground">{interpretation}</p>
        <div className="rounded-2xl bg-muted px-3 py-2 text-sm font-medium text-foreground">
          {action}
        </div>
      </CardContent>
    </Card>
  );
}


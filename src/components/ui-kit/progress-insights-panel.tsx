"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Minus, Target, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildSkillTrendData,
  getReportTypeLabel,
  getVisibleHistory,
  summarizeProgress,
  type ProgressHistoryPoint,
  type ProgressRange,
} from "@/lib/progress";
import { cn, formatDate, toTitleCase } from "@/lib/utils";

type ProgressInsightsPanelProps = {
  history: ProgressHistoryPoint[];
  currentReportId?: string;
  title?: string;
  description?: string;
  showSkillTrends?: boolean;
  compact?: boolean;
  showSelectedReportSummary?: boolean;
};

type TimelinePoint = ProgressHistoryPoint & {
  label: string;
  fullDate: string;
  isSelected: boolean;
  isMilestone: boolean;
};

type TimelineDotProps = {
  cx?: number;
  cy?: number;
  payload?: TimelinePoint;
};

const rangeOptions: Array<{ key: ProgressRange; label: string }> = [
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

function isMilestoneReport(reportType: string) {
  return reportType === "baseline_full" || reportType === "reassessment";
}

function deltaLabel(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }

  return `${delta}`;
}

function TrendDot({ cx, cy, payload }: TimelineDotProps) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload
  ) {
    return null;
  }

  const stroke = payload.isMilestone ? "hsl(var(--secondary))" : "hsl(var(--primary))";
  const fill = payload.isSelected
    ? stroke
    : payload.isMilestone
      ? "hsl(var(--secondary) / 0.22)"
      : "hsl(var(--background))";
  const radius = payload.isSelected ? 6 : payload.isMilestone ? 5 : 4;

  return (
    <g>
      {payload.isMilestone ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="hsl(var(--secondary) / 0.14)"
        />
      ) : null}
      {payload.isSelected ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="hsl(var(--primary) / 0.12)"
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    </g>
  );
}

function TimelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-lg shadow-slate-950/10">
      <p className="text-sm font-semibold text-foreground">{point.fullDate}</p>
      <p className="mt-1 text-sm text-muted-foreground">{getReportTypeLabel(point.reportType)}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
          Overall score
        </span>
        <span className="font-mono text-lg font-semibold text-primary">
          {point.overallScore}
        </span>
      </div>
    </div>
  );
}

function SkillSparklineCard({
  skill,
  scores,
  delta,
  latestScore,
}: {
  skill: string;
  scores: number[];
  delta: number;
  latestScore: number;
}) {
  const chartData = scores.map((score, index) => ({
    index,
    score,
  }));

  return (
    <div className="rounded-3xl border border-border/70 bg-background/70 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{toTitleCase(skill)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {scores.length > 1
              ? delta > 0
                ? `${deltaLabel(delta)} trend`
                : delta < 0
                  ? `${deltaLabel(delta)} trend`
                  : "Steady trend"
              : "Needs more history"}
          </p>
        </div>
        <span className="font-mono text-lg font-semibold text-primary">{latestScore}</span>
      </div>
      <div className="mt-4 h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--secondary))"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{scores.length > 1 ? "From first visible report" : "First saved score"}</span>
        <span>{scores.length} reports</span>
      </div>
    </div>
  );
}

export function ProgressInsightsPanel({
  history,
  currentReportId,
  title = "Progress over time",
  description = "See how your overall score and skills change across saved reports.",
  showSkillTrends = true,
  compact = false,
  showSelectedReportSummary = true,
}: ProgressInsightsPanelProps) {
  const [referenceNow] = useState(() => new Date());
  const [range, setRange] = useState<ProgressRange>(() =>
    getVisibleHistory(history, "90d", referenceNow).appliedRange === "90d" ? "90d" : "all"
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    currentReportId ?? history.at(-1)?.reportId ?? null
  );

  const visibleHistoryResult = useMemo(
    () => getVisibleHistory(history, range, referenceNow),
    [history, range, referenceNow]
  );
  const visibleHistory = visibleHistoryResult.points;

  const activeReportId = visibleHistory.some((point) => point.reportId === selectedReportId)
    ? selectedReportId
    : currentReportId && visibleHistory.some((point) => point.reportId === currentReportId)
      ? currentReportId
      : visibleHistory.at(-1)?.reportId ?? null;

  const selectedPoint = visibleHistory.find((point) => point.reportId === activeReportId) ?? null;
  const selectedPointIndex = selectedPoint
    ? visibleHistory.findIndex((point) => point.reportId === selectedPoint.reportId)
    : -1;
  const previousVisiblePoint =
    selectedPointIndex > 0 ? visibleHistory[selectedPointIndex - 1] : null;

  const chartData = useMemo<TimelinePoint[]>(
    () =>
      visibleHistory.map((point) => ({
        ...point,
        label: format(new Date(point.createdAt), compact ? "MMM d" : "MMM d"),
        fullDate: formatDate(point.createdAt),
        isSelected: point.reportId === activeReportId,
        isMilestone: isMilestoneReport(point.reportType),
      })),
    [activeReportId, compact, visibleHistory]
  );

  const summary = useMemo(() => summarizeProgress(visibleHistory), [visibleHistory]);
  const skillTrendData = useMemo(() => buildSkillTrendData(visibleHistory), [visibleHistory]);
  const strongestGrowthLabel =
    summary.reportCount > 1 && summary.strongestGrowth && summary.strongestGrowth.delta > 0
      ? `${toTitleCase(summary.strongestGrowth.skill)} ${deltaLabel(summary.strongestGrowth.delta)}`
      : summary.reportCount > 1
        ? "No positive growth yet"
        : "No trend yet";

  function handleRangeChange(nextRange: ProgressRange) {
    setRange(nextRange);
  }

  return (
    <Card className="surface-glow border-border/70 bg-card/95">
      <CardHeader className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Progress insights
            </p>
            <CardTitle className={cn("text-2xl", compact && "text-xl")}>{title}</CardTitle>
            <CardDescription className={cn("max-w-3xl", compact && "max-w-2xl")}>
              {description}
            </CardDescription>
          </div>

          <div className="inline-flex rounded-full border border-border/70 bg-background/80 p-1">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleRangeChange(option.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  range === option.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("grid gap-3", compact ? "md:grid-cols-3" : "lg:grid-cols-3")}>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              <TrendingUp className="size-4" />
              Overall movement
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {summary.reportCount > 1 ? deltaLabel(summary.overallDelta) : selectedPoint?.overallScore ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.reportCount > 1
                ? `Since ${formatDate(visibleHistory[0].createdAt)}`
                : "First saved report"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              <TrendingUp className="size-4" />
              Strongest growth
            </div>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {strongestGrowthLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.reportCount > 1 ? "Compared with the first visible report" : "Complete another report to compare"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              <Target className="size-4" />
              Current focus
            </div>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {summary.focusSkill
                ? `${toTitleCase(summary.focusSkill.skill)} ${summary.focusSkill.score}`
                : "No report data"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lowest current score in the visible range
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {visibleHistoryResult.usedFallback ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No reports were saved in the last 90 days. Showing all time instead.
          </div>
        ) : null}

        <div
          className={cn(
            "grid gap-6",
            showSelectedReportSummary &&
              (compact ? "xl:grid-cols-[1.3fr_0.7fr]" : "xl:grid-cols-[1.45fr_0.55fr]")
          )}
        >
          <div className="rounded-3xl border border-border/70 bg-background/60 px-4 py-4 sm:px-5">
            <div className={cn("w-full", compact ? "h-64" : "h-72")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 12, right: 8, left: -16, bottom: 6 }}
                  onClick={(state) => {
                    const chartState = state as
                      | {
                          activePayload?: Array<{ payload?: TimelinePoint }>;
                        }
                      | undefined;
                    const reportId = chartState?.activePayload?.[0]?.payload?.reportId;
                    if (reportId) {
                      setSelectedReportId(reportId);
                    }
                  }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="createdAt"
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
                    content={<TimelineTooltip />}
                  />
                  <Line
                    type="monotone"
                    dataKey="overallScore"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={<TrendDot />}
                    activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-card/80">
                {visibleHistory.length} reports visible
              </Badge>
              {summary.milestoneCount > 0 ? (
                <Badge variant="outline" className="rounded-full border-secondary/20 bg-secondary/10 text-secondary">
                  Milestone reports highlighted
                </Badge>
              ) : null}
            </div>
          </div>

          {showSelectedReportSummary ? (
            <div className="rounded-3xl border border-border/70 bg-background/70 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Selected report
              </p>
              {selectedPoint ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        Score {selectedPoint.overallScore}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(selectedPoint.createdAt)} - {toTitleCase(selectedPoint.levelLabel)}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-card/80">
                      {getReportTypeLabel(selectedPoint.reportType)}
                    </Badge>
                  </div>

                  {previousVisiblePoint ? (
                    <div className="rounded-2xl bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Compared with the previous visible report
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {deltaLabel(selectedPoint.overallScore - previousVisiblePoint.overallScore)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        This is the first visible report in the current range.
                      </p>
                    </div>
                  )}

                  {selectedPoint.reportId !== currentReportId ? (
                    <Button asChild className="w-full">
                      <Link href={`/app/progress/reports/${selectedPoint.reportId}`}>
                        Open selected report
                      </Link>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Minus className="size-4" />
                      Viewing this report
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Save a report to unlock your timeline.
                </div>
              )}
            </div>
          ) : null}
        </div>

        {showSkillTrends ? (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Skill trends</p>
                <p className="text-sm text-muted-foreground">
                  Each sparkline shows the score path for one skill in the current range.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {skillTrendData.map((item) => (
                  <SkillSparklineCard
                    key={item.skill}
                    skill={item.skill}
                    scores={item.scores}
                    delta={item.delta}
                    latestScore={item.latestScore}
                  />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

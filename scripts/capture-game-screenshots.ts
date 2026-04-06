// @ts-nocheck
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as authImports from "../src/server/auth.ts";
import * as blueprintImports from "../src/server/curriculum-blueprint.ts";
import * as prismaImports from "../src/server/prisma.ts";

const authModule = authImports.default ?? authImports;
const blueprintModule = blueprintImports.default ?? blueprintImports;
const prismaModule = prismaImports.default ?? prismaImports;

type CurriculumBlueprint = (typeof blueprintModule.CURRICULUM_BLUEPRINTS)[number];
type CurriculumLevel = CurriculumBlueprint["level"];
type UnitBlueprint = CurriculumBlueprint["units"][number];
type GamePayload = UnitBlueprint["authoredContent"]["game"];
type GameStage = GamePayload["stages"][number];

const { prisma } = prismaModule;
const {
  AUTH_COOKIE,
  APP_SESSION_COOKIE,
  ADMIN_PREVIEW_LEVEL_COOKIE,
  createAuthToken,
  hashPassword,
} = authModule;

const SCREENSHOT_ROOT = path.resolve(process.cwd(), "docs", "game_screenshots");
const CAPTURE_LOG_PATH = path.resolve(process.cwd(), ".codex-game-capture.log");
const CAPTURE_ERR_LOG_PATH = path.resolve(process.cwd(), ".codex-game-capture.err.log");
const VIEWPORT = { width: 1600, height: 1400 };
let cachedChromium: any = null;

function writeLogLine(targetPath: string, line: string) {
  fsSync.appendFileSync(targetPath, `${new Date().toISOString()} ${line}\n`, "utf8");
}

function log(message: string) {
  console.log(message);
  writeLogLine(CAPTURE_LOG_PATH, message);
}

function logError(message: string) {
  console.error(message);
  writeLogLine(CAPTURE_ERR_LOG_PATH, message);
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stageActionLabel(stage: {
  presentation?: { ctaLabel?: string; callToAction?: string };
}, fallback: string) {
  return stage.presentation?.ctaLabel ?? stage.presentation?.callToAction ?? fallback;
}

async function detectBaseUrl() {
  for (const port of [3002, 3000]) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(1500),
      });
      if (response.status < 500) {
        return `http://localhost:${port}`;
      }
    } catch {
      // Try the next port.
    }
  }

  throw new Error("No local app detected on http://localhost:3000 or http://localhost:3002.");
}

async function ensureScreenshotAdmin() {
  const existing = await prisma.user.findUnique({
    where: { email: "screenshots-admin@example.com" },
    select: { id: true, email: true, role: true, currentLevel: true },
  });

  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "admin", currentLevel: existing.currentLevel ?? "basic" },
      });
    }

    return existing;
  }

  return prisma.user.create({
    data: {
      email: "screenshots-admin@example.com",
      passwordHash: await hashPassword("ScreenshotPass123!"),
      role: "admin",
      ageBand: "age_18_24",
      nativeLanguage: "english",
      targetLanguage: "english",
      schoolLevel: "college",
      currentLevel: "basic",
    },
    select: {
      id: true,
      email: true,
      role: true,
      currentLevel: true,
    },
  });
}

async function launchBrowser() {
  if (!cachedChromium) {
    log("locating local playwright-core");
    const vscodeRoot = path.resolve(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code");
    const entries = await fs.readdir(vscodeRoot, { withFileTypes: true });
    const candidates: Array<{ href: string; modifiedMs: number }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const modulePath = path.resolve(
        vscodeRoot,
        entry.name,
        "resources",
        "app",
        "node_modules",
        "playwright-core",
        "index.mjs"
      );

      try {
        const stat = await fs.stat(modulePath);
        candidates.push({
          href: pathToFileURL(modulePath).href,
          modifiedMs: stat.mtimeMs,
        });
      } catch {
        // Keep searching.
      }
    }

    if (candidates.length === 0) {
      throw new Error("Unable to locate a local VS Code playwright-core installation.");
    }

    candidates.sort((left, right) => right.modifiedMs - left.modifiedMs);
    log(`using playwright-core from ${candidates[0]!.href}`);
    const playwrightModule = await import(candidates[0]!.href);
    cachedChromium = playwrightModule.chromium;
  }

  const attempts: Array<() => Promise<any>> = [
    () => cachedChromium.launch({ headless: true, channel: "msedge" }),
    () => cachedChromium.launch({ headless: true, channel: "chrome" }),
    () => cachedChromium.launch({ headless: true }),
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      log("launching browser attempt");
      return await attempt();
    } catch (error) {
      logError(error instanceof Error ? `browser launch failed: ${error.message}` : `browser launch failed: ${String(error)}`);
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to launch a Playwright browser.");
}

async function seedAuthCookies(context: BrowserContext, baseUrl: string, user: { id: string; email: string }) {
  const token = await createAuthToken({
    userId: user.id,
    email: user.email,
  });

  await context.addCookies([
    {
      name: AUTH_COOKIE,
      value: token,
      url: baseUrl,
    },
    {
      name: APP_SESSION_COOKIE,
      value: crypto.randomUUID(),
      url: baseUrl,
    },
  ]);
}

async function setPreviewLevel(context: BrowserContext, baseUrl: string, level: CurriculumLevel) {
  await context.addCookies([
    {
      name: ADMIN_PREVIEW_LEVEL_COOKIE,
      value: level,
      url: baseUrl,
    },
  ]);
}

async function waitForStage(page: Page, stageIndex: number, totalStages: number) {
  await page.getByText(new RegExp(`Stage ${stageIndex} of ${totalStages}`, "i")).first().waitFor({
    state: "visible",
    timeout: 15000,
  });
  await page.waitForTimeout(350);
}

async function openGame(page: Page, baseUrl: string, level: CurriculumLevel, unit: UnitBlueprint) {
  await setPreviewLevel(page.context(), baseUrl, level);
  await page.goto(`${baseUrl}/app/learn/unit/${unit.slug}/game`, {
    waitUntil: "networkidle",
  });
  await page.waitForLoadState("networkidle");

  const startGame = page.getByRole("button", { name: /start game/i });
  const stageMarker = page.getByText(new RegExp(`Stage 1 of ${unit.authoredContent.game.stages.length}`, "i")).first();
  await Promise.race([
    startGame.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined),
    stageMarker.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined),
  ]);

  if (await startGame.isVisible().catch(() => false)) {
    await startGame.click();
  }

  await waitForStage(page, 1, unit.authoredContent.game.stages.length);
  await waitForStageInteractive(page, unit.authoredContent.game.stages[0]!);
}

async function captureStage(page: Page, level: CurriculumLevel, unit: UnitBlueprint, stageIndex: number, stage: GameStage) {
  const targetDir = path.join(SCREENSHOT_ROOT, level, unit.slug);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `stage-${String(stageIndex + 1).padStart(2, "0")}-${sanitizeSegment(stage.title)}.png`;
  const filePath = path.join(targetDir, filename);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: filePath,
    fullPage: true,
  });

  log(`saved ${path.relative(process.cwd(), filePath)}`);
}

async function clickButtonByText(page: Page, label: string) {
  const button = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`, "i") }).first();
  await button.click({ timeout: 10000 });
}

async function clickRoleButtonContaining(page: Page, text: string) {
  const button = page.getByRole("button", { name: new RegExp(escapeRegExp(text), "i") }).first();
  await button.click({ timeout: 10000 });
}

async function waitForButtonContaining(page: Page, text: string) {
  await page.waitForFunction(
    (needle) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((button) => {
        const content = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return content.includes(needle) && !button.hasAttribute("disabled");
      });
    },
    text,
    { timeout: 10000 }
  );
}

async function waitForStageInteractive(page: Page, stage: GameStage) {
  switch (stage.kind) {
    case "reaction_pick": {
      const firstRound = stage.rounds[0];
      if (!firstRound) return;
      await page.getByText(new RegExp(escapeRegExp(firstRound.prompt), "i")).first().waitFor({
        state: "visible",
        timeout: 10000,
      });
      await waitForButtonContaining(page, firstRound.options[0]?.label ?? "");
      return;
    }
    case "voice_burst":
    case "voice_prompt":
      await page.getByRole("button", { name: /quick backup/i }).first().waitFor({
        state: "visible",
        timeout: 10000,
      });
      return;
    case "choice": {
      const option = stage.options[0];
      if (option) {
        await waitForButtonContaining(page, option.label);
      }
      return;
    }
    case "sequence": {
      const item = stage.items[0];
      if (item) {
        await waitForButtonContaining(page, item.label);
      }
      return;
    }
    case "assemble": {
      const slot = stage.slots[0];
      if (slot) {
        await waitForButtonContaining(page, slot.label);
      }
      return;
    }
    case "spotlight": {
      const hotspot = stage.hotspots[0];
      if (hotspot) {
        await waitForButtonContaining(page, hotspot.label);
      }
      return;
    }
    case "priority_board": {
      const lane = stage.lanes[0];
      if (lane) {
        await waitForButtonContaining(page, lane.label);
      }
      return;
    }
    default:
      await page.waitForTimeout(500);
  }
}

async function focusBody(page: Page) {
  await page.locator("body").click({
    position: { x: 12, y: 12 },
    timeout: 10000,
  });
}

async function dispatchStageKey(page: Page, key: string) {
  await page.evaluate((nextKey) => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: nextKey,
        bubbles: true,
        cancelable: true,
      })
    );
  }, key);
}

async function clickLaneRunnerDirection(
  page: Page,
  direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
) {
  const player = page.getByText(/^YOU$/i).first();
  const before = await player.boundingBox();
  await dispatchStageKey(page, direction);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(30);
    const after = await player.boundingBox();
    if (
      before &&
      after &&
      (Math.abs(after.x - before.x) > 5 || Math.abs(after.y - before.y) > 5)
    ) {
      return;
    }
  }

  await page.waitForTimeout(60);
}

function buildLaneRunnerPath(
  stage: Extract<GameStage, { kind: "lane_runner" }>,
  start = { lane: stage.lanes.length - 1, column: 0 }
) {
  const occupied = new Map<string, { lane: number; column: number }>();
  for (const token of stage.tokens) {
    occupied.set(token.id, {
      lane: token.lane,
      column: token.column ?? 0,
    });
  }

  const deltas = [
    { key: "ArrowUp", lane: -1, column: 0 },
    { key: "ArrowDown", lane: 1, column: 0 },
    { key: "ArrowLeft", lane: 0, column: -1 },
    { key: "ArrowRight", lane: 0, column: 1 },
  ] as const;
  const columns = Math.max(5, ...stage.tokens.map((token) => (token.column ?? 0) + 1));

  const blockedForTarget = (targetId: string, collected: string[]) => {
    const blocked = new Set<string>();
    for (const token of stage.tokens) {
      if (collected.includes(token.id) || token.id === targetId) {
        continue;
      }
      const position = occupied.get(token.id);
      if (position) {
        blocked.add(`${position.lane}:${position.column}`);
      }
    }
    return blocked;
  };

  const actions: string[] = [];
  let current = start;
  const collected: string[] = [];

  for (const targetId of stage.targetSequenceIds) {
    const target = occupied.get(targetId);
    if (!target) {
      throw new Error(`Lane-runner target ${targetId} is missing a position.`);
    }

    const blocked = blockedForTarget(targetId, collected);
    const queue: Array<{ lane: number; column: number; path: string[] }> = [
      { lane: current.lane, column: current.column, path: [] },
    ];
    const seen = new Set<string>([`${current.lane}:${current.column}`]);
    let found: string[] | null = null;

    while (queue.length > 0 && !found) {
      const next = queue.shift()!;
      if (next.lane === target.lane && next.column === target.column) {
        found = next.path;
        break;
      }

      for (const delta of deltas) {
        const lane = next.lane + delta.lane;
        const column = next.column + delta.column;
        if (lane < 0 || lane >= stage.lanes.length || column < 0 || column >= columns) {
          continue;
        }
        const key = `${lane}:${column}`;
        if (seen.has(key) || blocked.has(key)) {
          continue;
        }
        seen.add(key);
        queue.push({
          lane,
          column,
          path: [...next.path, delta.key],
        });
      }
    }

    if (!found) {
      throw new Error(`No safe path found for lane-runner target ${targetId}.`);
    }

    actions.push(...found);
    current = target;
    collected.push(targetId);
  }

  return actions;
}

function fitLinearAxis(samples: Array<{ axis: number; value: number }>) {
  const count = samples.length;
  const sumAxis = samples.reduce((current, sample) => current + sample.axis, 0);
  const sumValue = samples.reduce((current, sample) => current + sample.value, 0);
  const sumAxisValue = samples.reduce((current, sample) => current + sample.axis * sample.value, 0);
  const sumAxisSquared = samples.reduce((current, sample) => current + sample.axis * sample.axis, 0);
  const denominator = count * sumAxisSquared - sumAxis * sumAxis;

  if (denominator === 0) {
    return { intercept: 0, slope: 1, residual: Number.POSITIVE_INFINITY };
  }

  const slope = (count * sumAxisValue - sumAxis * sumValue) / denominator;
  const intercept = (sumValue - slope * sumAxis) / count;
  const residual = samples.reduce((current, sample) => {
    const estimate = intercept + slope * sample.axis;
    return current + (sample.value - estimate) ** 2;
  }, 0);

  return { intercept, slope, residual };
}

async function deriveLaneRunnerStageState(
  page: Page,
  stage: Extract<GameStage, { kind: "lane_runner" }>
) {
  const tokenSamples: Array<{ token: typeof stage.tokens[number]; x: number; y: number }> = [];
  for (const token of stage.tokens) {
    const tokenLocator = page.getByText(new RegExp(`^${escapeRegExp(token.label)}$`, "i")).last();
    const box = await tokenLocator.boundingBox();
    if (!box) {
      throw new Error(`Unable to locate live lane-runner token "${token.label}".`);
    }
    tokenSamples.push({
      token,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
  }

  let bestShift = 0;
  let bestFit:
    | {
        intercept: number;
        slope: number;
        residual: number;
      }
    | null = null;

  for (let shift = 0; shift < GRID_COLUMNS; shift += 1) {
    const fit = fitLinearAxis(
      tokenSamples.map((sample) => ({
        axis: ((sample.token.column ?? 0) + shift) % GRID_COLUMNS,
        value: sample.x,
      }))
    );

    if (!bestFit || fit.residual < bestFit.residual) {
      bestFit = fit;
      bestShift = shift;
    }
  }

  const laneFit = fitLinearAxis(
    tokenSamples.map((sample) => ({
      axis: sample.token.lane,
      value: sample.y,
    }))
  );

  const playerBox = await page.getByText(/^YOU$/i).first().boundingBox();
  if (!playerBox || !bestFit) {
    throw new Error("Unable to derive the live lane-runner player position.");
  }

  const playerCenterX = playerBox.x + playerBox.width / 2;
  const playerCenterY = playerBox.y + playerBox.height / 2;
  const runnerColumn = Math.max(
    0,
    Math.min(GRID_COLUMNS - 1, Math.round((playerCenterX - bestFit.intercept) / bestFit.slope))
  );
  const runnerLane = Math.max(
    0,
    Math.min(stage.lanes.length - 1, Math.round((playerCenterY - laneFit.intercept) / laneFit.slope))
  );

  const liveStage = {
    ...stage,
    tokens: stage.tokens.map((token) => ({
      ...token,
      column: ((token.column ?? 0) + bestShift) % GRID_COLUMNS,
    })),
  };

  return {
    liveStage,
    runnerLane,
    runnerColumn,
    shift: bestShift,
  };
}

async function solveArcadeLaneRunner(page: Page, stage: Extract<GameStage, { kind: "lane_runner" }>) {
  const { liveStage, runnerLane, runnerColumn, shift } = await deriveLaneRunnerStageState(page, stage);
  const actions = buildLaneRunnerPath(liveStage, { lane: runnerLane, column: runnerColumn });
  log(`lane_runner shift ${shift} from ${runnerLane}:${runnerColumn} path ${actions.join(" ")}`);
  for (const action of actions) {
    await clickLaneRunnerDirection(page, action);
  }
}

async function solveArcadeSortRush(page: Page, stage: Extract<GameStage, { kind: "sort_rush" }>) {
  await focusBody(page);
  for (const card of stage.cards) {
    const laneId = stage.correctAssignments.find((entry) => entry.cardId === card.id)?.laneId;
    const laneIndex = stage.lanes.findIndex((lane) => lane.id === laneId);
    if (laneIndex === -1) {
      throw new Error(`No correct lane found for sort card ${card.id}.`);
    }
    await dispatchStageKey(page, String(laneIndex + 1));
    await page.waitForTimeout(110);
  }
}

async function solveArcadeRouteRace(page: Page, stage: Extract<GameStage, { kind: "route_race" }>) {
  await focusBody(page);
  for (const nodeId of stage.correctPathIds) {
    const nodeIndex = stage.nodes.findIndex((node) => node.id === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`No route node found for ${nodeId}.`);
    }
    await dispatchStageKey(page, String(nodeIndex + 1));
    await page.waitForTimeout(100);
  }
}

async function solveArcadeReactionPick(page: Page, stage: Extract<GameStage, { kind: "reaction_pick" }>) {
  for (let index = 0; index < stage.rounds.length; index += 1) {
    const round = stage.rounds[index]!;
    const option = round.options.find((entry) => entry.id === round.correctOptionId);
    if (!option) {
      throw new Error(`No correct reaction option found for round ${round.id}.`);
    }
    await page.getByText(new RegExp(escapeRegExp(round.prompt), "i")).first().waitFor({
      state: "visible",
      timeout: 10000,
    });
    await waitForButtonContaining(page, option.label);
    await clickRoleButtonContaining(page, option.label);
    if (index < stage.rounds.length - 1) {
      const nextRound = stage.rounds[index + 1]!;
      await page.getByText(new RegExp(escapeRegExp(nextRound.prompt), "i")).first().waitFor({
        state: "visible",
        timeout: 10000,
      });
    }
  }
}

async function solveArcadeVoiceBurst(page: Page, stage: Extract<GameStage, { kind: "voice_burst" }>) {
  await clickButtonByText(page, "Quick backup");
  const option = stage.fallbackOptions.find((entry) => entry.id === stage.correctOptionId);
  if (!option) {
    throw new Error(`No correct fallback option found for voice burst ${stage.id}.`);
  }
  await clickRoleButtonContaining(page, option.label);
  await clickButtonByText(page, "Use quick backup");
}

async function solveChoice(page: Page, stage: Extract<GameStage, { kind: "choice" }>) {
  const option = stage.options.find((entry) => entry.id === stage.correctOptionId);
  if (!option) {
    throw new Error(`No correct choice option found for ${stage.id}.`);
  }
  await clickRoleButtonContaining(page, option.label);
  await clickButtonByText(page, stageActionLabel(stage, "Check stage"));
}

async function solveSequence(page: Page, stage: Extract<GameStage, { kind: "sequence" }>) {
  for (const itemId of stage.correctOrderIds) {
    const item = stage.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error(`No sequence item found for ${itemId}.`);
    }
    await clickRoleButtonContaining(page, item.label);
    await page.waitForTimeout(80);
  }
  await clickButtonByText(page, stageActionLabel(stage, "Check stage"));
}

async function solveAssemble(page: Page, stage: Extract<GameStage, { kind: "assemble" }>) {
  for (const slot of stage.slots) {
    const optionId = stage.correctAssignments.find((entry) => entry.slotId === slot.id)?.optionId;
    const option = stage.options.find((entry) => entry.id === optionId);
    if (!option) {
      throw new Error(`No assemble option found for slot ${slot.id}.`);
    }
    await clickRoleButtonContaining(page, slot.label);
    await clickButtonByText(page, option.label);
    await page.waitForTimeout(80);
  }
  await clickButtonByText(page, stageActionLabel(stage, "Check stage"));
}

async function solveSpotlight(page: Page, stage: Extract<GameStage, { kind: "spotlight" }>) {
  for (const hotspotId of stage.correctHotspotIds) {
    const hotspot = stage.hotspots.find((entry) => entry.id === hotspotId);
    if (!hotspot) {
      throw new Error(`No spotlight hotspot found for ${hotspotId}.`);
    }
    await clickRoleButtonContaining(page, hotspot.label);
    await page.waitForTimeout(80);
  }
  await clickButtonByText(page, stageActionLabel(stage, "Check stage"));
}

async function solvePriorityBoard(page: Page, stage: Extract<GameStage, { kind: "priority_board" }>) {
  for (const card of stage.cards) {
    const laneId = stage.correctAssignments.find((entry) => entry.cardId === card.id)?.laneId;
    const lane = stage.lanes.find((entry) => entry.id === laneId);
    if (!lane) {
      throw new Error(`No priority lane found for card ${card.id}.`);
    }
    await clickRoleButtonContaining(page, lane.label);
    await clickButtonByText(page, card.label);
    await page.waitForTimeout(80);
  }
  await clickButtonByText(page, stageActionLabel(stage, "Check stage"));
}

async function solveVoicePrompt(page: Page, stage: Extract<GameStage, { kind: "voice_prompt" }>) {
  await clickButtonByText(page, "Quick backup");
  const option = stage.fallbackOptions.find((entry) => entry.id === stage.correctOptionId);
  if (!option) {
    throw new Error(`No voice prompt fallback found for ${stage.id}.`);
  }
  await clickRoleButtonContaining(page, option.label);
  await clickButtonByText(page, stageActionLabel(stage, "Use backup"));
}

async function solveStage(page: Page, stage: GameStage) {
  switch (stage.kind) {
    case "lane_runner":
      await solveArcadeLaneRunner(page, stage);
      return;
    case "sort_rush":
      await solveArcadeSortRush(page, stage);
      return;
    case "route_race":
      await solveArcadeRouteRace(page, stage);
      return;
    case "reaction_pick":
      await solveArcadeReactionPick(page, stage);
      return;
    case "voice_burst":
      await solveArcadeVoiceBurst(page, stage);
      return;
    case "choice":
      await solveChoice(page, stage);
      return;
    case "sequence":
      await solveSequence(page, stage);
      return;
    case "assemble":
      await solveAssemble(page, stage);
      return;
    case "spotlight":
      await solveSpotlight(page, stage);
      return;
    case "priority_board":
      await solvePriorityBoard(page, stage);
      return;
    case "voice_prompt":
      await solveVoicePrompt(page, stage);
      return;
    default:
      throw new Error(`Stage kind ${stage.kind} is not supported by the screenshot capture script.`);
  }
}

async function waitForResolution(page: Page) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const nextVisible = await page.getByRole("button", { name: /^Next stage$/i }).first().isVisible().catch(() => false);
    if (nextVisible) {
      return "next" as const;
    }

    const retryArcade = await page.getByRole("button", { name: /^Try stage again$/i }).first().isVisible().catch(() => false);
    if (retryArcade) {
      return "retry_arcade" as const;
    }

    const retryStructured = await page.getByRole("button", { name: /^Retry once$/i }).first().isVisible().catch(() => false);
    if (retryStructured) {
      return "retry_structured" as const;
    }

    await page.waitForTimeout(150);
  }

  throw new Error("Stage resolution did not appear in time.");
}

async function completeStageAndAdvance(
  page: Page,
  stage: GameStage,
  nextStage: GameStage,
  nextStageIndex: number,
  totalStages: number
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    log(`solving ${stage.id} attempt ${attempt}`);
    await solveStage(page, stage);
    const resolution = await waitForResolution(page);
    log(`resolved ${stage.id} as ${resolution}`);

    if (resolution === "next") {
      await page.getByRole("button", { name: /^Next stage$/i }).click();
      await waitForStage(page, nextStageIndex, totalStages);
      await waitForStageInteractive(page, nextStage);
      return;
    }

    if (stage.kind === "lane_runner") {
      const targetDir = path.join(SCREENSHOT_ROOT, "_debug");
      await fs.mkdir(targetDir, { recursive: true });
      const debugPath = path.join(
        targetDir,
        `${sanitizeSegment(stage.id)}-attempt-${attempt}-${resolution}.png`
      );
      await page.screenshot({ path: debugPath, fullPage: true });
      log(`saved debug ${path.relative(process.cwd(), debugPath)}`);
    }

    const retryName = resolution === "retry_arcade" ? /^Try stage again$/i : /^Retry once$/i;
    await page.getByRole("button", { name: retryName }).click();
    await waitForStage(page, nextStageIndex - 1, totalStages);
    await waitForStageInteractive(page, stage);
  }

  throw new Error(`Unable to clear stage ${stage.id} after 3 attempts.`);
}

async function captureUnit(page: Page, baseUrl: string, level: CurriculumLevel, unit: UnitBlueprint) {
  log(`capturing ${level} / ${unit.slug}`);
  await openGame(page, baseUrl, level, unit);

  const stages = unit.authoredContent.game.stages;
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    await captureStage(page, level, unit, index, stage);

    if (index < stages.length - 1) {
      await completeStageAndAdvance(page, stage, stages[index + 1]!, index + 2, stages.length);
    }
  }
}

async function main() {
  fsSync.writeFileSync(CAPTURE_LOG_PATH, "", "utf8");
  fsSync.writeFileSync(CAPTURE_ERR_LOG_PATH, "", "utf8");
  log("capture bootstrap start");
  const baseUrl = await detectBaseUrl();
  log(`detected base url ${baseUrl}`);
  const user = await ensureScreenshotAdmin();
  log(`using screenshot admin ${user.email}`);
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  const requestedLevel = process.env.SCREENSHOT_LEVEL as CurriculumLevel | undefined;
  const requestedUnitSlug = process.env.SCREENSHOT_UNIT_SLUG;

  const browser = await launchBrowser();
  log("browser launched");
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    deviceScaleFactor: 1,
  });

  try {
    await seedAuthCookies(context, baseUrl, user);
    const page = await context.newPage();

    for (const curriculum of blueprintModule.CURRICULUM_BLUEPRINTS) {
      if (requestedLevel && curriculum.level !== requestedLevel) {
        continue;
      }
      for (const unit of curriculum.units) {
        if (requestedUnitSlug && unit.slug !== requestedUnitSlug) {
          continue;
        }
        await captureUnit(page, baseUrl, curriculum.level, unit);
      }
    }

    log(`done: screenshots written to ${SCREENSHOT_ROOT}`);
  } finally {
    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  logError(error instanceof Error ? `${error.stack ?? error.message}` : String(error));
  await prisma.$disconnect();
  process.exitCode = 1;
});

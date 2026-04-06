async (page) => {
  const BASE_URL = "http://localhost:3002";
  const SCREENSHOT_ROOT = "C:/Users/chris/Projects/Personal/international-esl-connect-version-2/docs/game_screenshots";
  const AUTH_COOKIE = "esl_auth";
  const APP_SESSION_COOKIE = "esl_app_session";
  const ADMIN_PREVIEW_LEVEL_COOKIE = "esl_admin_preview_level";
  const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIzZGE5OTZjMi1mNzM5LTQwYzYtYmM0Yi1mZjA2ZTYwYWQwOGYiLCJlbWFpbCI6InNjcmVlbnNob3RzLWFkbWluQGV4YW1wbGUuY29tIiwiaWF0IjoxNzc1MTYyNjkxLCJleHAiOjE3NzU3Njc0OTF9.G_-0qz8PhTmIiyGm-4f1ZqRikzoGR1V8KyAQi39UElg";
  const APP_SESSION = "codex-game-screenshot-session";
  const LEVEL_FILTER = null;

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function sanitizeSegment(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function stageActionLabel(stage, fallback) {
    return stage?.presentation?.ctaLabel ?? stage?.presentation?.callToAction ?? fallback;
  }

  async function clickButtonByText(label) {
    await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`, "i") }).first().click({ timeout: 10000 });
  }

  async function clickButtonContaining(text) {
    await page.getByRole("button", { name: new RegExp(escapeRegExp(text), "i") }).first().click({ timeout: 10000 });
  }

  async function focusBody() {
    await page.locator("body").click({ position: { x: 10, y: 10 }, timeout: 10000 });
  }

  async function fetchManifest() {
    return page.evaluate(async () => {
      const response = await fetch("/_codex/game-screenshot-manifest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Manifest fetch failed with ${response.status}`);
      }
      return response.json();
    });
  }

  async function seedAuth() {
    await page.context().addCookies([
      {
        name: AUTH_COOKIE,
        value: AUTH_TOKEN,
        url: BASE_URL,
      },
      {
        name: APP_SESSION_COOKIE,
        value: APP_SESSION,
        url: BASE_URL,
      },
    ]);
  }

  async function setPreviewLevel(level) {
    await page.context().addCookies([
      {
        name: ADMIN_PREVIEW_LEVEL_COOKIE,
        value: level,
        url: BASE_URL,
      },
    ]);
  }

  async function waitForStage(stageNumber, totalStages) {
    await page.getByText(new RegExp(`Stage ${stageNumber} of ${totalStages}`, "i")).first().waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(400);
  }

  async function openGame(level, unit) {
    await setPreviewLevel(level);
    await page.goto(`${BASE_URL}${unit.route}`, { waitUntil: "networkidle" });
    await page.waitForLoadState("networkidle");

    const startGame = page.getByRole("button", { name: /start game/i }).first();
    if (await startGame.isVisible().catch(() => false)) {
      await startGame.click();
      await page.waitForTimeout(300);
    }

    await waitForStage(1, unit.stages.length);
  }

  async function captureStage(level, unit, stageIndex, stage) {
    const filename = `${SCREENSHOT_ROOT}/${level}/${unit.slug}/stage-${String(stageIndex + 1).padStart(2, "0")}-${sanitizeSegment(stage.title)}.png`;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: filename,
      fullPage: true,
    });
    console.log(`saved ${level}/${unit.slug}/${filename.split("/").pop()}`);
  }

  function laneRunnerActions(stage) {
    const occupied = new Map();
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
    ];

    const columns = Math.max(
      5,
      ...stage.tokens.map((token) => (token.column ?? 0) + 1)
    );

    const blockedForTarget = (targetId, collected) => {
      const blocked = new Set();
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

    const actions = [];
    let current = { lane: stage.lanes.length - 1, column: 0 };
    const collected = [];

    for (const targetId of stage.targetSequenceIds) {
      const target = occupied.get(targetId);
      if (!target) {
        throw new Error(`Missing lane-runner target position for ${targetId}`);
      }

      const blocked = blockedForTarget(targetId, collected);
      const queue = [{ lane: current.lane, column: current.column, path: [] }];
      const seen = new Set([`${current.lane}:${current.column}`]);
      let found = null;

      while (queue.length > 0 && !found) {
        const next = queue.shift();
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
        throw new Error(`No safe path found for ${targetId}`);
      }

      actions.push(...found);
      current = target;
      collected.push(targetId);
    }

    return actions;
  }

  async function solveArcadeLaneRunner(stage) {
    await focusBody();
    const actions = laneRunnerActions(stage);
    for (const action of actions) {
      await page.keyboard.press(action);
      await page.waitForTimeout(14);
    }
  }

  async function solveArcadeSortRush(stage) {
    await focusBody();
    for (const card of stage.cards) {
      const laneId = stage.correctAssignments.find((entry) => entry.cardId === card.id)?.laneId;
      const laneIndex = stage.lanes.findIndex((lane) => lane.id === laneId);
      if (laneIndex === -1) {
        throw new Error(`Missing correct lane for ${card.id}`);
      }
      await page.keyboard.press(String(laneIndex + 1));
      await page.waitForTimeout(130);
    }
  }

  async function solveArcadeRouteRace(stage) {
    await focusBody();
    for (const nodeId of stage.correctPathIds) {
      const nodeIndex = stage.nodes.findIndex((node) => node.id === nodeId);
      if (nodeIndex === -1) {
        throw new Error(`Missing route node ${nodeId}`);
      }
      await page.keyboard.press(String(nodeIndex + 1));
      await page.waitForTimeout(120);
    }
  }

  async function solveArcadeReactionPick(stage) {
    await focusBody();
    for (const round of stage.rounds) {
      const optionIndex = round.options.findIndex((option) => option.id === round.correctOptionId);
      if (optionIndex === -1) {
        throw new Error(`Missing correct option for ${round.id}`);
      }
      await page.keyboard.press(String(optionIndex + 1));
      await page.waitForTimeout(420);
    }
  }

  async function solveArcadeVoiceBurst(stage) {
    await clickButtonByText("Quick backup");
    await page.waitForTimeout(120);
    const option = stage.fallbackOptions.find((entry) => entry.id === stage.correctOptionId);
    if (!option) {
      throw new Error(`Missing correct voice fallback for ${stage.id}`);
    }
    await clickButtonByText(option.label);
    await page.waitForTimeout(120);
    await clickButtonByText("Use quick backup");
  }

  async function solveChoice(stage) {
    const option = stage.options.find((entry) => entry.id === stage.correctOptionId);
    if (!option) {
      throw new Error(`Missing correct choice for ${stage.id}`);
    }
    await clickButtonByText(option.label);
    await clickButtonByText(stageActionLabel(stage, "Check stage"));
  }

  async function solveSequence(stage) {
    for (const itemId of stage.correctOrderIds) {
      const item = stage.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new Error(`Missing sequence item ${itemId}`);
      }
      await clickButtonByText(item.label);
      await page.waitForTimeout(100);
    }
    await clickButtonByText(stageActionLabel(stage, "Check stage"));
  }

  async function solveAssemble(stage) {
    for (const slot of stage.slots) {
      const optionId = stage.correctAssignments.find((entry) => entry.slotId === slot.id)?.optionId;
      const option = stage.options.find((entry) => entry.id === optionId);
      if (!option) {
        throw new Error(`Missing assemble option for slot ${slot.id}`);
      }
      await clickButtonContaining(slot.label);
      await clickButtonByText(option.label);
      await page.waitForTimeout(100);
    }
    await clickButtonByText(stageActionLabel(stage, "Check stage"));
  }

  async function solveSpotlight(stage) {
    for (const hotspotId of stage.correctHotspotIds) {
      const hotspot = stage.hotspots.find((entry) => entry.id === hotspotId);
      if (!hotspot) {
        throw new Error(`Missing hotspot ${hotspotId}`);
      }
      await clickButtonByText(hotspot.label);
      await page.waitForTimeout(100);
    }
    await clickButtonByText(stageActionLabel(stage, "Check stage"));
  }

  async function solvePriorityBoard(stage) {
    for (const card of stage.cards) {
      const laneId = stage.correctAssignments.find((entry) => entry.cardId === card.id)?.laneId;
      const lane = stage.lanes.find((entry) => entry.id === laneId);
      if (!lane) {
        throw new Error(`Missing lane for priority card ${card.id}`);
      }
      await clickButtonContaining(lane.label);
      await clickButtonByText(card.label);
      await page.waitForTimeout(100);
    }
    await clickButtonByText(stageActionLabel(stage, "Check stage"));
  }

  async function solveVoicePrompt(stage) {
    await clickButtonByText("Quick backup");
    await page.waitForTimeout(120);
    const option = stage.fallbackOptions.find((entry) => entry.id === stage.correctOptionId);
    if (!option) {
      throw new Error(`Missing correct voice prompt fallback for ${stage.id}`);
    }
    await clickButtonByText(option.label);
    await clickButtonByText(stageActionLabel(stage, "Use backup"));
  }

  async function solveStage(stage) {
    switch (stage.kind) {
      case "lane_runner":
        await solveArcadeLaneRunner(stage);
        return;
      case "sort_rush":
        await solveArcadeSortRush(stage);
        return;
      case "route_race":
        await solveArcadeRouteRace(stage);
        return;
      case "reaction_pick":
        await solveArcadeReactionPick(stage);
        return;
      case "voice_burst":
        await solveArcadeVoiceBurst(stage);
        return;
      case "choice":
        await solveChoice(stage);
        return;
      case "sequence":
        await solveSequence(stage);
        return;
      case "assemble":
        await solveAssemble(stage);
        return;
      case "spotlight":
        await solveSpotlight(stage);
        return;
      case "priority_board":
        await solvePriorityBoard(stage);
        return;
      case "voice_prompt":
        await solveVoicePrompt(stage);
        return;
      default:
        throw new Error(`Unsupported stage kind: ${stage.kind}`);
    }
  }

  async function waitForResolution() {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const nextVisible = await page.getByRole("button", { name: /^Next stage$/i }).first().isVisible().catch(() => false);
      if (nextVisible) {
        return "next";
      }

      const retryArcade = await page.getByRole("button", { name: /^Try stage again$/i }).first().isVisible().catch(() => false);
      if (retryArcade) {
        return "retry_arcade";
      }

      const retryStructured = await page.getByRole("button", { name: /^Retry once$/i }).first().isVisible().catch(() => false);
      if (retryStructured) {
        return "retry_structured";
      }

      await page.waitForTimeout(150);
    }

    throw new Error("Stage resolution did not appear");
  }

  async function completeStageAndAdvance(stage, nextStageNumber, totalStages) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await solveStage(stage);
      const resolution = await waitForResolution();

      if (resolution === "next") {
        await page.getByRole("button", { name: /^Next stage$/i }).click();
        await waitForStage(nextStageNumber, totalStages);
        return;
      }

      const retryPattern = resolution === "retry_arcade" ? /^Try stage again$/i : /^Retry once$/i;
      await page.getByRole("button", { name: retryPattern }).click();
      await waitForStage(nextStageNumber - 1, totalStages);
    }

    throw new Error(`Unable to clear stage ${stage.id} after 3 attempts`);
  }

  await page.setViewportSize({ width: 1600, height: 1400 });
  await seedAuth();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  const manifest = await fetchManifest();
  const levels = LEVEL_FILTER ? manifest.filter((entry) => entry.level === LEVEL_FILTER) : manifest;

  for (const curriculum of levels) {
    for (const unit of curriculum.units) {
      console.log(`capturing ${curriculum.level} / ${unit.slug}`);
      await openGame(curriculum.level, unit);

      for (let stageIndex = 0; stageIndex < unit.stages.length; stageIndex += 1) {
        const stage = unit.stages[stageIndex];
        await captureStage(curriculum.level, unit, stageIndex, stage);

        if (stageIndex < unit.stages.length - 1) {
          await completeStageAndAdvance(stage, stageIndex + 2, unit.stages.length);
        }
      }
    }
  }

  return `done: captured ${levels.reduce((count, curriculum) => count + curriculum.units.reduce((unitCount, unit) => unitCount + unit.stages.length, 0), 0)} stages`;
}

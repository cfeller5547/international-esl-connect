"use client";

import { useEffect, useRef, useCallback } from "react";
import type { LaneRunnerGameStage } from "@/server/learn-game-types";

type LaneRunnerCanvasProps = {
  stage: LaneRunnerGameStage;
  locked: boolean;
  onCollect: (tokenId: string) => void;
  onMiss: (tokenId: string, reason: string) => void;
  onAllCollected: () => void;
};

// ── Game constants ───────────────────────────────────────────────────────
const BASE_SPEED = 0.38; // Increased from 0.28 for more adrenaline
const SPEED_RAMP = 0.12; // Ramps up faster
const HORIZON = 0.18;
const PLAYER_Z = 0.9;
const HIT_ZONE = 0.09;
const SPAWN_GAP = 0.16; // enough gap between tokens to move between lanes
const ROAD_BOT_W = 0.82;
const ROAD_TOP_W = 0.12;

// ── Colors — vibrant, neon-arcade ────────────────────────────────────────
const C = {
  sky1: 0x0a0618, sky2: 0x1a0a3a, sky3: 0x120828,
  horizonGlow: 0xff6b35,
  horizonPink: 0xff2d78,
  road1: 0x12082e, road2: 0x1e1048,
  roadLine: 0x6a5aaa,
  edge: 0x00ffee,
  edgeGlow: 0x00aadd,
  target: 0x00ff88, targetFill: 0x0d3d24, targetBright: 0x40ffa0,
  hazard: 0xff3355, hazardFill: 0x3d0d18, hazardBright: 0xff6680,
  player: 0xffffff, playerGlow: 0x00eeff, playerRing: 0x8b5cf6, playerTrail: 0x6366f1,
  text: 0xffffff, textMuted: 0x9988cc,
  hit: 0x00ff88, miss: 0xff3355, combo: 0xffd700,
  star: 0xffffff,
  laneEven: 0x180e38, laneOdd: 0x1a1048,
  speedLine: 0x00eeff,
  neonPink: 0xff2d78, neonBlue: 0x00eeff, neonPurple: 0x8b5cf6,
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp(t, 0, 1); }

function project(lane: number, laneCount: number, z: number, w: number, h: number) {
  const hy = h * HORIZON;
  const y = hy + (h - hy) * z;
  const rw = w * (ROAD_TOP_W + (ROAD_BOT_W - ROAD_TOP_W) * z);
  const rl = (w - rw) / 2;
  const lw = rw / laneCount;
  const x = rl + lw * lane + lw / 2;
  const scale = 0.25 + z * 0.75;
  return { x, y, scale, rl, rw, lw };
}

type TokenData = {
  id: string; label: string; role: "target" | "hazard"; lane: number;
  z: number; collected: boolean; missed: boolean;
  flashTimer: number; flashType: "hit" | "miss" | null;
};
type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: number; size: number;
};
type FloatingText = {
  text: string; x: number; y: number; vy: number;
  life: number; maxLife: number; color: number; size: number;
};

export function LaneRunnerCanvas({
  stage, locked, onCollect, onMiss, onAllCollected,
}: LaneRunnerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  const stateRef = useRef({
    playerLane: Math.floor(stage.lanes.length / 2),
    playerLaneVisual: Math.floor(stage.lanes.length / 2),
    tokens: [] as TokenData[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    initialized: false,
    completed: false,
    collectedCount: 0,
    shakeTimer: 0, shakeX: 0, shakeY: 0,
    hitStopTimer: 0,
    roadScroll: 0,
    gameTime: 0,
    lastPlayerX: 0,
    playerMoving: false,
  });
  const lockedRef = useRef(locked);

  useEffect(() => { lockedRef.current = locked; }, [locked]);

  // Callbacks as refs so the game loop closure stays stable
  const onCollectRef = useRef(onCollect);
  const onMissRef = useRef(onMiss);
  const onAllRef = useRef(onAllCollected);
  useEffect(() => { onCollectRef.current = onCollect; }, [onCollect]);
  useEffect(() => { onMissRef.current = onMiss; }, [onMiss]);
  useEffect(() => { onAllRef.current = onAllCollected; }, [onAllCollected]);

  const laneCount = stage.lanes.length;

  // ── Initialize PixiJS ──────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;

    async function init() {
      const PIXI = await import("pixi.js");
      if (destroyed) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const w = rect.width || 800;
      const h = Math.round(w * 0.5625);

      const app = new PIXI.Application();
      await app.init({
        width: w,
        height: h,
        backgroundColor: C.sky1,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      if (destroyed) { app.destroy(true); return; }
      container.appendChild(app.canvas);
      app.canvas.style.width = "100%";
      app.canvas.style.height = "auto";
      app.canvas.style.borderRadius = "16px";
      app.canvas.style.display = "block";
      app.canvas.style.touchAction = "none";
      appRef.current = app;

      // Initialize tokens
      const s = stateRef.current;
      if (!s.initialized) {
        s.initialized = true;
        s.tokens = stage.tokens.map((t, i) => ({
          id: t.id, label: t.label, role: t.role, lane: t.lane,
          z: -(i * SPAWN_GAP), collected: false, missed: false,
          flashTimer: 0, flashType: null,
        }));
      }

      // Create graphics layers
      const bgLayer = new PIXI.Graphics();
      const roadLayer = new PIXI.Graphics();
      const tokenLayer = new PIXI.Container();
      const particleLayer = new PIXI.Container();
      const playerLayer = new PIXI.Container();
      const hudLayer = new PIXI.Container();

      app.stage.addChild(bgLayer, roadLayer, tokenLayer, particleLayer, playerLayer, hudLayer);

      // HUD text objects
      const findText = new PIXI.Text({ text: "", style: { fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: "bold", fill: C.text } });
      findText.position.set(14, 12);
      hudLayer.addChild(findText);

      const clearText = new PIXI.Text({ text: "All found!", style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "bold", fill: C.hit } });
      clearText.position.set(14, 12);
      clearText.visible = false;
      hudLayer.addChild(clearText);

      // Progress dots
      const dots: InstanceType<typeof PIXI.Graphics>[] = [];
      for (let i = 0; i < stage.targetSequenceIds.length; i++) {
        const dot = new PIXI.Graphics();
        hudLayer.addChild(dot);
        dots.push(dot);
      }

      // Player graphics
      const playerGfx = new PIXI.Graphics();
      playerLayer.addChild(playerGfx);

      // Input
      app.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
        if (lockedRef.current || stateRef.current.completed) return;
        const canvasRect = app.canvas.getBoundingClientRect();
        const cx = e.clientX - canvasRect.left;
        const mid = canvasRect.width / 2;
        const s2 = stateRef.current;
        if (cx < mid) {
          s2.playerLane = clamp(s2.playerLane - 1, 0, laneCount - 1);
        } else {
          s2.playerLane = clamp(s2.playerLane + 1, 0, laneCount - 1);
        }
      });

      const handleKey = (e: KeyboardEvent) => {
        if (lockedRef.current || stateRef.current.completed) return;
        const s2 = stateRef.current;
        if (e.key === "ArrowLeft" || e.key === "a") s2.playerLane = clamp(s2.playerLane - 1, 0, laneCount - 1);
        if (e.key === "ArrowRight" || e.key === "d") s2.playerLane = clamp(s2.playerLane + 1, 0, laneCount - 1);
      };
      window.addEventListener("keydown", handleKey);

      function spawnParticles(x: number, y: number, color: number, count: number) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 100 + Math.random() * 200; // Faster particles
          stateRef.current.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 60,
            life: 0.5 + Math.random() * 0.4,
            maxLife: 0.5 + Math.random() * 0.4,
            color, size: 3 + Math.random() * 6,
          });
        }
      }

      function spawnFloatingText(text: string, x: number, y: number, color: number) {
        stateRef.current.floatingTexts.push({
          text, x, y, vy: -80,
          life: 0.8, maxLife: 0.8,
          color, size: 24
        });
      }

      // ── Game loop ────────────────────────────────────────────────────
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // normalize to seconds
        const s2 = stateRef.current;
        const isLocked = lockedRef.current;
        
        // Hit-stop logic
        if (s2.hitStopTimer > 0) {
          s2.hitStopTimer -= dt;
          return; // Skip updating physics/scrolling during hit-stop
        }

        const speedMult = 1 + s2.collectedCount * SPEED_RAMP;
        const speed = BASE_SPEED * speedMult;
        const nextTargetId = stage.targetSequenceIds[s2.collectedCount] ?? null;

        // Smooth player lane (snappier)
        s2.playerLaneVisual = lerp(s2.playerLaneVisual, s2.playerLane, dt * 24);

        // Screen shake
        if (s2.shakeTimer > 0) {
          s2.shakeTimer -= dt;
          const shakeMag = 20 * (s2.shakeTimer / 0.3); // Increased shake magnitude
          s2.shakeX = (Math.random() - 0.5) * shakeMag;
          s2.shakeY = (Math.random() - 0.5) * shakeMag * 0.8;
        } else { s2.shakeX = 0; s2.shakeY = 0; }

        app.stage.position.set(s2.shakeX, s2.shakeY);

        // Road scroll
        if (!isLocked && !s2.completed) {
          s2.roadScroll = (s2.roadScroll + dt * speed * 600) % 50;
        }

        s2.gameTime += dt;
        const t = s2.gameTime;

        // Track player movement for trail
        const prevPx = s2.lastPlayerX;

        // ── BACKGROUND — rich gradient sky with neon horizon ──
        bgLayer.clear();

        // Deep space background
        bgLayer.rect(0, 0, w, h).fill(C.sky1);
        bgLayer.rect(0, 0, w, h * 0.6).fill({ color: C.sky2, alpha: 0.4 });

        const hy = h * HORIZON;

        // Giant Retro Sun
        const sunRadius = h * 0.25;
        const sunX = w / 2;
        const sunY = hy - sunRadius * 0.2;
        
        // Sun glow
        bgLayer.circle(sunX, sunY, sunRadius * 1.2).fill({ color: C.horizonPink, alpha: 0.1 });
        bgLayer.circle(sunX, sunY, sunRadius * 1.1).fill({ color: C.horizonGlow, alpha: 0.2 });
        
        // Retro segmented sun
        const stripeCount = 6;
        for (let i = 0; i < stripeCount; i++) {
          const y1 = sunY - sunRadius + (sunRadius * 2 / stripeCount) * i;
          const y2 = y1 + (sunRadius * 2 / stripeCount) * 0.7; // 30% gap
          
          if (y1 > hy) continue; // Don't draw below horizon
          
          const maxH = Math.min(y2, hy) - y1;
          if (maxH <= 0) continue;
          
          bgLayer.rect(sunX - sunRadius, y1, sunRadius * 2, maxH).fill({ color: C.horizonGlow, alpha: 0.9 - (i * 0.1) });
        }
        
        // Mask the sun to make it a circle
        const sunMask = new PIXI.Graphics();
        sunMask.circle(sunX, sunY, sunRadius).fill(0xffffff);
        bgLayer.mask = sunMask;

        // Horizon glow — layered neon bands (pink + orange)
        bgLayer.rect(0, hy - 60, w, 120).fill({ color: C.horizonPink, alpha: 0.06 });
        bgLayer.rect(0, hy - 35, w, 70).fill({ color: C.horizonGlow, alpha: 0.1 });
        bgLayer.rect(0, hy - 15, w, 30).fill({ color: C.horizonGlow, alpha: 0.15 });
        bgLayer.rect(0, hy - 4, w, 8).fill({ color: C.horizonGlow, alpha: 0.25 });

        // Animated twinkling stars
        for (let i = 0; i < 60; i++) {
          const sx = (i * 137.5 + 13) % w;
          const sy = (i * 73.3 + 7) % (hy - 15);
          const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + i * 0.1) + i));
          const sr = i % 7 === 0 ? 2.5 : i % 3 === 0 ? 1.5 : 1;
          bgLayer.circle(sx, sy, sr).fill({ color: C.star, alpha: twinkle * 0.6 });
        }

        // Mountain silhouette with purple tint
        bgLayer.moveTo(0, hy).lineTo(w * 0.12, hy - 35).lineTo(w * 0.25, hy - 18)
          .lineTo(w * 0.38, hy - 45).lineTo(w * 0.5, hy - 22).lineTo(w * 0.62, hy - 38)
          .lineTo(w * 0.75, hy - 15).lineTo(w * 0.88, hy - 30).lineTo(w, hy - 20)
          .lineTo(w, hy).closePath()
          .fill({ color: C.sky3, alpha: 0.8 });

        // Ground area
        bgLayer.rect(0, hy, w, h - hy).fill({ color: C.sky1, alpha: 0.6 });

        // ── ROAD — neon-lit racing surface ──
        roadLayer.clear();
        const bw = w * ROAD_BOT_W; const tw2 = w * ROAD_TOP_W;
        const bl = (w - bw) / 2; const br = bl + bw;
        const tl = (w - tw2) / 2; const tr = tl + tw2;

        // Road surface
        roadLayer.moveTo(tl, hy).lineTo(tr, hy).lineTo(br, h).lineTo(bl, h).closePath()
          .fill({ color: C.road2, alpha: 1 });
          
        // Synthwave Grid overlay on road
        for(let mz = 0; mz < 1.0; mz += 0.1) {
             const az = ((mz + s2.roadScroll / 500) % 1.0);
             if (az < 0.01) continue;
             const lineY = hy + (h - hy) * az;
             
             // Calculate width of road at this Y
             const currentWidth = tw2 + (bw - tw2) * az;
             const currentLeft = (w - currentWidth) / 2;
             
             roadLayer.moveTo(currentLeft, lineY).lineTo(currentLeft + currentWidth, lineY).stroke({width: 1.5 * az, color: C.neonPurple, alpha: 0.2 * az});
        }

        // Alternating lane colors for visual separation
        for (let i = 0; i < laneCount; i++) {
          const lt = tl + (tw2 / laneCount) * i;
          const rt = tl + (tw2 / laneCount) * (i + 1);
          const lb = bl + (bw / laneCount) * i;
          const rb = bl + (bw / laneCount) * (i + 1);
          const laneColor = i % 2 === 0 ? C.laneEven : C.laneOdd;
          roadLayer.moveTo(lt, hy).lineTo(rt, hy).lineTo(rb, h).lineTo(lb, h).closePath()
            .fill({ color: laneColor, alpha: 0.3 });
        }

        // Neon edge lines (bright, glowing)
        for (const [tx, bx, offset] of [[tl, bl, -1], [tr, br, 1]] as const) {
          // Wide glow
          roadLayer.moveTo(tx + offset * 6, hy).lineTo(bx + offset * 6, h).stroke({ width: 10, color: C.edge, alpha: 0.06 });
          roadLayer.moveTo(tx + offset * 3, hy).lineTo(bx + offset * 3, h).stroke({ width: 5, color: C.edge, alpha: 0.15 });
          // Core line
          roadLayer.moveTo(tx, hy).lineTo(bx, h).stroke({ width: 2.5, color: C.edge, alpha: 0.8 });
        }

        // Lane dividers — dashed neon
        for (let i = 1; i < laneCount; i++) {
          const topX = tl + (tw2 / laneCount) * i;
          const botX = bl + (bw / laneCount) * i;
          // Glow
          roadLayer.moveTo(topX, hy).lineTo(botX, h).stroke({ width: 3, color: C.neonPurple, alpha: 0.06 });
          // Core
          roadLayer.moveTo(topX, hy).lineTo(botX, h).stroke({ width: 1, color: C.roadLine, alpha: 0.3 });
        }

        // Scrolling center marks (animated road motion)
        const cTopX = (tl + tr) / 2; const cBotX = (bl + br) / 2;
        for (let mz = 0; mz < 1.4; mz += 0.08) {
          const az = ((mz + s2.roadScroll / 500) % 1.4);
          if (az < 0.03 || az > 1.05) continue;
          const p = project(laneCount / 2, laneCount, clamp(az, 0, 1), w, h);
          const mx = lerp(cTopX, cBotX, clamp(az, 0, 1));
          const ml = 12 * p.scale;
          const markAlpha = 0.2 * p.scale;
          roadLayer.moveTo(mx, p.y - ml).lineTo(mx, p.y + ml).stroke({ width: 3 * p.scale, color: 0xffffff, alpha: markAlpha });
        }

        // Speed lines on sides when going fast
        if (speedMult > 1.15) {
          const lineAlpha = Math.min(0.3, (speedMult - 1.15) * 0.8);
          for (let i = 0; i < 6; i++) {
            const lz = ((t * 2 + i * 0.15) % 1);
            const lp = project(0, laneCount, lz, w, h);
            const rp = project(laneCount - 1, laneCount, lz, w, h);
            const lineLen = 30 * lp.scale;
            // Left speed line
            roadLayer.moveTo(lp.x - 20, lp.y).lineTo(lp.x - 20, lp.y + lineLen).stroke({ width: 1.5, color: C.speedLine, alpha: lineAlpha * lp.scale });
            // Right speed line
            roadLayer.moveTo(rp.x + 20, rp.y).lineTo(rp.x + 20, rp.y + lineLen).stroke({ width: 1.5, color: C.speedLine, alpha: lineAlpha * rp.scale });
          }
        }

        // ── Update tokens ──
        tokenLayer.removeChildren();

        for (const token of s2.tokens) {
          if (token.collected || token.missed) {
            if (token.flashTimer > 0) { token.flashTimer -= dt; }
            continue;
          }
          
          const previousZ = token.z;
          if (!isLocked && !s2.completed) { token.z += speed * dt; }
          const currentZ = token.z;

          // Past player = missed
          if (currentZ > 1.12) {
            if (token.role === "target" && token.id === nextTargetId) {
              token.missed = true; token.flashTimer = 0.4; token.flashType = "miss";
              s2.shakeTimer = 0.35;
              const p = project(token.lane, laneCount, 1, w, h);
              spawnParticles(p.x, p.y, C.miss, 10);
              spawnFloatingText("TOO SLOW!", p.x, p.y - 20, C.miss);
              onMissRef.current(token.id, "Missed!");
            } else { token.missed = true; }
            continue;
          }

          if (currentZ < -0.02) continue;
          const zc = clamp(currentZ, 0, 1);
          const p = project(token.lane, laneCount, zc, w, h);

          // Collision (Anti-Tunneling)
          const passedPlayer = previousZ <= PLAYER_Z && currentZ >= PLAYER_Z;
          const inHitZone = Math.abs(currentZ - PLAYER_Z) < HIT_ZONE || passedPlayer;

          if (!isLocked && !s2.completed && inHitZone && token.lane === s2.playerLane) {
            if (token.role === "target" && token.id === nextTargetId) {
              token.collected = true; token.flashTimer = 0.35; token.flashType = "hit";
              s2.collectedCount++;
              s2.hitStopTimer = 0.08; // Freeze frame for impact
              s2.shakeTimer = 0.15; // Small shake on hit
              spawnParticles(p.x, p.y, C.hit, 25); // More particles
              spawnFloatingText("GREAT!", p.x, p.y - 20, C.hit);
              onCollectRef.current(token.id);
              if (s2.collectedCount >= stage.targetSequenceIds.length) {
                s2.completed = true;
                spawnParticles(p.x, p.y, C.playerGlow, 50);
                onAllRef.current();
              }
            } else {
              token.missed = true; token.flashTimer = 0.4; token.flashType = "miss";
              s2.shakeTimer = 0.4; // Huge shake on miss
              spawnParticles(p.x, p.y, C.miss, 20);
              spawnFloatingText("MISS!", p.x, p.y - 20, C.miss);
              onMissRef.current(token.id, token.role === "hazard" ? "Hazard!" : "Wrong order!");
            }
            continue;
          }

          // ── Draw token — neon arcade style ──
          const isNext = token.id === nextTargetId;
          const isTarget = token.role === "target";
          const tkw = 140 * p.scale;
          const tkh = 48 * p.scale;
          const tkr = 14 * p.scale;
          const g = new PIXI.Graphics();
          const pulse = isNext ? 0.85 + 0.15 * Math.sin(t * 5) : 1;

          // Ground shadow
          g.ellipse(p.x, p.y + tkh / 2 + 8 * p.scale, tkw / 2 + 6, 6 * p.scale).fill({ color: 0x000000, alpha: 0.4 * p.scale });

          // Outer neon glow for next target (pulsing)
          if (isNext && p.scale > 0.35) {
            const glowSize = 10 + 4 * Math.sin(t * 4);
            g.roundRect(p.x - tkw / 2 - glowSize, p.y - tkh / 2 - glowSize, tkw + glowSize * 2, tkh + glowSize * 2, tkr + glowSize)
              .fill({ color: C.target, alpha: 0.05 * pulse });
            g.roundRect(p.x - tkw / 2 - 5, p.y - tkh / 2 - 5, tkw + 10, tkh + 10, tkr + 4)
              .stroke({ width: 2, color: C.targetBright, alpha: 0.4 * pulse });
          }

          // Hazard outer glow
          if (!isTarget && p.scale > 0.5) {
            g.roundRect(p.x - tkw / 2 - 4, p.y - tkh / 2 - 4, tkw + 8, tkh + 8, tkr + 3)
              .fill({ color: C.hazard, alpha: 0.04 });
          }

          // Card body — solid, saturated
          const fillColor = isTarget ? C.targetFill : C.hazardFill;
          const borderColor = isTarget ? (isNext ? C.targetBright : C.target) : C.hazard;
          const bw2 = (isNext ? 3 : 2) * p.scale;

          g.roundRect(p.x - tkw / 2, p.y - tkh / 2, tkw, tkh, tkr)
            .fill({ color: fillColor, alpha: 0.92 })
            .stroke({ width: bw2, color: borderColor, alpha: isNext ? 1 : 0.65 });

          // Top accent bar (neon colored strip)
          const barY2 = p.y - tkh / 2 + 1;
          g.roundRect(p.x - tkw / 2 + 3, barY2, tkw - 6, 5 * p.scale, 2)
            .fill({ color: borderColor, alpha: 0.9 });

          // Role icon (● for target, ✕ for hazard)
          if (p.scale > 0.5) {
            const iconX = p.x - tkw / 2 + 14 * p.scale;
            const iconY = p.y + 2 * p.scale;
            if (isTarget) {
              g.circle(iconX, iconY, 4 * p.scale).fill({ color: C.target, alpha: 0.8 });
            } else {
              const sz = 4 * p.scale;
              g.moveTo(iconX - sz, iconY - sz).lineTo(iconX + sz, iconY + sz).stroke({ width: 2 * p.scale, color: C.hazard, alpha: 0.8 });
              g.moveTo(iconX + sz, iconY - sz).lineTo(iconX - sz, iconY + sz).stroke({ width: 2 * p.scale, color: C.hazard, alpha: 0.8 });
            }
          }

          tokenLayer.addChild(g);

          // Label — bright white, bold
          if (p.scale > 0.3) {
            const fontSize = Math.round(clamp(15 * p.scale, 9, 16));
            const label = new PIXI.Text({
              text: token.label,
              style: {
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize,
                fontWeight: "bold",
                fill: C.text,
                letterSpacing: 0.5,
              },
            });
            label.anchor.set(0.5);
            label.position.set(p.x + (p.scale > 0.5 ? 6 * p.scale : 0), p.y + 2 * p.scale);
            tokenLayer.addChild(label);
          }
        }

        // ── Draw particles ──
        particleLayer.removeChildren();
        const pg = new PIXI.Graphics();
        s2.particles = s2.particles.filter((pt) => {
          pt.life -= dt;
          if (pt.life <= 0) return false;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 250 * dt;
          const alpha = pt.life / pt.maxLife;
          pg.circle(pt.x, pt.y, pt.size * alpha).fill({ color: pt.color, alpha });
          return true;
        });
        particleLayer.addChild(pg);

        // ── Draw Floating Texts ──
        s2.floatingTexts = s2.floatingTexts.filter((ft) => {
          ft.life -= dt;
          if (ft.life <= 0) return false;
          ft.y += ft.vy * dt;
          const alpha = Math.max(0, ft.life / ft.maxLife);
          const ftLabel = new PIXI.Text({
            text: ft.text,
            style: {
              fontFamily: "system-ui, sans-serif",
              fontSize: ft.size,
              fontWeight: "900",
              fill: ft.color,
              stroke: { color: 0x000000, width: 3 },
            },
          });
          ftLabel.alpha = alpha;
          ftLabel.anchor.set(0.5);
          ftLabel.position.set(ft.x, ft.y);
          particleLayer.addChild(ftLabel);
          return true;
        });

        // ── Draw player — neon orb with trail ──
        playerLayer.removeChildren();
        const pp = project(s2.playerLaneVisual, laneCount, PLAYER_Z, w, h);
        const playerTilt = (s2.playerLaneVisual - s2.playerLane) * 0.4; // Tilt based on movement
        
        const pgfx = new PIXI.Graphics();
        const playerPulse = 0.9 + 0.1 * Math.sin(t * 3);

        // Track movement for trail
        s2.playerMoving = Math.abs(pp.x - s2.lastPlayerX) > 1;
        s2.lastPlayerX = pp.x;

        // Trail effect (fading circles behind player when moving)
        if (s2.playerMoving) {
          for (let ti = 1; ti <= 3; ti++) {
            const trailX = pp.x - (pp.x - prevPx) * ti * 0.3;
            const trailAlpha = (0.12 / ti);
            pgfx.circle(trailX, pp.y, 16 - ti * 3).fill({ color: C.playerTrail, alpha: trailAlpha });
          }
        }

        // Apply tilt rotation
        pgfx.rotation = playerTilt;
        pgfx.position.set(pp.x, pp.y);

        // Ground shadow (drawn at world position, untilted)
        const shadow = new PIXI.Graphics();
        shadow.ellipse(pp.x, pp.y + 28, 36, 10).fill({ color: 0x000000, alpha: 0.45 });
        playerLayer.addChild(shadow);

        // Outermost ambient glow (pulsing)
        const glowR = 48 * playerPulse;
        pgfx.circle(0, 0, glowR).fill({ color: C.playerGlow, alpha: 0.03 });
        pgfx.circle(0, 0, 38 * playerPulse).fill({ color: C.playerGlow, alpha: 0.06 });

        // Outer neon ring (purple)
        pgfx.circle(0, 0, 28).fill({ color: C.playerRing, alpha: 0.15 });
        pgfx.circle(0, 0, 28).stroke({ width: 3, color: C.playerGlow, alpha: 0.5 * playerPulse });

        // Player body (bright white, solid)
        pgfx.circle(0, 0, 22).fill({ color: C.player, alpha: 1 });

        // Inner neon ring (cyan)
        pgfx.circle(0, 0, 17).stroke({ width: 3, color: C.playerGlow, alpha: 0.7 });

        // Inner glow core
        pgfx.circle(0, 0, 10).fill({ color: C.playerGlow, alpha: 0.4 });
        pgfx.circle(0, 0, 5).fill({ color: C.player, alpha: 0.95 });

        // Highlight dot (top-left, gives 3D feel)
        pgfx.circle(-6, -6, 3).fill({ color: C.player, alpha: 0.6 });

        playerLayer.addChild(pgfx);

        // ── HUD — sleek overlay ──
        // Remove dynamic HUD elements (keep findText, clearText, dots which are persistent)
        while (hudLayer.children.length > dots.length + 2) {
          hudLayer.removeChildAt(hudLayer.children.length - 1);
        }

        if (nextTargetId && !s2.completed) {
          const tt = stage.tokens.find((tok) => tok.id === nextTargetId);
          findText.text = `▶ ${tt?.label ?? "..."}`;
          findText.visible = true;
          clearText.visible = false;
        } else if (s2.completed) {
          findText.visible = false;
          clearText.visible = true;
        }

        // Progress dots with neon styling
        const dotGap = 18;
        const dotsStart = w - 18 - dots.length * dotGap;
        dots.forEach((dot, i) => {
          dot.clear();
          const dx = dotsStart + i * dotGap + 8;
          const done = i < s2.collectedCount;
          const isN = i === s2.collectedCount;
          if (done) {
            dot.circle(dx, 18, 6).fill({ color: C.hit, alpha: 0.9 });
            dot.circle(dx, 18, 3).fill({ color: C.player, alpha: 0.8 });
          } else if (isN) {
            const dotPulse = 0.7 + 0.3 * Math.sin(t * 4);
            dot.circle(dx, 18, 7).fill({ color: C.neonBlue, alpha: 0.15 * dotPulse });
            dot.circle(dx, 18, 5).stroke({ width: 1.5, color: C.neonBlue, alpha: 0.8 * dotPulse });
          } else {
            dot.circle(dx, 18, 3).fill({ color: 0x334155, alpha: 0.5 });
          }
        });

        // Combo indicator (visible when combo > 1)
        if (s2.collectedCount > 1) {
          const comboText = `${s2.collectedCount}/${stage.targetSequenceIds.length}`;
          const cg = new PIXI.Graphics();
          cg.roundRect(w / 2 - 30, 6, 60, 24, 8).fill({ color: 0x000000, alpha: 0.5 }).stroke({ width: 1, color: C.neonPurple, alpha: 0.4 });
          hudLayer.addChild(cg);
          const ct = new PIXI.Text({ text: comboText, style: { fontFamily: "system-ui", fontSize: 12, fontWeight: "bold", fill: C.neonBlue } });
          ct.anchor.set(0.5); ct.position.set(w / 2, 18);
          hudLayer.addChild(ct);
        }
      });

      // Cleanup function
      return () => {
        window.removeEventListener("keydown", handleKey);
      };
    }

    let cleanupInput: (() => void) | undefined;
    init().then((cleanup) => { cleanupInput = cleanup; });

    return () => {
      destroyed = true;
      cleanupInput?.();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [laneCount, stage]);

  return (
    <div className="relative w-full focus-within:ring-2 focus-within:ring-indigo-500 rounded-2xl overflow-hidden">
      <div ref={containerRef} className="w-full" aria-hidden="true" />
      
      {/* Accessibility DOM Overlay */}
      <div className="sr-only">
        <p aria-live="assertive">{locked ? "Game paused." : "Lane runner game active. Use left and right arrow keys to switch lanes."}</p>
        <div role="group" aria-label="Lane Controls">
          {stage.lanes.map((lane, idx) => (
            <button
              key={lane.id}
              onClick={() => {
                if (!locked && !stateRef.current.completed) {
                  stateRef.current.playerLane = idx;
                }
              }}
              aria-label={`Move to ${lane.label} lane`}
              disabled={locked}
            >
              Select {lane.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

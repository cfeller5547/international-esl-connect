"use client";

import { useEffect, useRef } from "react";
import type { SortRushGameStage } from "@/server/learn-game-types";

type SortRushCanvasProps = {
  stage: SortRushGameStage;
  locked: boolean;
  onCorrectSort: () => void;
  onIncorrectSort: () => void;
  onAllSorted: (assignments: Array<{ cardId: string; laneId: string }>) => void;
};

// Colors (Slate/Neon Theme)
const C = {
  bg: 0x0f172a, // Slate 900
  glass: 0x020617, // Slate 950
  player: 0x0f172a, // Slate 900 center
  playerGlow: 0x38bdf8, // Sky Blue 400
  hazard: 0xf43f5e, // Rose 400
  target: 0x34d399, // Emerald 400
  text: 0xffffff,
  border: 0x334155, // Slate 700
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export function SortRushCanvas({
  stage, locked, onCorrectSort, onIncorrectSort, onAllSorted,
}: SortRushCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  const stateRef = useRef({
    initialized: false,
    queue: [...stage.cards],
    activeCardId: null as string | null,
    assignments: {} as Record<string, string>,
    
    phase: "SPAWN" as "SPAWN" | "READ" | "ACTION" | "GAMEOVER",
    readTimer: 0,
    
    player: { x: 400, y: 500, targetX: 400, targetY: 500, r: 18, isDragging: false },
    hazards: [] as Array<{ x: number; y: number; vx: number; r: number }>,
    particles: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; size: number }>,
    
    shakeTimer: 0,
    
    // Bounds will be set during init based on width/height
    safeZoneY: 0,
    binHeight: 100,
  });

  const lockedRef = useRef(locked);
  const onCorrectRef = useRef(onCorrectSort);
  const onIncorrectRef = useRef(onIncorrectSort);
  const onAllRef = useRef(onAllSorted);

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { onCorrectRef.current = onCorrectSort; }, [onCorrectSort]);
  useEffect(() => { onIncorrectRef.current = onIncorrectSort; }, [onIncorrectSort]);
  useEffect(() => { onAllRef.current = onAllSorted; }, [onAllSorted]);

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
      await app.init({ width: w, height: h, backgroundColor: C.bg, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);
      app.canvas.style.width = "100%";
      app.canvas.style.height = "auto";
      app.canvas.style.borderRadius = "16px";
      app.canvas.style.display = "block";
      app.canvas.style.touchAction = "none";
      appRef.current = app;

      const s = stateRef.current;
      s.safeZoneY = h - 50;

      // Layers
      const bgLayer = new PIXI.Graphics();
      const binLayer = new PIXI.Container();
      const hazardLayer = new PIXI.Graphics();
      const payloadLayer = new PIXI.Container();
      const playerLayer = new PIXI.Container();
      const particleLayer = new PIXI.Graphics();
      app.stage.addChild(bgLayer, binLayer, hazardLayer, payloadLayer, playerLayer, particleLayer);

      // Environment setup
      bgLayer.rect(0, 0, w, h).fill({ color: C.bg });
      
      const killTop = 130;
      const killBot = h - 100;
      bgLayer.rect(0, killTop, w, killBot - killTop).fill({ color: C.glass, alpha: 0.6 });
      bgLayer.moveTo(0, killTop).lineTo(w, killTop).stroke({ width: 2, color: C.hazard, alpha: 0.4 });
      bgLayer.moveTo(0, killBot).lineTo(w, killBot).stroke({ width: 2, color: C.playerGlow, alpha: 0.4 });

      // Bins (Destinations)
      const binW = w / stage.lanes.length;
      const binsData = stage.lanes.map((lane, i) => {
        const bx = i * binW + binW / 2;
        const by = 60;
        
        const bGroup = new PIXI.Graphics();
        bGroup.roundRect(bx - binW / 2 + 10, by - 50, binW - 20, 100, 12).fill({ color: C.glass, alpha: 0.8 }).stroke({ width: 2, color: C.playerGlow, alpha: 0.5 });
        binLayer.addChild(bGroup);

        const lbl = new PIXI.Text({
          text: lane.label,
          style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "bold", fill: C.playerGlow, wordWrap: true, wordWrapWidth: binW - 40, align: "center" }
        });
        lbl.anchor.set(0.5);
        lbl.position.set(bx, by - 20);
        binLayer.addChild(lbl);

        return { id: lane.id, x: bx, y: by, w: binW - 20, h: 100, gfx: bGroup };
      });

      // Player graphics
      const pGlow = new PIXI.Graphics();
      const pCore = new PIXI.Graphics();
      playerLayer.addChild(pGlow, pCore);

      // Payload graphics
      const payloadBox = new PIXI.Graphics();
      const payloadText = new PIXI.Text({
        text: "",
        style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "600", fill: C.text, wordWrap: true, wordWrapWidth: 200, align: "center" }
      });
      payloadText.anchor.set(0.5);
      const readBar = new PIXI.Graphics();
      payloadLayer.addChild(payloadBox, payloadText, readBar);

      // Initialize Hazards
      if (!s.initialized) {
        s.initialized = true;
        const rows = [
          { y: killTop + 40, dir: 1, speed: 180 },
          { y: killTop + 120, dir: -1, speed: 220 },
          { y: killBot - 40, dir: 1, speed: 160 },
        ];
        rows.forEach(r => {
          for (let i = 0; i < 2; i++) {
            s.hazards.push({ x: r.dir === 1 ? -100 - i * 300 : w + 100 + i * 300, y: r.y, vx: r.speed * r.dir, r: 14 });
          }
        });
        queueNextCard();
      }

      function spawnParticles(x: number, y: number, color: number) {
        for (let i = 0; i < 25; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 100 + Math.random() * 200;
          s.particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, maxLife: 1, color, size: 3 + Math.random() * 4
          });
        }
      }

      function queueNextCard() {
        if (s.phase === "GAMEOVER") return;
        const unassigned = s.queue.filter(c => !s.assignments[c.id]);
        if (unassigned.length === 0) {
          s.phase = "GAMEOVER";
          setTimeout(() => {
            const result = Object.entries(s.assignments).map(([cId, lId]) => ({ cardId: cId, laneId: lId }));
            onAllRef.current(result);
          }, 500);
          return;
        }

        s.activeCardId = unassigned[0].id;
        payloadText.text = unassigned[0].label;
        s.player.x = w / 2;
        s.player.y = s.safeZoneY;
        s.player.targetX = w / 2;
        s.player.targetY = s.safeZoneY;
        s.player.isDragging = false;
        
        s.phase = "READ";
        s.readTimer = 1.2; // 1.2 second freeze to read
      }

      // Input Handling
      app.canvas.addEventListener("pointerdown", (e) => {
        if (lockedRef.current || s.phase !== "ACTION") return;
        const rect = app.canvas.getBoundingClientRect();
        s.player.targetX = e.clientX - rect.left;
        s.player.targetY = e.clientY - rect.top;
        s.player.isDragging = true;
      });
      app.canvas.addEventListener("pointermove", (e) => {
        if (s.player.isDragging) {
          const rect = app.canvas.getBoundingClientRect();
          s.player.targetX = clamp(e.clientX - rect.left, 20, w - 20);
          s.player.targetY = clamp(e.clientY - rect.top, 20, h - 20);
        }
      });
      window.addEventListener("pointerup", () => {
        s.player.isDragging = false;
        s.player.targetX = s.player.x;
        s.player.targetY = s.player.y;
      });

      // â”€â”€ MAIN LOOP â”€â”€
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;
        const time = ticker.lastTime / 1000;

        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt;
          app.stage.x = (Math.random() - 0.5) * 10;
          app.stage.y = (Math.random() - 0.5) * 10;
        } else {
          app.stage.x = 0; app.stage.y = 0;
        }

        // Draw Player
        pGlow.clear(); pCore.clear();
        if (s.phase !== "GAMEOVER") {
          if (s.phase === "ACTION" && s.player.isDragging) {
            // Move player to target
            const dx = s.player.targetX - s.player.x;
            const dy = s.player.targetY - s.player.y;
            s.player.x += dx * 10 * dt;
            s.player.y += dy * 10 * dt;
          }
          pGlow.circle(s.player.x, s.player.y, s.player.r + 6).fill({ color: C.playerGlow, alpha: 0.3 + 0.1 * Math.sin(time * 6) });
          pCore.circle(s.player.x, s.player.y, s.player.r).fill({ color: C.player }).stroke({ width: 3, color: C.playerGlow });
        }

        // Handle Phases
        if (s.phase === "READ") {
          s.readTimer -= dt;
          // Card is huge in center
          const cardX = w / 2; const cardY = h / 2;
          payloadBox.clear().roundRect(-120, -40, 240, 80, 12).fill({ color: C.player, alpha: 0.95 }).stroke({ width: 2, color: C.target });
          payloadLayer.position.set(cardX, cardY);
          payloadLayer.scale.set(1.2);
          
          readBar.clear().rect(-100, 35, 200 * (s.readTimer / 1.2), 4).fill({ color: C.target });
          
          if (s.readTimer <= 0) {
            s.phase = "ACTION";
          }
        } else if (s.phase === "ACTION") {
          // Card shrinks and follows player closely
          payloadBox.clear().roundRect(-100, -35, 200, 70, 8).fill({ color: C.player, alpha: 0.9 }).stroke({ width: 2, color: C.target, alpha: 0.6 });
          readBar.clear();
          
          const tgtX = s.player.x; const tgtY = s.player.y - 50;
          payloadLayer.position.set(
            payloadLayer.position.x + (tgtX - payloadLayer.position.x) * 15 * dt,
            payloadLayer.position.y + (tgtY - payloadLayer.position.y) * 15 * dt
          );
          payloadLayer.scale.set(0.85);

          // Move Hazards
          hazardLayer.clear();
          for (const haz of s.hazards) {
            haz.x += haz.vx * dt;
            if (haz.vx > 0 && haz.x > w + 50) haz.x = -50;
            if (haz.vx < 0 && haz.x < -50) haz.x = w + 50;
            
            hazardLayer.circle(haz.x, haz.y, haz.r).fill({ color: C.glass }).stroke({ width: 3, color: C.hazard });
            hazardLayer.circle(haz.x, haz.y, haz.r + 4).stroke({ width: 2, color: C.hazard, alpha: 0.4 });

            // Hazard Collision (Death)
            if (!lockedRef.current) {
              const dist = Math.hypot(s.player.x - haz.x, s.player.y - haz.y);
              if (dist < s.player.r + haz.r) {
                s.shakeTimer = 0.3;
                spawnParticles(s.player.x, s.player.y, C.playerGlow);
                s.phase = "SPAWN";
                payloadLayer.position.y = -200; // throw it off screen
                onIncorrectRef.current(); // Register miss
                setTimeout(() => queueNextCard(), 800);
              }
            }
          }

          // Bin Collision (Success or Wrong)
          for (const b of binsData) {
            if (s.player.x > b.x - b.w / 2 && s.player.x < b.x + b.w / 2 && s.player.y > b.y - b.h / 2 && s.player.y < b.y + b.h / 2) {
              const isCorrect = stage.correctAssignments.some(a => a.cardId === s.activeCardId && a.laneId === b.id);
              if (isCorrect && s.activeCardId) {
                s.assignments[s.activeCardId] = b.id;
                spawnParticles(b.x, b.y, C.target);
                onCorrectRef.current();
                s.phase = "SPAWN";
                payloadLayer.position.y = -200;
                
                // Draw assignment tick on bin
                const ct = Object.values(s.assignments).filter(v => v === b.id).length;
                b.gfx.circle(b.x, b.y + 30 - ct * 15, 5).fill({ color: C.target });
                
                setTimeout(() => queueNextCard(), 300);
              } else {
                // Wrong Bin - Violent Knockback
                s.shakeTimer = 0.15;
                s.player.isDragging = false;
                s.player.targetX = w / 2;
                s.player.targetY = s.safeZoneY;
                s.player.x = w / 2; // Snap back instantly
                s.player.y = s.safeZoneY;
                onIncorrectRef.current();
                // Visual flash on bin
                b.gfx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12).stroke({ width: 4, color: C.hazard, alpha: 0.8 });
                setTimeout(() => { b.gfx.clear(); b.gfx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12).fill({ color: C.glass, alpha: 0.8 }).stroke({ width: 2, color: C.playerGlow, alpha: 0.5 }); }, 200);
              }
              break;
            }
          }
        }

        // Draw Particles
        particleLayer.clear();
        s.particles = s.particles.filter(p => {
          p.life -= dt;
          if (p.life <= 0) return false;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vy += 400 * dt; // Gravity
          particleLayer.circle(p.x, p.y, p.size * (p.life / p.maxLife)).fill({ color: p.color, alpha: p.life / p.maxLife });
          return true;
        });

      });
    }

    init();
    return () => { destroyed = true; if (appRef.current) appRef.current.destroy(true); };
  }, [stage, onCorrectRef, onIncorrectRef, onAllRef]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden border border-white/10 rounded-[1.8rem] shadow-[inset_0_2px_40px_rgba(0,0,0,0.8)]" />;
}

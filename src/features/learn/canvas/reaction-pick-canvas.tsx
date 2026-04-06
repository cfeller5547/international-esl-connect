"use client";

import { useEffect, useRef } from "react";
import type { ReactionPickGameStage, GameChoiceOption } from "@/server/learn-game-types";

type ReactionPickCanvasProps = {
  stage: ReactionPickGameStage;
  locked: boolean;
  onCorrect: () => void;
  onIncorrect: (isNearMiss: boolean) => void;
  onAllRoundsComplete: (selections: Array<{ roundId: string; optionId: string }>) => void;
};

const C = {
  bg: 0x0a0618,
  optionBg: 0x1a1040, optionBorder: 0x5a4a9a, optionText: 0xffffff,
  correct: 0x00ff88, correctBg: 0x0a3a22,
  incorrect: 0xff3355, incorrectBg: 0x3a0a18,
  nearMiss: 0xffd700,
  prompt: 0x8b5cf6, promptBg: 0x120828,
  accent: 0x00eeff,
  neonPurple: 0x8b5cf6,
  text: 0xffffff, textMuted: 0x8877bb,
  timerFull: 0x00eeff, timerLow: 0xff3355,
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export function ReactionPickCanvas({
  stage, locked, onCorrect, onIncorrect, onAllRoundsComplete,
}: ReactionPickCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  const stateRef = useRef({
    initialized: false,
    roundIndex: 0,
    selections: {} as Record<string, string>,
    completed: false,
    feedback: null as { optionId: string; outcome: "hit" | "miss" | "near_miss"; timer: number } | null,
    gameTime: 0,
    roundStartTime: 0,
    shakeTimer: 0, shakeX: 0, shakeY: 0,
    particles: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; size: number }>,
    optionPositions: [] as Array<{ id: string; x: number; y: number; w: number; h: number }>,
  });
  const lockedRef = useRef(locked);
  const onCorrectRef = useRef(onCorrect);
  const onIncorrectRef = useRef(onIncorrect);
  const onAllRef = useRef(onAllRoundsComplete);

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { onCorrectRef.current = onCorrect; }, [onCorrect]);
  useEffect(() => { onIncorrectRef.current = onIncorrect; }, [onIncorrect]);
  useEffect(() => { onAllRef.current = onAllRoundsComplete; }, [onAllRoundsComplete]);

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
      await app.init({ width: w, height: h, backgroundColor: C.bg, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);
      app.canvas.style.width = "100%"; app.canvas.style.height = "auto";
      app.canvas.style.borderRadius = "16px"; app.canvas.style.display = "block";
      app.canvas.style.touchAction = "none";
      appRef.current = app;

      const bgLayer = new PIXI.Graphics();
      const optionLayer = new PIXI.Container();
      const particleLayer = new PIXI.Container();
      const hudLayer = new PIXI.Container();
      app.stage.addChild(bgLayer, optionLayer, particleLayer, hudLayer);

      function layoutOptions(options: GameChoiceOption[]) {
        const s = stateRef.current;
        s.optionPositions = [];
        const optW = Math.min(240, (w - 60) / 2);
        const optH = 56;
        const gap = 16;
        const cols = options.length <= 3 ? 1 : 2;
        const rows = Math.ceil(options.length / cols);
        const totalH = rows * optH + (rows - 1) * gap;
        const startY = (h - totalH) / 2 + 30;
        const startX = cols === 1 ? (w - optW) / 2 : (w - optW * 2 - gap) / 2;

        options.forEach((opt, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          s.optionPositions.push({
            id: opt.id,
            x: startX + col * (optW + gap),
            y: startY + row * (optH + gap),
            w: optW,
            h: optH,
          });
        });
      }

      function spawnParticles(x: number, y: number, color: number, count: number) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 100;
          stateRef.current.particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 20,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.4 + Math.random() * 0.3,
            color, size: 2 + Math.random() * 4,
          });
        }
      }

      function selectOption(optionId: string) {
        const s = stateRef.current;
        if (s.completed || s.feedback || lockedRef.current) return;

        const round = stage.rounds[s.roundIndex];
        if (!round) return;

        const option = round.options.find((o) => o.id === optionId);
        const isCorrect = optionId === round.correctOptionId;
        const isNearMiss = !isCorrect && option?.isNearMiss === true;
        const pos = s.optionPositions.find((p) => p.id === optionId);
        const px = pos ? pos.x + pos.w / 2 : w / 2;
        const py = pos ? pos.y + pos.h / 2 : h / 2;

        s.selections[round.id] = optionId;

        if (isCorrect) {
          s.feedback = { optionId, outcome: "hit", timer: 0.3 };
          spawnParticles(px, py, C.correct, 12);
          onCorrectRef.current();
        } else if (isNearMiss) {
          s.feedback = { optionId, outcome: "near_miss", timer: 0.35 };
          spawnParticles(px, py, C.nearMiss, 8);
          onIncorrectRef.current(true);
        } else {
          s.feedback = { optionId, outcome: "miss", timer: 0.4 };
          s.shakeTimer = 0.25;
          spawnParticles(px, py, C.incorrect, 8);
          onIncorrectRef.current(false);
        }
      }

      // Click handler
      app.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
        if (lockedRef.current || stateRef.current.completed || stateRef.current.feedback) return;
        const canvasRect = app.canvas.getBoundingClientRect();
        const cx = (e.clientX - canvasRect.left) * (w / canvasRect.width);
        const cy = (e.clientY - canvasRect.top) * (h / canvasRect.height);

        for (const pos of stateRef.current.optionPositions) {
          if (cx >= pos.x && cx <= pos.x + pos.w && cy >= pos.y && cy <= pos.y + pos.h) {
            selectOption(pos.id);
            break;
          }
        }
      });

      // Initialize first round
      if (stage.rounds[0]) layoutOptions(stage.rounds[0].options);

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;
        const s = stateRef.current;
        s.gameTime += dt;
        const t = s.gameTime;

        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt;
          s.shakeX = (Math.random() - 0.5) * 8 * (s.shakeTimer / 0.25);
          s.shakeY = (Math.random() - 0.5) * 6 * (s.shakeTimer / 0.25);
        } else { s.shakeX = 0; s.shakeY = 0; }
        app.stage.position.set(s.shakeX, s.shakeY);

        // Advance round after feedback
        if (s.feedback) {
          s.feedback.timer -= dt;
          if (s.feedback.timer <= 0) {
            s.feedback = null;
            s.roundIndex++;
            s.roundStartTime = t;

            if (s.roundIndex >= stage.rounds.length) {
              s.completed = true;
              onAllRef.current(
                Object.entries(s.selections).map(([roundId, optionId]) => ({ roundId, optionId }))
              );
            } else {
              layoutOptions(stage.rounds[s.roundIndex]!.options);
            }
          }
        }

        const round = stage.rounds[s.roundIndex];

        // ── Background ──
        bgLayer.clear();
        bgLayer.rect(0, 0, w, h).fill(C.bg);
        // Radial vignette
        bgLayer.circle(w / 2, h / 2, w * 0.6).fill({ color: C.neonPurple, alpha: 0.02 });
        // Grid
        for (let gx = 0; gx < w; gx += 50) {
          bgLayer.moveTo(gx, 0).lineTo(gx, h).stroke({ width: 1, color: 0xffffff, alpha: 0.012 });
        }

        // ── Prompt banner ──
        hudLayer.removeChildren();
        if (round && !s.completed) {
          const promptBg = new PIXI.Graphics();
          promptBg.roundRect(20, 12, w - 40, 44, 12)
            .fill({ color: C.promptBg, alpha: 0.9 })
            .stroke({ width: 1.5, color: C.prompt, alpha: 0.3 });
          hudLayer.addChild(promptBg);

          const promptText = new PIXI.Text({
            text: round.prompt,
            style: { fontFamily: "system-ui", fontSize: 14, fontWeight: "bold", fill: C.text, wordWrap: true, wordWrapWidth: w - 80 },
          });
          promptText.anchor.set(0.5);
          promptText.position.set(w / 2, 34);
          hudLayer.addChild(promptText);

          // Round counter
          const roundText = new PIXI.Text({
            text: `Round ${s.roundIndex + 1}/${stage.rounds.length}`,
            style: { fontFamily: "system-ui", fontSize: 11, fill: C.textMuted },
          });
          roundText.anchor.set(1, 0);
          roundText.position.set(w - 16, h - 20);
          hudLayer.addChild(roundText);

          // Per-round timer bar
          const baseRoundMs = 4000;
          const tightenMs = 300;
          const roundBudget = Math.max(2000, baseRoundMs - s.roundIndex * tightenMs);
          const elapsed = (t - s.roundStartTime) * 1000;
          const ratio = clamp(1 - elapsed / roundBudget, 0, 1);
          const timerColor = ratio > 0.3 ? C.timerFull : C.timerLow;

          const barWidth = w - 40;
          const timerBg = new PIXI.Graphics();
          timerBg.roundRect(20, h - 10, barWidth, 4, 2).fill({ color: 0xffffff, alpha: 0.06 });
          timerBg.roundRect(20, h - 10, barWidth * ratio, 4, 2).fill({ color: timerColor, alpha: 0.8 });
          hudLayer.addChild(timerBg);

          // Auto-miss on round timeout
          if (!s.feedback && elapsed >= roundBudget) {
            s.feedback = { optionId: "", outcome: "miss", timer: 0.3 };
            s.shakeTimer = 0.2;
            onIncorrectRef.current(false);
          }
        }

        if (s.completed) {
          const doneText = new PIXI.Text({ text: "All rounds complete!", style: { fontFamily: "system-ui", fontSize: 18, fontWeight: "bold", fill: C.correct } });
          doneText.anchor.set(0.5); doneText.position.set(w / 2, h / 2);
          hudLayer.addChild(doneText);
        }

        // ── Options ──
        optionLayer.removeChildren();
        if (round && !s.completed) {
          for (const pos of s.optionPositions) {
            const option = round.options.find((o) => o.id === pos.id);
            if (!option) continue;

            const isFeedback = s.feedback?.optionId === pos.id;
            const feedbackOutcome = isFeedback ? s.feedback!.outcome : null;
            const isCorrectOption = pos.id === round.correctOptionId;
            const showCorrect = s.feedback && isCorrectOption;

            const og = new PIXI.Graphics();
            const pulse = 0.95 + 0.05 * Math.sin(t * 3 + pos.x * 0.01);

            let fillColor = C.optionBg;
            let borderColor = C.optionBorder;
            let borderAlpha = 0.4;

            if (feedbackOutcome === "hit") {
              fillColor = C.correctBg; borderColor = C.correct; borderAlpha = 0.9;
            } else if (feedbackOutcome === "miss") {
              fillColor = C.incorrectBg; borderColor = C.incorrect; borderAlpha = 0.9;
            } else if (feedbackOutcome === "near_miss") {
              fillColor = 0x3a2a00; borderColor = C.nearMiss; borderAlpha = 0.9;
            } else if (showCorrect) {
              borderColor = C.correct; borderAlpha = 0.5;
            }

            // Option card
            og.roundRect(pos.x, pos.y, pos.w, pos.h, 14)
              .fill({ color: fillColor, alpha: 0.9 * pulse })
              .stroke({ width: 2, color: borderColor, alpha: borderAlpha });

            // Hover-ready glow
            if (!s.feedback) {
              og.roundRect(pos.x - 2, pos.y - 2, pos.w + 4, pos.h + 4, 16)
                .stroke({ width: 1, color: C.accent, alpha: 0.08 });
            }

            optionLayer.addChild(og);

            // Option text
            const optText = new PIXI.Text({
              text: option.label,
              style: { fontFamily: "system-ui", fontSize: 13, fontWeight: "bold", fill: C.text, wordWrap: true, wordWrapWidth: pos.w - 24 },
            });
            optText.anchor.set(0.5);
            optText.position.set(pos.x + pos.w / 2, pos.y + pos.h / 2);
            optionLayer.addChild(optText);
          }
        }

        // ── Particles ──
        particleLayer.removeChildren();
        const pg = new PIXI.Graphics();
        s.particles = s.particles.filter((pt) => {
          pt.life -= dt; if (pt.life <= 0) return false;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 150 * dt;
          const alpha = pt.life / pt.maxLife;
          pg.circle(pt.x, pt.y, pt.size * alpha).fill({ color: pt.color, alpha });
          return true;
        });
        particleLayer.addChild(pg);
      });
    }

    init();
    return () => { destroyed = true; if (appRef.current) { appRef.current.destroy(true, { children: true }); appRef.current = null; } };
  }, [stage]);

  return <div ref={containerRef} className="w-full" />;
}

"use client";

import { useEffect, useRef } from "react";
import type { RouteRaceGameStage } from "@/server/learn-game-types";

type RouteRaceCanvasProps = {
  stage: RouteRaceGameStage;
  locked: boolean;
  onCorrectNode: () => void;
  onIncorrectNode: () => void;
  onPathComplete: (pathIds: string[]) => void;
};

// Colors (Slate/Neon Theme)
const C = {
  bg: 0x0f172a, // Slate 900
  glass: 0x020617, // Slate 950
  player: 0x0f172a,
  playerGlow: 0x38bdf8, // Sky Blue 400
  hazard: 0xf43f5e, // Rose 400
  target: 0x34d399, // Emerald 400
  text: 0xffffff,
  pathDim: 0x334155, // Slate 700
  pathActive: 0x38bdf8,
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export function RouteRaceCanvas({
  stage, locked, onCorrectNode, onIncorrectNode, onPathComplete,
}: RouteRaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);

  const stateRef = useRef({
    initialized: false,
    pathIndex: 0,
    currentNodeId: null as string | null,
    
    phase: "ORBIT" as "ORBIT" | "FLIGHT" | "DEAD" | "VICTORY",
    angle: 0,
    orbitSpeed: 2.5, // Radians per second
    orbitRadius: 45,
    flightSpeed: 900, // Pixels per second
    
    player: { x: 0, y: 0, vx: 0, vy: 0, r: 12 },
    nodes: new Map<string, { x: number; y: number; label: string; gfx: any }>(),
    edges: [] as Array<{ from: string; to: string }>,
    particles: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; size: number }>,
    hazards: [] as Array<{ x: number; y: number; vx: number; vy: number; r: number; rotation: number; rotSpeed: number }>,
    
    shakeTimer: 0,
  });

  const lockedRef = useRef(locked);
  const onCorrectRef = useRef(onCorrectNode);
  const onIncorrectRef = useRef(onIncorrectNode);
  const onCompleteRef = useRef(onPathComplete);

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { onCorrectRef.current = onCorrectNode; }, [onCorrectNode]);
  useEffect(() => { onIncorrectRef.current = onIncorrectNode; }, [onIncorrectNode]);
  useEffect(() => { onCompleteRef.current = onPathComplete; }, [onPathComplete]);

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

      // Layers
      const bgLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const nodeLayer = new PIXI.Container();
      const hazardLayer = new PIXI.Graphics();
      const aimLayer = new PIXI.Graphics();
      const particleLayer = new PIXI.Graphics();
      const playerLayer = new PIXI.Container();
      app.stage.addChild(bgLayer, edgeLayer, nodeLayer, hazardLayer, aimLayer, particleLayer, playerLayer);

      // Environment setup (Deep Space Grid)
      bgLayer.rect(0, 0, w, h).fill({ color: C.bg });
      for (let i = 0; i < w; i += 50) { bgLayer.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: C.playerGlow, alpha: 0.03 }); }
      for (let i = 0; i < h; i += 50) { bgLayer.moveTo(0, i).lineTo(w, i).stroke({ width: 1, color: C.playerGlow, alpha: 0.03 }); }

      // Initialize Nodes
      if (!s.initialized) {
        s.initialized = true;

        stage.nodes.forEach((node, index) => {
          const px = node.x ? (node.x / 100) * w : (20 + (index % 4) * 20) / 100 * w;
          const py = node.y ? (node.y / 100) * h : (20 + Math.floor(index / 4) * 25) / 100 * h;

          const nGroup = new PIXI.Graphics();
          nodeLayer.addChild(nGroup);

          const lbl = new PIXI.Text({
            text: node.label,
            style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "bold", fill: C.text, wordWrap: true, wordWrapWidth: 80, align: "center", dropShadow: { alpha: 0.8, blur: 2, color: 0x000000, distance: 0 } }
          });
          lbl.anchor.set(0.5);
          lbl.position.set(px, py);
          nodeLayer.addChild(lbl);

          s.nodes.set(node.id, { x: px, y: py, label: node.label, gfx: nGroup });
        });

        // Background constellation edges
        const connections = stage.presentation?.connections || [];
        connections.forEach(conn => {
          if (s.nodes.has(conn.fromId) && s.nodes.has(conn.toId)) {
            s.edges.push({ from: conn.fromId, to: conn.toId });
          }
        });

        // Spawn Asteroids (Hazards)
        // We spawn enough to make it dangerous but not impossible
        const numHazards = Math.max(3, Math.floor(stage.nodes.length / 1.5));
        for (let i = 0; i < numHazards; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 80;
          s.hazards.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: 12 + Math.random() * 10, // Variable size asteroids
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 4 // Spinning
          });
        }

        // Start at first node
        const startNodeId = stage.correctPathIds[0];
        s.currentNodeId = startNodeId;
        s.pathIndex = 0;
        s.phase = "ORBIT";
        s.angle = 0;
      }

      // Player graphics
      const pGlow = new PIXI.Graphics();
      const pCore = new PIXI.Graphics();
      playerLayer.addChild(pGlow, pCore);

      function spawnParticles(x: number, y: number, color: number, count = 30, speedMult = 1) {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = (50 + Math.random() * 250) * speedMult;
          s.particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, maxLife: 1, color, size: 3 + Math.random() * 5
          });
        }
      }

      function shoot() {
        if (s.phase !== "ORBIT" || lockedRef.current) return;
        s.phase = "FLIGHT";
        // Calculate velocity based on angle pointing OUTWARD from the node center through the player
        s.player.vx = Math.cos(s.angle) * s.flightSpeed;
        s.player.vy = Math.sin(s.angle) * s.flightSpeed;

        // Kickback particle burst
        spawnParticles(s.player.x, s.player.y, C.playerGlow, 15, 0.5);
      }

      function die() {
        s.phase = "DEAD";
        s.shakeTimer = 0.4;
        spawnParticles(s.player.x, s.player.y, C.hazard, 40, 1.5);
        onIncorrectRef.current();

        // Respawn after delay
        setTimeout(() => {
          if (s.phase === "VICTORY") return;
          s.phase = "ORBIT";
          s.angle = 0; // Reset angle to give them a fresh start
        }, 800);
      }

      // Input Handling (One Tap Anywhere)
      app.canvas.addEventListener("pointerdown", () => shoot());
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
          e.preventDefault();
          shoot();
        }
      });

      // â”€â”€ MAIN LOOP â”€â”€
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;
        const time = ticker.lastTime / 1000;

        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt;
          app.stage.x = (Math.random() - 0.5) * 15;
          app.stage.y = (Math.random() - 0.5) * 15;
        } else {
          app.stage.x = 0; app.stage.y = 0;
        }

        // Draw faint constellation background
        edgeLayer.clear();
        s.edges.forEach(e => {
          const n1 = s.nodes.get(e.from)!;
          const n2 = s.nodes.get(e.to)!;
          edgeLayer.moveTo(n1.x, n1.y).lineTo(n2.x, n2.y).stroke({ width: 2, color: C.pathDim, alpha: 0.3 });
        });

        // Update and Draw Asteroid Hazards
        hazardLayer.clear();
        for (const haz of s.hazards) {
          // Physics
          haz.x += haz.vx * dt;
          haz.y += haz.vy * dt;
          haz.rotation += haz.rotSpeed * dt;

          // Screen wrapping (torus topology)
          if (haz.x > w + 30) haz.x = -30;
          else if (haz.x < -30) haz.x = w + 30;
          if (haz.y > h + 30) haz.y = -30;
          else if (haz.y < -30) haz.y = h + 30;

          // Draw rotating square asteroid (looks dangerous)
          hazardLayer.rect(haz.x - haz.r, haz.y - haz.r, haz.r * 2, haz.r * 2)
                     .fill({ color: C.glass })
                     .stroke({ width: 2, color: C.hazard });

          // Collision Check
          if (s.phase === "FLIGHT") {
            const dist = Math.hypot(s.player.x - haz.x, s.player.y - haz.y);
            if (dist < s.player.r + haz.r) {
              die(); // Crashed into asteroid!
            }
          }
        }

        // Draw Nodes
        s.nodes.forEach((n, id) => {
          n.gfx.clear();

          // Check if it's already completed in the sequence
          const nodeSequenceIndex = stage.correctPathIds.indexOf(id);
          const isCompleted = nodeSequenceIndex !== -1 && nodeSequenceIndex < s.pathIndex;
          const isCurrent = id === s.currentNodeId;
          const isNext = id === stage.correctPathIds[s.pathIndex + 1];

          if (isCompleted) {
            n.gfx.circle(n.x, n.y, 36).fill({ color: C.glass, alpha: 0.9 }).stroke({ width: 3, color: C.target, alpha: 0.6 });
          } else if (isCurrent) {
            n.gfx.circle(n.x, n.y, 36).fill({ color: C.glass, alpha: 0.9 }).stroke({ width: 4, color: C.playerGlow, alpha: 0.8 });
            n.gfx.circle(n.x, n.y, 44).stroke({ width: 2, color: C.playerGlow, alpha: 0.3 + 0.2 * Math.sin(time * 5) }); // pulse
          } else if (isNext) {
            // Give a very subtle hint for the next one, but keep it mostly uniform so they have to read
            n.gfx.circle(n.x, n.y, 36).fill({ color: C.glass, alpha: 0.9 }).stroke({ width: 2, color: C.pathDim });
          } else {
            n.gfx.circle(n.x, n.y, 36).fill({ color: C.glass, alpha: 0.9 }).stroke({ width: 2, color: C.pathDim });
          }
        });

        aimLayer.clear();
        pGlow.clear(); pCore.clear();

        if (s.phase === "ORBIT" && s.currentNodeId) {
          const node = s.nodes.get(s.currentNodeId)!;

          // Orbit Logic
          s.angle += s.orbitSpeed * dt;
          s.player.x = node.x + Math.cos(s.angle) * s.orbitRadius;
          s.player.y = node.y + Math.sin(s.angle) * s.orbitRadius;

          // Draw Aiming Laser
          const aimLength = 150;
          const aimEndX = s.player.x + Math.cos(s.angle) * aimLength;
          const aimEndY = s.player.y + Math.sin(s.angle) * aimLength;

          aimLayer.moveTo(s.player.x, s.player.y).lineTo(aimEndX, aimEndY).stroke({ width: 2, color: C.playerGlow, alpha: 0.4 });
          // Dot at the end
          aimLayer.circle(aimEndX, aimEndY, 3).fill({ color: C.playerGlow, alpha: 0.8 });

        } else if (s.phase === "FLIGHT") {
          // Flight Logic
          s.player.x += s.player.vx * dt;
          s.player.y += s.player.vy * dt;

          // Leave a trail
          if (Math.random() > 0.5) {
            s.particles.push({
              x: s.player.x, y: s.player.y,
              vx: -s.player.vx * 0.1, vy: -s.player.vy * 0.1,
              life: 0.4, maxLife: 0.4, color: C.playerGlow, size: 4
            });
          }

          // Check Collisions with ALL nodes
          let hitNodeId: string | null = null;
          for (const [id, node] of s.nodes.entries()) {
            if (id === s.currentNodeId) continue; // Can't hit the node we just left until we leave its orbit

            const dist = Math.hypot(s.player.x - node.x, s.player.y - node.y);
            if (dist < 36 + s.player.r) { // 36 is node radius
              hitNodeId = id;
              break;
            }
          }

          if (hitNodeId) {
            const expectedNextId = stage.correctPathIds[s.pathIndex + 1];

            if (hitNodeId === expectedNextId) {
              // SUCCESS!
              s.currentNodeId = hitNodeId;
              s.pathIndex++;
              const hitNode = s.nodes.get(hitNodeId)!;

              spawnParticles(hitNode.x, hitNode.y, C.target, 30);
              onCorrectRef.current();

              if (s.pathIndex === stage.correctPathIds.length - 1) {
                // VICTORY!
                s.phase = "VICTORY";
                s.player.x = hitNode.x;
                s.player.y = hitNode.y;
                setTimeout(() => {
                  onCompleteRef.current(stage.correctPathIds);
                }, 800);
              } else {
                // Attach and orbit new node
                s.phase = "ORBIT";
                // Calculate entry angle for smooth transition
                s.angle = Math.atan2(s.player.y - hitNode.y, s.player.x - hitNode.x);
              }
            } else {
              // COGNITIVE FAILURE (Hit Decoy)
              const hitNode = s.nodes.get(hitNodeId)!;
              hitNode.gfx.circle(hitNode.x, hitNode.y, 44).stroke({ width: 4, color: C.hazard, alpha: 0.8 });
              die();
            }
          }

          // Check Out of Bounds (MECHANICAL FAILURE)
          if (s.player.x < -50 || s.player.x > w + 50 || s.player.y < -50 || s.player.y > h + 50) {
            die();
          }
        }

        // Draw Player
        if (s.phase !== "DEAD") {
          const pulse = s.phase === "FLIGHT" ? 0.8 : 0.4 + 0.2 * Math.sin(time * 10);
          pGlow.circle(s.player.x, s.player.y, s.player.r + 6).fill({ color: C.playerGlow, alpha: pulse });
          pCore.circle(s.player.x, s.player.y, s.player.r).fill({ color: C.player }).stroke({ width: 3, color: C.playerGlow });
        }

        // Draw Particles
        particleLayer.clear();
        s.particles = s.particles.filter(p => {
          p.life -= dt;
          if (p.life <= 0) return false;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vy += 200 * dt; // Slight Gravity
          particleLayer.circle(p.x, p.y, p.size * (p.life / p.maxLife)).fill({ color: p.color, alpha: p.life / p.maxLife });
          return true;
        });

      });
    }

    init();
    return () => { destroyed = true; if (appRef.current) appRef.current.destroy(true); };
  }, [stage, onCorrectRef, onIncorrectRef, onCompleteRef]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden border border-white/10 rounded-[1.8rem] shadow-[inset_0_2px_40px_rgba(0,0,0,0.8)] cursor-crosshair" />;
}
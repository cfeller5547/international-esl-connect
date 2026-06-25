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

// Ultra-Premium Minimalist Palette (Vercel/Apple Dark Mode Vibe)
const C = {
  bg: 0x030712, // Slate 950 (Almost black)
  ambientBlue: 0x1e3a8a, // Deep blue for background glowing orbs
  ambientPurple: 0x4c1d95, // Deep purple for background glowing orbs
  ambientCyan: 0x0891b2, // Cyan for background glowing orbs
  
  nodeDim: 0x334155, // Slate 700 (Unvisited node)
  nodeActive: 0xffffff, // Pure white (Current node)
  nodeVisited: 0x10b981, // Emerald 500 (Completed)
  
  lineDim: 0x1e293b, // Slate 800 (Faint path)
  lineActive: 0x38bdf8, // Sky Blue 400 (Glowing path)
  
  player: 0xffffff,
  playerGlow: 0x38bdf8,
  
  hazard: 0xf43f5e, // Rose 400
  hazardGlow: 0xbe123c, // Rose 600
  
  text: 0xf8fafc, // Slate 50
};

export function RouteRaceCanvas({
  stage, locked, onCorrectNode, onIncorrectNode, onPathComplete,
}: RouteRaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  
  const stateRef = useRef({
    initialized: false,
    pathIndex: 0,
    currentNodeId: null as string | null,
    pathIds: [] as string[],
    
    phase: "ORBIT" as "ORBIT" | "FLIGHT" | "DEAD" | "VICTORY",
    angle: 0,
    orbitSpeed: 2.0, // Sleek, calm orbit
    orbitRadius: 42,
    flightSpeed: 1000, // Fast, snappy flight
    
    player: { x: 0, y: 0, vx: 0, vy: 0, r: 8 },
    nodes: new Map<string, { x: number; y: number; label: string; gfx: any }>(),
    edges: [] as Array<{ from: string; to: string; length: number; angle: number }>,
    
    // Ambient blurred orbs in the background
    ambientOrbs: [] as Array<{ x: number; y: number; r: number; color: number; vx: number; vy: number }>,
    
    // Elegant Hazards
    hazards: [] as Array<{ edgeIdx: number; progress: number; speed: number; dir: number; r: number; rotation: number }>,
    
    // High-fidelity particles
    particles: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; size: number; alpha: number }>,
    
    shakeTimer: 0,
    isGameOver: false,
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
      await app.init({ 
        width: w, 
        height: h, 
        backgroundColor: C.bg, 
        antialias: true, 
        resolution: Math.min(window.devicePixelRatio || 1, 2) 
      });
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
      const ambientLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const nodeLayer = new PIXI.Container();
      const hazardLayer = new PIXI.Graphics();
      const aimLayer = new PIXI.Graphics();
      const particleLayer = new PIXI.Graphics();
      const playerLayer = new PIXI.Container();
      app.stage.addChild(ambientLayer, edgeLayer, nodeLayer, hazardLayer, aimLayer, particleLayer, playerLayer);

      // Create Ambient Background Orbs (Premium Apple-like blur effect simulated with low alpha concentric circles)
      if (!s.initialized) {
        s.initialized = true;
        
        s.ambientOrbs.push({ x: w * 0.2, y: h * 0.3, r: 400, color: C.ambientBlue, vx: 10, vy: 5 });
        s.ambientOrbs.push({ x: w * 0.8, y: h * 0.7, r: 500, color: C.ambientPurple, vx: -8, vy: -12 });
        s.ambientOrbs.push({ x: w * 0.5, y: h * 0.5, r: 350, color: C.ambientCyan, vx: -15, vy: 10 });

        // Setup Nodes
        stage.nodes.forEach((node, index) => {
          const px = node.x ? (node.x / 100) * w : (20 + (index % 4) * 20) / 100 * w;
          const py = node.y ? (node.y / 100) * h : (20 + Math.floor(index / 4) * 25) / 100 * h;

          const nGroup = new PIXI.Graphics();
          nodeLayer.addChild(nGroup);

          const lbl = new PIXI.Text({
            text: node.label,
            style: { 
              fontFamily: "Inter, system-ui, sans-serif", 
              fontSize: 14, 
              fontWeight: "600", 
              fill: C.text, 
              wordWrap: true, 
              wordWrapWidth: 80, 
              align: "center", 
              dropShadow: { alpha: 0.5, blur: 4, color: 0x000000, distance: 0 } 
            }
          });
          lbl.anchor.set(0.5);
          lbl.position.set(px, py + 38); // Text slightly below the node for a cleaner look
          nodeLayer.addChild(lbl);

          s.nodes.set(node.id, { x: px, y: py, label: node.label, gfx: nGroup });
        });

        // Setup Edges
        const connections = stage.presentation?.connections || [];
        connections.forEach(conn => {
          const n1 = s.nodes.get(conn.fromId);
          const n2 = s.nodes.get(conn.toId);
          if (n1 && n2) {
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const len = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            s.edges.push({ from: conn.fromId, to: conn.toId, length: len, angle: ang });
            
            // Spawn Hazards (Sleek red diamonds that patrol perpendicular to the line)
            if (len > 120) { // Only put hazards on longer lines so it feels fair
              s.hazards.push({
                edgeIdx: s.edges.length - 1,
                progress: 0, 
                speed: 1.0 + Math.random() * 1.0, // Patrol speed
                dir: Math.random() > 0.5 ? 1 : -1,
                r: 10,
                rotation: 0
              });
            }
          }
        });

        // Start Game
        const startNodeId = stage.correctPathIds[0];
        s.pathIds = [startNodeId];
        s.currentNodeId = startNodeId;
        const startNode = s.nodes.get(startNodeId)!;
        s.player.x = startNode.x;
        s.player.y = startNode.y;
      }

      // Player graphics
      const pTrail = new PIXI.Graphics();
      const pGlow = new PIXI.Graphics();
      const pCore = new PIXI.Graphics();
      playerLayer.addChild(pTrail, pGlow, pCore);

      function spawnParticles(x: number, y: number, color: number, count = 25, speedMult = 1, isExplosion = false) {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = (isExplosion ? 200 + Math.random() * 400 : 50 + Math.random() * 150) * speedMult;
          s.particles.push({
            x, y, 
            vx: Math.cos(a) * sp, 
            vy: Math.sin(a) * sp,
            life: 1, 
            maxLife: isExplosion ? 0.8 : 0.4 + Math.random() * 0.4, 
            color, 
            size: 2 + Math.random() * 4,
            alpha: 1
          });
        }
      }

      function shoot() {
        if (s.phase !== "ORBIT" || lockedRef.current || s.isGameOver) return;
        s.phase = "FLIGHT";
        s.player.vx = Math.cos(s.angle) * s.flightSpeed;
        s.player.vy = Math.sin(s.angle) * s.flightSpeed;
        spawnParticles(s.player.x, s.player.y, C.playerGlow, 15, 0.5);
      }

      function die() {
        s.phase = "DEAD";
        s.shakeTimer = 0.4;
        spawnParticles(s.player.x, s.player.y, C.hazard, 50, 1.2, true); // Violent red shatter
        onIncorrectRef.current();
        
        setTimeout(() => {
          if (s.phase === "VICTORY" || s.isGameOver) return;
          s.phase = "ORBIT";
          s.angle = 0; 
        }, 800);
      }

      // Input Handling
      app.canvas.addEventListener("pointerdown", (e) => {
        if (e.button === 0) shoot(); // Left click / Tap
      });
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") { e.preventDefault(); shoot(); }
      });

      // â”€â”€ MAIN LOOP â”€â”€
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;
        const time = ticker.lastTime / 1000;

        // --- Screen Shake (Premium feel, tight bounds) ---
        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt;
          const intensity = s.shakeTimer * 20;
          app.stage.x = (Math.random() - 0.5) * intensity;
          app.stage.y = (Math.random() - 0.5) * intensity;
        } else {
          app.stage.x = 0; app.stage.y = 0;
        }

        // --- Ambient Background Rendering ---
        ambientLayer.clear();
        for (const orb of s.ambientOrbs) {
          orb.x += orb.vx * dt;
          orb.y += orb.vy * dt;
          
          // Gentle bounce off screen edges
          if (orb.x < 0 || orb.x > w) orb.vx *= -1;
          if (orb.y < 0 || orb.y > h) orb.vy *= -1;

          // Simulate heavy blur by drawing stacked low-alpha circles
          for (let i = 1; i <= 5; i++) {
            ambientLayer.circle(orb.x, orb.y, orb.r * (i * 0.2)).fill({ color: orb.color, alpha: 0.03 / i });
          }
        }

        // --- Elegant Edges ---
        edgeLayer.clear();
        s.edges.forEach(e => {
          const n1 = s.nodes.get(e.from)!;
          const n2 = s.nodes.get(e.to)!;
          
          let isActive = false;
          for (let i = 0; i < s.pathIds.length - 1; i++) {
            if ((s.pathIds[i] === e.from && s.pathIds[i+1] === e.to) || (s.pathIds[i] === e.to && s.pathIds[i+1] === e.from)) {
              isActive = true; break;
            }
          }

          if (isActive) {
            // Glowing active path
            edgeLayer.moveTo(n1.x, n1.y).lineTo(n2.x, n2.y).stroke({ width: 4, color: C.lineActive, alpha: 0.8 });
            edgeLayer.moveTo(n1.x, n1.y).lineTo(n2.x, n2.y).stroke({ width: 12, color: C.lineActive, alpha: 0.2 });
          } else {
            // Crisp, minimal unvisited path
            edgeLayer.moveTo(n1.x, n1.y).lineTo(n2.x, n2.y).stroke({ width: 2, color: C.lineDim, alpha: 0.6 });
          }
        });

        // --- Elegant Nodes ---
        s.nodes.forEach((n, id) => {
          n.gfx.clear();

          const nodeSequenceIndex = stage.correctPathIds.indexOf(id);
          const isCompleted = nodeSequenceIndex !== -1 && nodeSequenceIndex < s.pathIndex;
          const isCurrent = id === s.currentNodeId;

          // Base node shape
          n.gfx.circle(n.x, n.y, 22).fill({ color: C.bg, alpha: 1 });

          if (isCompleted) {
            n.gfx.circle(n.x, n.y, 22).stroke({ width: 3, color: C.nodeVisited, alpha: 0.8 });
            n.gfx.circle(n.x, n.y, 6).fill({ color: C.nodeVisited, alpha: 1 });
          } else if (isCurrent) {
            // Smooth, premium pulse
            const pulse = 1 + 0.15 * Math.sin(time * 4);
            n.gfx.circle(n.x, n.y, 22 * pulse).stroke({ width: 3, color: C.nodeActive, alpha: 1 });
            n.gfx.circle(n.x, n.y, 34 * pulse).stroke({ width: 1, color: C.nodeActive, alpha: 0.3 });
            n.gfx.circle(n.x, n.y, 8).fill({ color: C.nodeActive, alpha: 1 });
          } else {
            // Clean, minimal unvisited state
            n.gfx.circle(n.x, n.y, 22).stroke({ width: 2, color: C.nodeDim, alpha: 1 });
            n.gfx.circle(n.x, n.y, 4).fill({ color: C.nodeDim, alpha: 1 });
          }
        });

        // --- Sleek Hazards (Patrolling Diamonds) ---
        hazardLayer.clear();
        for (const haz of s.hazards) {
          const edge = s.edges[haz.edgeIdx];
          const n1 = s.nodes.get(edge.from)!;
          const n2 = s.nodes.get(edge.to)!;
          
          haz.progress += haz.speed * haz.dir * dt;
          // Swing back and forth across the path perpendicularly
          if (haz.progress > 1) { haz.progress = 1; haz.dir = -1; }
          if (haz.progress < -1) { haz.progress = -1; haz.dir = 1; }
          
          // Center of the edge
          const cx = n1.x + (n2.x - n1.x) * 0.5;
          const cy = n1.y + (n2.y - n1.y) * 0.5;

          // Perpendicular offset (crossing the path)
          const perpAngle = edge.angle + Math.PI / 2;
          const swingDistance = 35; // How far they stray from the line
          
          const hx = cx + Math.cos(perpAngle) * (haz.progress * swingDistance);
          const hy = cy + Math.sin(perpAngle) * (haz.progress * swingDistance);

          haz.rotation += 4 * dt; // Spin rapidly

          // Draw Diamond shape
          const p1x = hx + Math.cos(haz.rotation) * haz.r;
          const p1y = hy + Math.sin(haz.rotation) * haz.r;
          const p2x = hx + Math.cos(haz.rotation + Math.PI/2) * haz.r;
          const p2y = hy + Math.sin(haz.rotation + Math.PI/2) * haz.r;
          const p3x = hx + Math.cos(haz.rotation + Math.PI) * haz.r;
          const p3y = hy + Math.sin(haz.rotation + Math.PI) * haz.r;
          const p4x = hx + Math.cos(haz.rotation + Math.PI*1.5) * haz.r;
          const p4y = hy + Math.sin(haz.rotation + Math.PI*1.5) * haz.r;

          hazardLayer.moveTo(p1x, p1y).lineTo(p2x, p2y).lineTo(p3x, p3y).lineTo(p4x, p4y).lineTo(p1x, p1y)
                     .fill({ color: C.bg })
                     .stroke({ width: 2, color: C.hazard });
          
          // Inner core
          hazardLayer.circle(hx, hy, 3).fill({ color: C.hazardGlow });

          // Hazard Collision
          if (s.phase === "FLIGHT") {
            const dist = Math.hypot(s.player.x - hx, s.player.y - hy);
            if (dist < s.player.r + haz.r - 2) { // -2 for slight forgiveness
              die();
            }
          }
        }

        // --- Player Aim & Flight Logic ---
        aimLayer.clear();
        pGlow.clear(); pCore.clear(); pTrail.clear();

        if (s.phase === "ORBIT" && s.currentNodeId) {
          const node = s.nodes.get(s.currentNodeId)!;
          
          // Orbit Logic
          s.angle += s.orbitSpeed * dt;
          s.player.x = node.x + Math.cos(s.angle) * s.orbitRadius;
          s.player.y = node.y + Math.sin(s.angle) * s.orbitRadius;

          // Crisp Aiming Laser
          const aimLength = 120;
          const aimEndX = s.player.x + Math.cos(s.angle) * aimLength;
          const aimEndY = s.player.y + Math.sin(s.angle) * aimLength;
          
          aimLayer.moveTo(s.player.x, s.player.y).lineTo(aimEndX, aimEndY).stroke({ width: 2, color: C.playerGlow, alpha: 0.5 });
          aimLayer.circle(aimEndX, aimEndY, 3).fill({ color: C.playerGlow, alpha: 0.9 });

        } else if (s.phase === "FLIGHT") {
          // Flight Logic
          s.player.x += s.player.vx * dt;
          s.player.y += s.player.vy * dt;

          // Elegant fading trail
          pTrail.moveTo(s.player.x, s.player.y)
                .lineTo(s.player.x - s.player.vx * 0.08, s.player.y - s.player.vy * 0.08)
                .stroke({ width: s.player.r * 1.5, color: C.playerGlow, alpha: 0.6 })
                .lineTo(s.player.x - s.player.vx * 0.15, s.player.y - s.player.vy * 0.15)
                .stroke({ width: s.player.r * 0.8, color: C.playerGlow, alpha: 0.2 });

          // Subtle flight particles
          if (Math.random() > 0.6) {
            s.particles.push({
              x: s.player.x, y: s.player.y,
              vx: -s.player.vx * 0.1, vy: -s.player.vy * 0.1,
              life: 1, maxLife: 0.3, color: C.playerGlow, size: 2, alpha: 1
            });
          }

          // Node Collision Check
          let hitNodeId: string | null = null;
          for (const [id, node] of s.nodes.entries()) {
            if (id === s.currentNodeId) continue; 
            
            const dist = Math.hypot(s.player.x - node.x, s.player.y - node.y);
            if (dist < 22 + s.player.r) { // 22 is node radius
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
              
              s.shakeTimer = 0.1; // Satisfying thud
              spawnParticles(hitNode.x, hitNode.y, C.nodeVisited, 40, 1.2, true);
              onCorrectRef.current();

              if (s.pathIndex === stage.correctPathIds.length - 1) {
                s.phase = "VICTORY";
                s.isGameOver = true;
                s.player.x = hitNode.x;
                s.player.y = hitNode.y;
                setTimeout(() => onCompleteRef.current(stage.correctPathIds), 600);
              } else {
                s.phase = "ORBIT";
                s.angle = Math.atan2(s.player.y - hitNode.y, s.player.x - hitNode.x);
              }
            } else {
              // COGNITIVE FAILURE (Hit Decoy)
              const hitNode = s.nodes.get(hitNodeId)!;
              hitNode.gfx.circle(hitNode.x, hitNode.y, 35).stroke({ width: 4, color: C.hazard, alpha: 1 });
              die();
            }
          }

          // Out of Bounds
          if (s.player.x < -100 || s.player.x > w + 100 || s.player.y < -100 || s.player.y > h + 100) die();
        }

        // Draw Player Core
        if (s.phase !== "DEAD") {
          const pulse = s.phase === "FLIGHT" ? 1 : 0.6 + 0.3 * Math.sin(time * 15);
          pGlow.circle(s.player.x, s.player.y, s.player.r + 10).fill({ color: C.playerGlow, alpha: pulse * 0.5 });
          pCore.circle(s.player.x, s.player.y, s.player.r).fill({ color: 0xffffff }).stroke({ width: 4, color: C.playerGlow }); // Bright white core
        }

        // Draw Particles
        particleLayer.clear();
        s.particles = s.particles.filter(p => {
          p.life -= dt;
          if (p.life <= 0) return false;
          p.x += p.vx * dt; p.y += p.vy * dt;
          
          // Friction
          p.vx *= 0.95;
          p.vy *= 0.95;

          const alpha = (p.life / p.maxLife) * p.alpha;
          particleLayer.circle(p.x, p.y, p.size * (p.life / p.maxLife)).fill({ color: p.color, alpha });
          return true;
        });

      });
    }

    init();
    return () => { destroyed = true; if (appRef.current) appRef.current.destroy(true); };
  }, [stage, onCorrectRef, onIncorrectRef, onCompleteRef]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full overflow-hidden border border-white/5 rounded-[1.8rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-crosshair select-none" 
      style={{ WebkitTapHighlightColor: 'transparent' }}
    />
  );
}
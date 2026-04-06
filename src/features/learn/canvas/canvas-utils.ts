// ── Color palette (matches app semantic tokens) ──────────────────────────
export const COLORS = {
  bg: "#0f172a",
  bgLight: "#1e293b",
  lane: "rgba(255,255,255,0.03)",
  laneDivider: "rgba(255,255,255,0.06)",
  text: "#f8fafc",
  textMuted: "rgba(248,250,252,0.6)",
  textDim: "rgba(248,250,252,0.35)",
  target: "#34d399",
  targetBg: "rgba(52,211,153,0.12)",
  targetBorder: "rgba(52,211,153,0.4)",
  targetGlow: "rgba(52,211,153,0.25)",
  hazard: "#fb7185",
  hazardBg: "rgba(251,113,133,0.12)",
  hazardBorder: "rgba(251,113,133,0.35)",
  player: "#ffffff",
  playerGlow: "rgba(255,255,255,0.4)",
  correct: "#34d399",
  incorrect: "#f43f5e",
  nearMiss: "#fbbf24",
  combo: "#38bdf8",
  nodeFill: "rgba(255,255,255,0.08)",
  nodeBorder: "rgba(255,255,255,0.15)",
  nodeActive: "#38bdf8",
  pathLine: "rgba(255,255,255,0.1)",
  pathSelected: "#34d399",
  cardBg: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.12)",
  binBg: "rgba(255,255,255,0.04)",
  binBorder: "rgba(255,255,255,0.1)",
  binActive: "rgba(56,189,248,0.15)",
  timerBar: "#38bdf8",
  timerBarLow: "#f43f5e",
} as const;

// ── Drawing helpers ──────────────────────────────────────────────────────

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font?: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    maxWidth?: number;
  } = {}
) {
  ctx.font = options.font ?? "13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = options.color ?? COLORS.text;
  ctx.textAlign = options.align ?? "center";
  ctx.textBaseline = options.baseline ?? "middle";
  if (options.maxWidth) {
    ctx.fillText(text, x, y, options.maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

// ── Math helpers ─────────────────────────────────────────────────────────

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hitTest(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function hitTestCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

// ── Canvas DPI scaling ───────────────────────────────────────────────────

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}

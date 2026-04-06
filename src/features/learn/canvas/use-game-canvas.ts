import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas } from "./canvas-utils";

type GameCanvasOptions = {
  onUpdate: (
    dt: number,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => void;
  onPointerDown?: (x: number, y: number) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerUp?: () => void;
  onKeyDown?: (key: string) => void;
  paused?: boolean;
};

export function useGameCanvas({
  onUpdate,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  paused = false,
}: GameCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const sizeRef = useRef({ width: 800, height: 450 });
  const [size, setSize] = useState({ width: 800, height: 450 });

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width } = entry.contentRect;
      const height = Math.round(width * 0.5625); // 16:9 aspect
      sizeRef.current = { width, height };
      setSize({ width, height });

      const canvas = canvasRef.current;
      if (canvas) {
        ctxRef.current = setupCanvas(canvas, width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Game loop
  useEffect(() => {
    if (paused) return;

    lastTimeRef.current = performance.now();

    function loop(now: number) {
      const dt = Math.min(50, now - lastTimeRef.current) / 1000; // cap at 50ms (20fps min)
      lastTimeRef.current = now;

      const ctx = ctxRef.current;
      const { width, height } = sizeRef.current;

      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        onUpdate(dt, ctx, width, height);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onUpdate, paused]);

  // Pointer events
  const getCanvasPoint = useCallback((e: PointerEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (sizeRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (sizeRef.current.height / rect.height),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handlePointerDown(e: PointerEvent) {
      e.preventDefault();
      const pt = getCanvasPoint(e);
      if (pt && onPointerDown) onPointerDown(pt.x, pt.y);
    }

    function handlePointerMove(e: PointerEvent) {
      const pt = getCanvasPoint(e);
      if (pt && onPointerMove) onPointerMove(pt.x, pt.y);
    }

    function handlePointerUp(e: PointerEvent) {
      e.preventDefault();
      if (onPointerUp) onPointerUp();
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [getCanvasPoint, onPointerDown, onPointerMove, onPointerUp]);

  // Keyboard events
  useEffect(() => {
    if (!onKeyDown) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (onKeyDown) onKeyDown(e.key);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onKeyDown]);

  return { canvasRef, containerRef, width: size.width, height: size.height };
}

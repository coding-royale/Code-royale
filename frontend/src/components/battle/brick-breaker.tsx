"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  AUTO_SERVE_MS,
  BALL_R,
  BOARD_H,
  BOARD_W,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  SPEED_MAX,
  START_LIVES,
  clampPaddle,
  createState,
  reset,
  serve,
  step,
  type EngineState,
} from "@/lib/brick-breaker-engine";

/*
 * A small Brick Breaker to play while the arena is still finding an opponent.
 *
 * Deliberately thin: the rules live in lib/brick-breaker-engine so they can be
 * unit tested, and this file only paints. The game state is a ref, never React
 * state — it sits on top of a screen that is polling for a match and must not
 * compete with that polling, or re-render, sixty times a second.
 */

const DT_MAX = 1 / 30;

export function BrickBreaker({
  className = "",
  title = "Brick breaker",
}: {
  className?: string;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [touched, setTouched] = useState(false);
  const [paused, setPaused] = useState(false);

  const stateRef = useRef<EngineState>(createState(0));
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const frameRef = useRef<((now: number) => void) | null>(null);
  const keysRef = useRef({ left: false, right: false });

  const draw = useCallback((ctx: CanvasRenderingContext2D, g: EngineState) => {
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = "rgba(9, 11, 20, 0.55)";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, BOARD_W - 1, BOARD_H - 1);

    // HUD
    ctx.font = "600 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.fillText(`SCORE ${g.score}`, 10, 17);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
    ctx.fillText(`\u2665 ${g.lives}`, BOARD_W - 10, 17);

    // Bricks
    for (const brick of g.bricks) {
      ctx.globalAlpha = brick.hits > 1 ? 0.45 : 1;
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    }
    ctx.globalAlpha = 1;

    // Paddle
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(g.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);

    // Ball
    ctx.beginPath();
    ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = g.launched ? "#f8fafc" : "rgba(248, 250, 252, 0.6)";
    ctx.fill();

    // Banner
    ctx.textAlign = "center";
    if (g.over) {
      ctx.fillStyle = "rgba(9, 11, 20, 0.72)";
      ctx.fillRect(0, BOARD_H / 2 - 34, BOARD_W, 68);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("GAME OVER", BOARD_W / 2, BOARD_H / 2 - 10);
      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.font = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`FINAL ${g.score} \u00b7 press Space`, BOARD_W / 2, BOARD_H / 2 + 14);
    } else if (pausedRef.current) {
      ctx.fillStyle = "rgba(9, 11, 20, 0.72)";
      ctx.fillRect(0, BOARD_H / 2 - 26, BOARD_W, 52);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 17px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("PAUSED", BOARD_W / 2, BOARD_H / 2);
    } else if (!g.launched) {
      ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
      ctx.font = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("click or press Space to launch", BOARD_W / 2, BOARD_H - 46);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOARD_W * dpr;
    canvas.height = BOARD_H * dpr;
    ctx.scale(dpr, dpr);

    const g = stateRef.current;
    g.autoServeAt = performance.now() + AUTO_SERVE_MS;

    let alive = true;
    let last = 0;

    const frame = (now: number) => {
      if (!alive) return;
      // Clamp dt so a backgrounded tab does not teleport the ball through a
      // brick the moment it wakes up.
      const dt = last ? Math.min((now - last) / 1000, DT_MAX) : 0;
      last = now;

      if (!pausedRef.current) {
        if (keysRef.current.left) clampPaddle(g, g.paddleX - 420 * dt);
        if (keysRef.current.right) clampPaddle(g, g.paddleX + 420 * dt);
        step(g, dt, now);
      }

      draw(ctx, g);
      rafRef.current = requestAnimationFrame(frame);
    };

    frameRef.current = frame;
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [draw]);

  // A hidden tab should cost nothing, and must pick up where it left off.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      } else if (!rafRef.current && frameRef.current) {
        rafRef.current = requestAnimationFrame(frameRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Pointer control, mapped from CSS pixels into the logical board.
  const handlePointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * BOARD_W;
    clampPaddle(stateRef.current, x - PADDLE_W / 2);
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const restart = useCallback(() => {
    reset(stateRef.current, performance.now());
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const handleActivate = useCallback(() => {
    setTouched(true);
    const g = stateRef.current;
    if (g.over) {
      restart();
      return;
    }
    serve(g);
  }, [restart]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const g = stateRef.current;
      const key = event.key;
      if (key === "ArrowLeft" || key === "a" || key === "A") {
        keysRef.current.left = true;
        event.preventDefault();
      }
      if (key === "ArrowRight" || key === "d" || key === "D") {
        keysRef.current.right = true;
        event.preventDefault();
      }
      if (key === " ") {
        event.preventDefault();
        if (g.over) restart();
        else if (pausedRef.current) togglePause();
        else serve(g);
      }
      if (key === "p" || key === "P") togglePause();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "ArrowLeft" || key === "a" || key === "A") keysRef.current.left = false;
      if (key === "ArrowRight" || key === "d" || key === "D") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [restart, togglePause]);

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            Move: mouse / &larr; &rarr;
          </span>
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Resume game" : "Pause game"}
            aria-pressed={paused}
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card/70 text-muted-foreground transition hover:border-accent hover:text-foreground"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        onPointerMove={handlePointer}
        onPointerDown={handleActivate}
        className="block w-full cursor-none touch-none rounded-xl border border-border bg-card/60 shadow-sm"
        style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
        role="img"
        aria-label="Brick breaker mini game. Move the paddle with the mouse or arrow keys, press Space to launch the ball."
      />

      <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {touched ? "space to launch \u00b7 p to pause" : "click the board to play"}
      </p>
    </div>
  );
}

export { SPEED_MAX, START_LIVES };

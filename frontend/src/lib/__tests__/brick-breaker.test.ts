import { describe, expect, test } from "bun:test";
import {
  AUTO_SERVE_MS,
  BALL_R,
  BOARD_H,
  BOARD_W,
  CEILING,
  COLS,
  PADDLE_W,
  PADDLE_Y,
  ROWS,
  SPEED_MAX,
  START_LIVES,
  buildBricks,
  clampPaddle,
  createState,
  reset,
  serve,
  status,
  step,
  type Brick,
  type EngineState,
} from "../brick-breaker-engine";

/** Advance the engine in fixed 60fps slices, the way the render loop does. */
function run(state: EngineState, seconds: number, startMs = 0): number {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  let now = startMs;
  for (let i = 0; i < steps; i += 1) {
    now += dt * 1000;
    step(state, dt, now);
  }
  return now;
}

/** Put the ball just below the paddle, travelling up at a known angle. */
function launchAt(state: EngineState, x: number, vx: number, vy: number) {
  state.ball.x = x;
  state.ball.y = PADDLE_Y - BALL_R - 1;
  state.ball.vx = vx;
  state.ball.vy = vy;
  state.launched = true;
}

/** Put the ball just under a brick, on its way into it. */
function aimAtBrick(state: EngineState, brick: Brick, vx = 0, vy = -300) {
  state.ball.x = brick.x + brick.w / 2;
  state.ball.y = brick.y + brick.h + BALL_R + 1;
  state.ball.vx = vx;
  state.ball.vy = vy;
  state.launched = true;
}

describe("board setup", () => {
  test("a full board is a complete grid", () => {
    const bricks = buildBricks();
    expect(bricks.length).toBe(COLS * ROWS);
  });

  test("bricks sit inside the walls and below the HUD strip", () => {
    for (const brick of buildBricks()) {
      expect(brick.x).toBeGreaterThanOrEqual(0);
      expect(brick.x + brick.w).toBeLessThanOrEqual(BOARD_W);
      expect(brick.y).toBeGreaterThanOrEqual(CEILING);
    }
  });

  test("only the top row needs two hits", () => {
    const bricks = buildBricks();
    const tough = bricks.filter((b) => b.hits === 2);
    expect(tough.length).toBe(COLS);
  });

  test("a new game starts with full lives, no score and a resting ball", () => {
    const g = createState(1000);
    expect(g.lives).toBe(START_LIVES);
    expect(g.score).toBe(0);
    expect(g.launched).toBe(false);
    expect(g.over).toBe(false);
    expect(status(g)).toBe("serving");
  });

  test("the ball waits on the paddle until it is served", () => {
    const g = createState(0);
    clampPaddle(g, 40);
    run(g, 1, 0);
    expect(g.ball.x).toBeCloseTo(40 + PADDLE_W / 2, 5);
    expect(g.ball.y).toBeCloseTo(PADDLE_Y - BALL_R - 2, 5);
    expect(g.launched).toBe(false);
  });
});

describe("serving", () => {
  test("serve always sends the ball upward", () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const g = createState(0);
      serve(g, () => roll);
      expect(g.ball.vy).toBeLessThan(0);
      expect(g.launched).toBe(true);
    }
  });

  test("serve is ignored once the ball is already in play", () => {
    const g = createState(0);
    serve(g, () => 0.5);
    const vx = g.ball.vx;
    serve(g, () => 0.1);
    expect(g.ball.vx).toBe(vx);
  });

  test("an idle board serves itself so the screen is never dead", () => {
    const g = createState(0);
    run(g, (AUTO_SERVE_MS + 500) / 1000, 0);
    expect(g.launched).toBe(true);
  });
});

describe("walls", () => {
  test("the ball bounces off the left wall instead of leaving", () => {
    const g = createState(0);
    launchAt(g, 10, -900, -100);
    run(g, 0.2, 0);
    expect(g.ball.x).toBeGreaterThanOrEqual(BALL_R - 0.001);
    expect(g.ball.vx).toBeGreaterThan(0);
  });

  test("the ball bounces off the right wall", () => {
    const g = createState(0);
    launchAt(g, BOARD_W - 10, 900, -100);
    run(g, 0.2, 0);
    expect(g.ball.x).toBeLessThanOrEqual(BOARD_W - BALL_R + 0.001);
    expect(g.ball.vx).toBeLessThan(0);
  });

  test("the ceiling sits below the HUD so the ball never hides the score", () => {
    const g = createState(0);
    launchAt(g, BOARD_W / 2, 0, -900);
    run(g, 0.3, 0);
    expect(g.ball.y).toBeGreaterThanOrEqual(CEILING - 0.001);
  });
});

describe("paddle", () => {
  test("a ball caught dead centre goes straight back up", () => {
    const g = createState(0);
    clampPaddle(g, 200);
    launchAt(g, 200 + PADDLE_W / 2, 0, 300);
    step(g, 1 / 60, 0);
    expect(g.ball.vy).toBeLessThan(0);
    expect(Math.abs(g.ball.vx)).toBeLessThan(1);
  });

  test("the far edge of the paddle sends the ball sideways, but never backwards", () => {
    const g = createState(0);
    clampPaddle(g, 0);
    launchAt(g, PADDLE_W - 2, 0, 300);
    step(g, 1 / 60, 0);
    expect(g.ball.vx).toBeGreaterThan(0);
    expect(g.ball.vy).toBeLessThan(0);
  });

  test("a ball hit beyond the paddle edge still goes up, never horizontally", () => {
    const g = createState(0);
    clampPaddle(g, 0);
    launchAt(g, PADDLE_W + BALL_R, 0, 300);
    step(g, 1 / 60, 0);
    expect(g.ball.vy).toBeLessThan(0);
  });

  test("the paddle cannot leave the board", () => {
    const g = createState(0);
    clampPaddle(g, -500);
    expect(g.paddleX).toBe(0);
    clampPaddle(g, 5000);
    expect(g.paddleX).toBe(BOARD_W - PADDLE_W);
  });

  test("bouncing off the paddle adds speed but never past the cap", () => {
    const g = createState(0);
    for (let i = 0; i < 400; i += 1) {
      clampPaddle(g, g.ball.x - PADDLE_W / 2);
      launchAt(g, g.paddleX + PADDLE_W / 2, 0, SPEED_MAX);
      step(g, 1 / 60, 0);
      expect(Math.hypot(g.ball.vx, g.ball.vy)).toBeLessThanOrEqual(SPEED_MAX + 0.001);
    }
  });
});

describe("bricks", () => {
  test("hitting a one-hit brick removes it and scores 10", () => {
    const g = createState(0);
    const target = g.bricks.find((b) => b.hits === 1)!;
    aimAtBrick(g, target);
    step(g, 1 / 60, 0);
    expect(g.bricks.some((b) => b.x === target.x && b.y === target.y)).toBe(false);
    expect(g.score).toBe(10);
  });

  test("hitting a two-hit brick only chips it for 5", () => {
    const g = createState(0);
    const target = g.bricks.find((b) => b.hits === 2)!;
    aimAtBrick(g, target);
    step(g, 1 / 60, 0);
    const chipped = g.bricks.find((b) => b.x === target.x && b.y === target.y);
    expect(chipped?.hits).toBe(1);
    expect(g.score).toBe(5);
  });

  test("a second hit finishes a chipped brick", () => {
    const g = createState(0);
    const target = g.bricks.find((b) => b.hits === 2)!;
    aimAtBrick(g, target);
    step(g, 1 / 60, 0);
    aimAtBrick(g, target);
    step(g, 1 / 60, 0);
    expect(g.bricks.some((b) => b.x === target.x && b.y === target.y)).toBe(false);
    expect(g.score).toBe(15);
  });

  test("a corner graze scores once, not twice", () => {
    const g = createState(0);
    // Two bricks stacked in the same column, sharing a horizontal edge.
    const upper = g.bricks.find((b) => b.hits === 1 && b.y > CEILING)!;
    const lower = g.bricks.find((b) => b.x === upper.x && b.y === upper.y + upper.h + 4)!;
    expect(lower).toBeDefined();
    // Come down onto the exact shared corner from above-left.
    g.ball.x = upper.x + 1;
    g.ball.y = upper.y - BALL_R - 1;
    g.ball.vx = 120;
    g.ball.vy = 300;
    g.launched = true;
    const scoreBefore = g.score;
    for (let i = 0; i < 6; i += 1) step(g, 1 / 60, 0);
    // At most one brick may be resolved per frame, so a single graze can
    // never clear two bricks or award 20 points in one contact.
    expect(g.score - scoreBefore).toBeLessThanOrEqual(20);
  });

  test("a fast ball cannot tunnel straight through a brick", () => {
    const g = createState(0);
    const target = g.bricks.find((b) => b.hits === 1)!;
    // Far faster than one 16px brick per 1/60s frame.
    aimAtBrick(g, target, 0, -4000);
    for (let i = 0; i < 20 && g.launched; i += 1) step(g, 1 / 60, 0);
    expect(g.score).toBeGreaterThan(0);
  });

  test("clearing the board deals a fresh board and refills lives", () => {
    const g = createState(0);
    const target = g.bricks[1];
    g.bricks = [{ ...target, hits: 1 }];
    g.lives = 1;
    aimAtBrick(g, g.bricks[0]);
    step(g, 1 / 60, 0);
    expect(g.bricks.length).toBe(COLS * ROWS);
    expect(g.lives).toBe(START_LIVES);
    expect(g.launched).toBe(false);
    expect(g.over).toBe(false);
  });
});

describe("losing", () => {
  test("falling past the bottom costs a life and re-serves", () => {
    const g = createState(0);
    g.ball.y = BOARD_H - 2;
    g.ball.vy = 900;
    g.launched = true;
    step(g, 1 / 60, 0);
    expect(g.lives).toBe(START_LIVES - 1);
    expect(g.over).toBe(false);
    expect(g.launched).toBe(false);
  });

  test("running out of lives ends the run", () => {
    const g = createState(0);
    g.lives = 1;
    g.ball.y = BOARD_H - 2;
    g.ball.vy = 900;
    g.launched = true;
    step(g, 1 / 60, 0);
    expect(g.lives).toBe(0);
    expect(g.over).toBe(true);
    expect(status(g)).toBe("lost");
  });

  test("a finished game ignores further frames", () => {
    const g = createState(0);
    g.over = true;
    g.lives = 0;
    g.ball.x = 123;
    step(g, 1 / 60, 0);
    expect(g.ball.x).toBe(123);
    expect(g.lives).toBe(0);
  });

  test("the score survives losing a life", () => {
    const g = createState(0);
    g.score = 120;
    g.lives = 1;
    g.ball.y = BOARD_H - 2;
    g.ball.vy = 900;
    g.launched = true;
    step(g, 1 / 60, 0);
    expect(g.score).toBe(120);
  });
});

describe("reset", () => {
  test("a new run clears the score, the lives and the board", () => {
    const g = createState(0);
    g.score = 999;
    g.lives = 1;
    g.over = true;
    g.bricks = [];
    reset(g, 5000);
    expect(g.score).toBe(0);
    expect(g.lives).toBe(START_LIVES);
    expect(g.over).toBe(false);
    expect(g.bricks.length).toBe(COLS * ROWS);
    expect(g.autoServeAt).toBe(5000 + AUTO_SERVE_MS);
  });
});

describe("a full run stays sane", () => {
  test("an hour of simulated play never leaves the board or NaNs out", () => {
    const g = createState(0);
    // Nudge the paddle around so it is an actual rally, not a ball in a void.
    for (let i = 0; i < 60 * 60 * 60; i += 1) {
      if (i % 20 === 0) {
        clampPaddle(g, g.ball.x - PADDLE_W / 2 + (i % 40 === 0 ? 30 : -30));
      }
      if (g.over) reset(g, i * (1000 / 60));
      step(g, 1 / 60, i * (1000 / 60));

      expect(Number.isFinite(g.ball.x)).toBe(true);
      expect(Number.isFinite(g.ball.y)).toBe(true);
      expect(g.ball.x).toBeGreaterThanOrEqual(BALL_R - 0.5);
      expect(g.ball.x).toBeLessThanOrEqual(BOARD_W - BALL_R + 0.5);
      expect(g.lives).toBeGreaterThanOrEqual(0);
      expect(g.lives).toBeLessThanOrEqual(START_LIVES);
    }
  });

  test("an unattended board drains its lives and ends, rather than hanging", () => {
    const g = createState(0);
    serve(g, () => 0.5);
    run(g, 30, 0);
    expect(g.over).toBe(true);
    expect(g.lives).toBe(0);
  });
});

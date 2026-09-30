/**
 * Brick Breaker rules, with no DOM in sight.
 *
 * The rendering lives in `components/battle/brick-breaker.tsx`; everything
 * here is pure enough to test, which matters because the game sits on a canvas
 * that is easy to get subtly wrong (a ball that tunnels through a brick, a
 * corner hit that scores twice, a paddle that misses at high speed) and
 * impossible to eyeball reliably.
 *
 * All state is mutated in place: the render loop runs every frame and must not
 * allocate, and a game of this size is far too small for immutability to pay
 * for itself.
 */

export const BOARD_W = 480;
export const BOARD_H = 320;

export const COLS = 9;
export const ROWS = 5;
export const GAP = 4;
export const SIDE = 8;
/** Room for the painted HUD so bricks never collide with the score. */
export const CEILING = 34;
export const BRICK_H = 16;

export const PADDLE_W = 68;
export const PADDLE_H = 10;
export const PADDLE_Y = BOARD_H - 24;

export const BALL_R = 5;
export const SPEED_START = 250;
export const SPEED_MAX = 520;
/** Added per paddle bounce and per brick, so a long rally ramps up. */
export const SPEED_STEP = 9;

export const START_LIVES = 3;
export const AUTO_SERVE_MS = 2600;

export const ROW_COLORS = ["#f472b6", "#fb923c", "#facc15", "#4ade80", "#38bdf8"];

export type Ball = { x: number; y: number; vx: number; vy: number };
export type Brick = { x: number; y: number; w: number; h: number; hits: number; color: string };

export type Status = "serving" | "playing" | "lost";

export type EngineState = {
  ball: Ball;
  paddleX: number;
  bricks: Brick[];
  score: number;
  lives: number;
  launched: boolean;
  over: boolean;
  /** Wall-clock ms at which an untouched ball should serve itself. */
  autoServeAt: number;
};

export function buildBricks(): Brick[] {
  const usable = BOARD_W - SIDE * 2 - GAP * (COLS - 1);
  const bw = usable / COLS;
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      bricks.push({
        x: SIDE + col * (bw + GAP),
        y: CEILING + row * (BRICK_H + GAP),
        w: bw,
        h: BRICK_H,
        // The top row takes two hits, so a cleared board is not instant.
        hits: row === 0 ? 2 : 1,
        color: ROW_COLORS[row % ROW_COLORS.length],
      });
    }
  }
  return bricks;
}

export function createState(nowMs: number = 0): EngineState {
  const paddleX = BOARD_W / 2 - PADDLE_W / 2;
  return {
    ball: { x: paddleX + PADDLE_W / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0 },
    paddleX,
    bricks: buildBricks(),
    score: 0,
    lives: START_LIVES,
    launched: false,
    over: false,
    autoServeAt: nowMs + AUTO_SERVE_MS,
  };
}

export function reset(state: EngineState, nowMs: number = 0): void {
  const fresh = createState(nowMs);
  state.ball = fresh.ball;
  state.paddleX = fresh.paddleX;
  state.bricks = fresh.bricks;
  state.score = 0;
  state.lives = START_LIVES;
  state.launched = false;
  state.over = false;
  state.autoServeAt = fresh.autoServeAt;
}

export function status(state: EngineState): Status {
  if (state.over) return "lost";
  return state.launched ? "playing" : "serving";
}

export function clampPaddle(state: EngineState, x: number): void {
  state.paddleX = Math.max(0, Math.min(BOARD_W - PADDLE_W, x));
}

/** Aim slightly off-centre so rallies are not perfectly vertical. */
export function serve(state: EngineState, random: () => number = Math.random): void {
  if (state.launched || state.over) return;
  const angle = random() * 0.9 - 0.45;
  state.ball.vx = Math.cos(angle) * SPEED_START * 0.7;
  state.ball.vy = -Math.abs(Math.sin(angle) * SPEED_START) - 120;
  state.launched = true;
}

function rescale(ball: Ball, speed: number): void {
  const angle = Math.atan2(ball.vy, ball.vx);
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
}

function loseLife(state: EngineState, nowMs: number): void {
  state.lives -= 1;
  state.launched = false;
  if (state.lives <= 0) {
    state.lives = 0;
    state.over = true;
    return;
  }
  state.ball.x = state.paddleX + PADDLE_W / 2;
  state.ball.y = PADDLE_Y - BALL_R - 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.autoServeAt = nowMs + 800;
}

/**
 * How far the ball may travel in one collision pass, and the ceiling on how
 * many passes a single frame may use.
 *
 * A brick is only 16px tall and the ball can legally move 520px/s, which is
 * ~17px per 30fps frame — enough to jump clean over a brick between collision
 * checks. Slicing the frame into short passes is what stops that, and it is
 * the difference between the game feeling solid and feeling haunted.
 */
const MAX_STEP_DISTANCE = BALL_R;
const SUBSTEP_CAP = 16;

/**
 * Advance one frame. `dt` is already clamped by the caller; `nowMs` is only
 * used for the auto-serve timer.
 *
 * The frame is split into as many collision passes as the ball's speed
 * demands, so a fast ball can never skip a brick or the floor.
 */
export function step(state: EngineState, dt: number, nowMs: number): void {
  if (state.over) return;

  if (!state.launched) {
    if (nowMs >= state.autoServeAt) {
      serve(state);
    } else {
      // Rest on the paddle until served.
      state.ball.x = state.paddleX + PADDLE_W / 2;
      state.ball.y = PADDLE_Y - BALL_R - 2;
      return;
    }
  }

  const speed = Math.hypot(state.ball.vx, state.ball.vy);
  const passes = Math.min(
    SUBSTEP_CAP,
    Math.max(1, Math.ceil((speed * dt) / MAX_STEP_DISTANCE)),
  );
  const passDt = dt / passes;
  for (let i = 0; i < passes; i += 1) {
    advance(state, passDt, nowMs);
    // A pass may have ended the life, cleared the board, or won the game.
    if (state.over || !state.launched) return;
  }
}

function advance(state: EngineState, dt: number, nowMs: number): void {

  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Side walls
  if (ball.x - BALL_R < 0) {
    ball.x = BALL_R;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + BALL_R > BOARD_W) {
    ball.x = BOARD_W - BALL_R;
    ball.vx = -Math.abs(ball.vx);
  }
  // Ceiling sits below the HUD strip.
  if (ball.y - BALL_R < CEILING) {
    ball.y = CEILING + BALL_R;
    ball.vy = Math.abs(ball.vy);
  }

  // Paddle: reflect off the contact point, clamped to a 60 degree cone so a
  // ball caught on the very edge still goes up and not straight sideways.
  const overlapsY = ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R <= PADDLE_Y + PADDLE_H;
  const overlapsX = ball.x >= state.paddleX - BALL_R && ball.x <= state.paddleX + PADDLE_W + BALL_R;
  if (overlapsY && overlapsX && ball.vy > 0) {
    const hit = (ball.x - (state.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
    const clamped = Math.max(-1, Math.min(1, hit));
    const speed = Math.min(SPEED_MAX, Math.hypot(ball.vx, ball.vy) + SPEED_STEP * 0.35);
    const angle = clamped * (Math.PI / 3);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y = PADDLE_Y - BALL_R - 1;
  }

  // Bricks. Only upward-moving balls can reach them, and at most one brick is
  // resolved per frame — otherwise a corner graze breaks two and the ball
  // reverses twice, leaving it inside the wall it just hit.
  if (ball.vy < 0) {
    for (const brick of state.bricks) {
      const hit =
        ball.x + BALL_R > brick.x &&
        ball.x - BALL_R < brick.x + brick.w &&
        ball.y + BALL_R > brick.y &&
        ball.y - BALL_R < brick.y + brick.h;
      if (!hit) continue;

      const overlapLeft = ball.x + BALL_R - brick.x;
      const overlapRight = brick.x + brick.w - (ball.x - BALL_R);
      const overlapTop = ball.y + BALL_R - brick.y;
      const overlapBottom = brick.y + brick.h - (ball.y - BALL_R);
      const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (min === overlapTop || min === overlapBottom) ball.vy = -ball.vy;
      else ball.vx = -ball.vx;
      ball.y -= 1;

      brick.hits -= 1;
      state.score += brick.hits > 0 ? 5 : 10;
      rescale(ball, Math.min(SPEED_MAX, Math.hypot(ball.vx, ball.vy) + SPEED_STEP));
      break;
    }
  }

  if (state.bricks.some((brick) => brick.hits <= 0)) {
    state.bricks = state.bricks.filter((brick) => brick.hits > 0);
  }

  // Cleared board: fresh bricks and a full set of lives, keeping the score.
  if (state.bricks.length === 0) {
    state.bricks = buildBricks();
    state.lives = START_LIVES;
    state.launched = false;
    state.ball.x = state.paddleX + PADDLE_W / 2;
    state.ball.y = PADDLE_Y - BALL_R - 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.autoServeAt = nowMs + AUTO_SERVE_MS;
    return;
  }

  if (ball.y - BALL_R > BOARD_H) loseLife(state, nowMs);
}

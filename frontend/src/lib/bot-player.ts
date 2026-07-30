"use client";

export type BotDifficulty = "easy" | "medium" | "hard";

export type BotConfig = {
  difficulty: BotDifficulty;
  botName: string;
  estimatedSeconds: number;
  codingSpeed: number;
  mistakeChance: number;
  mistakeSeverity: number;
};

export type BotProgress = {
  overallProgress: number;
  stage: "thinking" | "coding" | "debugging" | "testing" | "done";
  code: string;
  statusMessage: string;
  estimatedTimeRemaining: number;
};

const BOT_CONFIGS: Record<BotDifficulty, BotConfig> = {
  easy: {
    difficulty: "easy",
    botName: "Novice Bot",
    estimatedSeconds: 15 * 60,
    codingSpeed: 3,
    mistakeChance: 0.35,
    mistakeSeverity: 0.5,
  },
  medium: {
    difficulty: "medium",
    botName: "Adept Bot",
    estimatedSeconds: 10 * 60,
    codingSpeed: 6,
    mistakeChance: 0.15,
    mistakeSeverity: 0.25,
  },
  hard: {
    difficulty: "hard",
    botName: "Elite Bot",
    estimatedSeconds: 5 * 60,
    codingSpeed: 12,
    mistakeChance: 0.04,
    mistakeSeverity: 0.1,
  },
};

export function getBotConfig(difficulty: BotDifficulty): BotConfig {
  return { ...BOT_CONFIGS[difficulty] };
}

export type BotEvent =
  | { type: "think" }
  | { type: "type"; char: string }
  | { type: "backspace" }
  | { type: "newline" }
  | { type: "mistake"; char: string }
  | { type: "fix" }
  | { type: "compile" }
  | { type: "compile_error" }
  | { type: "debug" }
  | { type: "test" }
  | { type: "test_fail" }
  | { type: "test_pass" }
  | { type: "done" };

export class BotSimulator {
  private config: BotConfig;
  private elapsed = 0;
  private stage: BotProgress["stage"] = "thinking";
  private code = "";
  private codeBuffer: string[] = [];
  private codeIndex = 0;
  private mistakeBuffer = "";
  private inMistake = false;
  private isBackspacing = false;
  private backspaceCount = 0;
  private onProgress: (progress: BotProgress) => void;
  private onDone: () => void;
  private events: BotEvent[] = [];
  private totalTicks: number;
  private currentLineLength = 0;
  private targetCode: string;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    difficulty: BotDifficulty,
    targetCode: string,
    onProgress: (progress: BotProgress) => void,
    onDone: () => void,
  ) {
    this.config = getBotConfig(difficulty);
    this.targetCode = targetCode;
    this.onProgress = onProgress;
    this.onDone = onDone;
    this.totalTicks = this.config.estimatedSeconds;
    this.codeBuffer = targetCode.split("");
  }

  private generateCodeLine(): string {
    const lines = this.targetCode.split("\n");
    return lines[Math.floor(Math.random() * lines.length)] || "  ";
  }

  private getThinkingDuration(): number {
    return this.totalTicks * 0.05;
  }

  private getCodingDuration(): number {
    return this.totalTicks * 0.75;
  }

  private getDebuggingDuration(): number {
    return this.totalTicks * 0.1;
  }

  private getTestingDuration(): number {
    return this.totalTicks * 0.08;
  }

  private advanceStage(): void {
    switch (this.stage) {
      case "thinking":
        this.stage = "coding";
        this.events.push({ type: "think" });
        break;
      case "coding":
        this.stage = "debugging";
        this.events.push({ type: "compile" });
        if (this.config.difficulty !== "hard") {
          this.events.push({ type: "compile_error" });
        }
        break;
      case "debugging":
        this.stage = "testing";
        this.events.push({ type: "test" });
        if (this.config.difficulty === "easy") {
          this.events.push({ type: "test_fail" });
          this.stage = "coding";
        }
        break;
      case "testing":
        this.stage = "done";
        this.events.push({ type: "done" });
        break;
    }
  }

  private getStageProgress(): number {
    const thinkingDuration = this.getThinkingDuration();
    const codingDuration = this.getCodingDuration();
    const debuggingDuration = this.getDebuggingDuration();
    const testingDuration = this.getTestingDuration();

    switch (this.stage) {
      case "thinking":
        return Math.min(this.elapsed / thinkingDuration, 1) * 0.05;
      case "coding":
        return (
          0.05 +
          Math.min(
            (this.elapsed - thinkingDuration) / codingDuration,
            1,
          ) * 0.75
        );
      case "debugging":
        return (
          0.8 +
          Math.min(
            (this.elapsed - thinkingDuration - codingDuration) /
              debuggingDuration,
            1,
          ) * 0.12
        );
      case "testing":
        return (
          0.92 +
          Math.min(
            (this.elapsed -
              thinkingDuration -
              codingDuration -
              debuggingDuration) /
              testingDuration,
            1,
          ) * 0.08
        );
      case "done":
        return 1;
      default:
        return 0;
    }
  }

  private getStatusMessage(): string {
    switch (this.stage) {
      case "thinking":
        const thoughts = [
          "Analyzing problem constraints...",
          "Identifying edge cases...",
          "Planning algorithm approach...",
          "Considering time complexity...",
          "Designing solution structure...",
        ];
        return thoughts[Math.floor(Math.random() * thoughts.length)];
      case "coding":
        const codingMsgs = [
          "Writing solution...",
          "Implementing logic...",
          "Building data structures...",
          "Coding the algorithm...",
        ];
        return codingMsgs[Math.floor(Math.random() * codingMsgs.length)];
      case "debugging":
        const debugMsgs = [
          "Compiling code...",
          "Fixing syntax errors...",
          "Debugging logic...",
          "Refactoring solution...",
          "Optimizing performance...",
        ];
        return debugMsgs[Math.floor(Math.random() * debugMsgs.length)];
      case "testing":
        const testMsgs = [
          "Running test cases...",
          "Validating output...",
          "Checking edge cases...",
          "Verifying solution...",
        ];
        return testMsgs[Math.floor(Math.random() * testMsgs.length)];
      case "done":
        return "Solution complete!";
    }
  }

  private simulateTick(): void {
    this.elapsed++;
    const overallProgress = this.getStageProgress();

    if (this.stage === "thinking") {
      if (overallProgress >= 0.05) {
        this.advanceStage();
      }
    } else if (this.stage === "coding") {
      this.simulateCoding();
      if (overallProgress >= 0.8) {
        this.advanceStage();
      }
    } else if (this.stage === "debugging") {
      this.simulateDebugging();
      if (overallProgress >= 0.92) {
        this.advanceStage();
      }
    } else if (this.stage === "testing") {
      if (overallProgress >= 1) {
        this.advanceStage();
      }
    }

    const estimatedTimeRemaining = Math.max(
      0,
      Math.round(
        this.config.estimatedSeconds * (1 - overallProgress),
      ),
    );

    this.onProgress({
      overallProgress,
      stage: this.stage,
      code: this.code,
      statusMessage: this.getStatusMessage(),
      estimatedTimeRemaining,
    });

    if (this.stage === "done") {
      this.stop();
      this.onDone();
    }
  }

  private simulateCoding(): void {
    if (this.codeIndex >= this.codeBuffer.length) return;

    if (this.inMistake) {
      if (this.isBackspacing) {
        if (this.backspaceCount > 0) {
          this.code = this.code.slice(0, -1);
          this.backspaceCount--;
          this.events.push({ type: "backspace" });
        } else {
          this.isBackspacing = false;
          this.inMistake = false;
          this.mistakeBuffer = "";
        }
      } else {
        this.code += this.mistakeBuffer;
        this.codeIndex += this.mistakeBuffer.length;
        this.events.push({ type: "fix" });
        this.inMistake = false;
        this.mistakeBuffer = "";
      }
      return;
    }

    const speed = this.config.codingSpeed;
    const charsToType = Math.max(1, Math.floor(speed * (0.5 + Math.random())));

    for (let i = 0; i < charsToType && this.codeIndex < this.codeBuffer.length; i++) {
      const nextChar = this.codeBuffer[this.codeIndex];

      if (Math.random() < this.config.mistakeChance) {
        const mistakeChars = "abcdefghijklmnopqrstuvwxyz";
        const wrongChar =
          mistakeChars[Math.floor(Math.random() * mistakeChars.length)];
        this.mistakeBuffer = wrongChar;
        this.code += wrongChar;
        this.events.push({ type: "mistake", char: wrongChar });

        this.isBackspacing = true;
        this.backspaceCount = 1;

        this.inMistake = true;
        return;
      }

      if (nextChar === "\n") {
        this.code += "\n";
        this.currentLineLength = 0;
        this.events.push({ type: "newline" });
      } else {
        this.code += nextChar;
        this.currentLineLength++;
        this.events.push({ type: "type", char: nextChar });
      }

      this.codeIndex++;
    }
  }

  private simulateDebugging(): void {
    if (Math.random() < 0.1) {
      const start = Math.floor(
        Math.random() * this.code.length * 0.5,
      );
      const len = Math.floor(Math.random() * 3) + 1;
      this.code =
        this.code.slice(0, start) +
        this.code.slice(start + len);
      for (let i = 0; i < len; i++) {
        this.events.push({ type: "backspace" });
      }
    }
  }

  start(): void {
    this.tickInterval = setInterval(() => {
      this.simulateTick();
    }, 1000);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  getEvents(): BotEvent[] {
    return this.events;
  }
}

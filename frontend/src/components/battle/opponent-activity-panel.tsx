"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BLOCK_COLORS = [
  { bg: "rgba(56, 189, 248, 0.35)", border: "rgba(56, 189, 248, 0.25)", glow: "rgba(56, 189, 248, 0.15)" },
  { bg: "rgba(167, 139, 250, 0.35)", border: "rgba(167, 139, 250, 0.25)", glow: "rgba(167, 139, 250, 0.15)" },
  { bg: "rgba(251, 191, 36, 0.35)", border: "rgba(251, 191, 36, 0.25)", glow: "rgba(251, 191, 36, 0.15)" },
  { bg: "rgba(52, 211, 153, 0.35)", border: "rgba(52, 211, 153, 0.25)", glow: "rgba(52, 211, 153, 0.15)" },
  { bg: "rgba(248, 113, 113, 0.35)", border: "rgba(248, 113, 113, 0.25)", glow: "rgba(248, 113, 113, 0.15)" },
  { bg: "rgba(96, 165, 250, 0.35)", border: "rgba(96, 165, 250, 0.25)", glow: "rgba(96, 165, 250, 0.15)" },
];

const MAX_BLOCKS = 35;

type Block = {
  id: number;
  width: number;
  color: (typeof BLOCK_COLORS)[number];
  createdAt: number;
};

type OpponentActivityPanelProps = {
  opponentName?: string;
  isVisible?: boolean;
};

export function OpponentActivityPanel({
  opponentName = "Opponent",
  isVisible = true,
}: OpponentActivityPanelProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blockIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addBlock = useCallback(() => {
    const newBlock: Block = {
      id: blockIdRef.current++,
      width: 30 + Math.random() * 70,
      color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
      createdAt: Date.now(),
    };

    setBlocks((prev) => {
      const next = [...prev, newBlock];
      if (next.length > MAX_BLOCKS) {
        return next.slice(next.length - MAX_BLOCKS);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const scheduleNext = () => {
      const delay = 1500 + Math.random() * 3500;
      intervalRef.current = setTimeout(() => {
        addBlock();
        scheduleNext();
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };

    scheduleNext();

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as unknown as number);
        intervalRef.current = null;
      }
    };
  }, [isVisible, addBlock]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500/70 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300/60">
          {opponentName}
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10">
        <span className="text-[9px] uppercase tracking-[0.25em] text-sky-400/30">
          {blocks.length} lines
        </span>
      </div>

      <div className="absolute inset-x-4 bottom-12 top-12 flex flex-col-reverse gap-[3px] overflow-hidden">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="opponent-block shrink-0"
            style={{
              width: `${block.width}%`,
              height: "13px",
              background: `linear-gradient(135deg, ${block.color.bg}, ${block.color.glow})`,
              border: `1px solid ${block.color.border}`,
              boxShadow: `0 0 8px ${block.color.glow}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

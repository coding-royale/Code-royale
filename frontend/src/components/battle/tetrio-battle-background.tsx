"use client";

import { useMemo } from "react";

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function TetrioBattleBackground() {
  const embers = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: `${seededRandom(i * 7 + 1) * 100}%`,
      size: 2 + seededRandom(i * 3 + 5) * 3,
      duration: 6 + seededRandom(i * 11 + 2) * 10,
      delay: seededRandom(i * 13 + 3) * 8,
      bottom: -10 + seededRandom(i * 17 + 4) * 20,
      opacity: 0.3 + seededRandom(i * 19 + 6) * 0.5,
    }));
  }, []);

  return (
    <div className="battle-bg pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="battle-fog" />

      <div className="absolute inset-0 battle-stone-pattern" />

      <div
        className="absolute bottom-0 left-0 right-0 h-[40%]"
        style={{
          background:
            "radial-gradient(ellipse at 30% 100%, rgba(180, 60, 20, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 100%, rgba(180, 60, 20, 0.08) 0%, transparent 55%)",
        }}
      />

      <div
        className="absolute top-0 left-0 right-0 h-[30%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.04) 0%, transparent 60%)",
        }}
      />

      <div suppressHydrationWarning>
        {embers.map((ember) => (
          <div
            key={ember.id}
            className="battle-ember"
            style={{
              left: ember.left,
              width: `${ember.size}px`,
              height: `${ember.size}px`,
              bottom: `${ember.bottom}%`,
              opacity: ember.opacity,
              animationDuration: `${ember.duration}s`,
              animationDelay: `${ember.delay}s`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20% 30%, rgba(56, 189, 248, 0.15), transparent),
            radial-gradient(1px 1px at 80% 20%, rgba(167, 139, 250, 0.12), transparent),
            radial-gradient(1px 1px at 40% 70%, rgba(56, 189, 248, 0.1), transparent),
            radial-gradient(1px 1px at 60% 50%, rgba(167, 139, 250, 0.08), transparent),
            radial-gradient(0.5px 0.5px at 10% 60%, rgba(255, 255, 255, 0.12), transparent),
            radial-gradient(0.5px 0.5px at 90% 40%, rgba(255, 255, 255, 0.1), transparent),
            radial-gradient(0.5px 0.5px at 50% 90%, rgba(255, 255, 255, 0.08), transparent)
          `,
        }}
      />
    </div>
  );
}

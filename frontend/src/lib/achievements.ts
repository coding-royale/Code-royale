export type Achievement = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
};

export type AchievementStats = {
  wins: number;
  losses: number;
  solvedProblems: number;
};

/** Compute the current unlock state of each achievement from real player data. */
export function computeAchievements(stats: AchievementStats): Achievement[] {
  const { wins, losses, solvedProblems } = stats;
  const matchesPlayed = wins + losses;

  return [
    {
      id: "matchmaker",
      name: "Matchmaker",
      description: "Play your first match",
      unlocked: matchesPlayed >= 1,
    },
    {
      id: "first-win",
      name: "First Win",
      description: "Win your first match",
      unlocked: wins >= 1,
    },
    {
      id: "double-digits",
      name: "Double Digits",
      description: "Win 10 matches",
      unlocked: wins >= 10,
    },
    {
      id: "problem-solver",
      name: "Problem Solver",
      description: "Solve your first problem",
      unlocked: solvedProblems >= 1,
    },
    {
      id: "deep-diver",
      name: "Deep Diver",
      description: "Solve 10 problems",
      unlocked: solvedProblems >= 10,
    },
  ];
}
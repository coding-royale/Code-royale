export type TournamentGuidelineSection = {
  title: string;
  items: string[];
};

export const tournamentGuidelines: TournamentGuidelineSection[] = [
  {
    title: "Fair Play",
    items: [
      "Each participant may only compete with one account per tournament. Alt accounts or shared accounts will result in immediate disqualification.",
      "All code submitted must be your own original work, written during the tournament window.",
      "The use of AI code-generation tools (e.g. ChatGPT, Copilot, or similar) to solve tournament problems is strictly prohibited.",
      "Sharing or receiving solutions, hints, or test-case information with other participants during a live tournament is not allowed.",
    ],
  },
  {
    title: "Conduct",
    items: [
      "Treat all participants, organizers, and spectators with respect at all times.",
      "Any form of harassment, hate speech, or toxic behavior in chat, lobbies, or forums will lead to penalties.",
      "Do not disrupt or interfere with other participants' ability to compete (e.g. spamming, DDoS, exploiting bugs).",
      "Publicly discussing or leaking tournament problems before the event officially concludes is forbidden.",
    ],
  },
  {
    title: "Scoring & Submissions",
    items: [
      "Problems are scored based on correctness and time of submission. Faster correct solutions rank higher.",
      "Partial credit may be awarded for solutions that pass a subset of test cases, depending on the tournament format.",
      "Submissions that attempt to exploit the judge system (e.g. hardcoding outputs, time-bomb solutions) will be invalidated.",
      "In the event of a tie, the participant with fewer total submissions (penalty) will be ranked higher.",
    ],
  },
  {
    title: "Penalties",
    items: [
      "First violation: Tournament score is nullified and a temporary ban from future tournaments (duration at organizer discretion).",
      "Second violation: Permanent ban from all Code Royale tournaments and potential account suspension.",
      "Organizers reserve the right to investigate suspicious activity and issue penalties retroactively.",
    ],
  },
];
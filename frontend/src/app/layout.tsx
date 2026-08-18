import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "../components/theme-provider";
import { Navigation } from "../components/navigation";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Code Royale",
  description:
    "Code Royale – a real-time competitive coding arena. Battle rivals, practice algorithms, and climb the leaderboard.",
  icons: {
    icon: "/images/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased`}>
        {/* impeccable:world-key 8130a462 miura-fold
THESIS: Code Royale is one sheet of paper on a night desk — every surface is a fold of the same deployed Miura sheet, never a generic dark dashboard. The category-default arrangement refused: a neon-on-black esports dashboard with glow cards.
OWN-WORLD: near-black warm desk ground; matte paper-white sheets (cards, panels, popovers) as deployed content; gold foil for rating/trophies/primary action; warm-gray mountain creases and pale-blue valley creases as the border and grid language; aerospace spec-mono (JetBrains Mono) for match ids, ratings, timers, and technical labels; a subtle diagonal crease grid rules the desk.
STORY: A visitor understands the whole product as one folded sheet that unfolds into a duel. Rating, trophies, and streaks are gold foil on paper. The match preview, leaderboard, and progress are creased cells of the same sheet.
FIRST VIEWPORT: The landing hero is a folded packet that deploys on load into the match sheet — the matchmaking feed runs as mono ink on paper, the GO foil button is the primary action, a crease grid and valley line rule the frame. Everything else on the page folds out of that sheet.
FORM: replacement world for the whole app, mode operate; seed key 8130a462, build candidate Miura-fold (challenger beat the assigned literal-royale arena on both axes).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance */}
        <ThemeProvider>
          <Navigation />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

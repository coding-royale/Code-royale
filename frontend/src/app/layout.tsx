import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

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
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        {/* Apply the saved theme + accent before first paint so there is no
            light-mode flash on refresh. Runs via the framework head manager,
            not a React-rendered <script>. */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var t = localStorage.getItem('cr_theme');
            var dark = t === 'light' ? false : (t === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true);
            document.documentElement.classList.toggle('dark', dark);
            if (localStorage.getItem('cr_settings_accent') === 'indigo') {
              document.documentElement.dataset.accent = 'indigo';
            }
          } catch (e) {}
        `}</Script>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import ClientInteractions from "../components/ClientInteractions";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Typematter Docs Shell",
  description: "Static-first docs shell with MDX and component semantics.",
};

const themeScript = `
(() => {
  try {
    const key = "typematter-theme";
    const stored = localStorage.getItem(key);
    const mode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const systemDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = mode;
  } catch {
    // ignore
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${ibmPlexSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ClientInteractions />
      </body>
    </html>
  );
}

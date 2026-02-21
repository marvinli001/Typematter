import "./globals.css";
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import ClientInteractions from "../components/ClientInteractions";
import siteConfig from "../site.config";
import { getUiCopy, resolveUiLanguage } from "../lib/i18n/ui-copy";

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

const defaultLanguage = siteConfig.i18n?.defaultLanguage ?? "en";
const defaultUiLanguage = resolveUiLanguage(defaultLanguage);
const defaultCopy = getUiCopy(defaultUiLanguage);
const htmlLang = defaultUiLanguage === "cn" ? "zh-CN" : "en";

export const metadata = {
  title: defaultCopy.metadata.shellTitle,
  description: defaultCopy.metadata.shellDescription,
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
      lang={htmlLang}
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

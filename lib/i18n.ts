import fs from "fs";
import path from "path";
import siteConfig from "../site.config";

export type LanguageOption = {
  code: string;
  label: string;
};

export type I18nConfig = {
  enabled: boolean;
  languages: LanguageOption[];
  defaultLanguage: string | null;
};

const FALLBACK_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "cn", label: "Chinese (Simplified)" },
];

let cachedConfig: I18nConfig | null = null;

function getConfiguredLanguages() {
  const fromConfig = siteConfig.i18n?.languages;
  const source = fromConfig && fromConfig.length > 0 ? fromConfig : FALLBACK_LANGUAGES;
  const seen = new Set<string>();
  const normalized: LanguageOption[] = [];

  source.forEach((lang) => {
    if (!lang?.code || seen.has(lang.code)) {
      return;
    }
    seen.add(lang.code);
    normalized.push({ code: lang.code, label: lang.label ?? lang.code });
  });

  return normalized;
}

export function getI18nConfig(): I18nConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const contentDir = path.join(process.cwd(), "content");
  const configured = getConfiguredLanguages();
  const available = new Set<string>();

  if (fs.existsSync(contentDir)) {
    const entries = fs.readdirSync(contentDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory()) {
        available.add(entry.name);
      }
    });
  }

  const detected = configured.filter((lang) => available.has(lang.code));
  if (detected.length === 0) {
    cachedConfig = { enabled: false, languages: [], defaultLanguage: null };
    return cachedConfig;
  }

  const preferred = siteConfig.i18n?.defaultLanguage;
  const defaultLanguage =
    (preferred && detected.find((lang) => lang.code === preferred)?.code) ??
    detected[0].code;

  cachedConfig = { enabled: true, languages: detected, defaultLanguage };
  return cachedConfig;
}

export function clearI18nCache() {
  cachedConfig = null;
}

export function getLanguageLabel(code: string) {
  const { languages } = getI18nConfig();
  return languages.find((lang) => lang.code === code)?.label ?? code;
}

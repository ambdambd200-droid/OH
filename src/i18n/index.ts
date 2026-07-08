import { en } from "./en.js";
import { ar } from "./ar.js";

export type Lang = "en" | "ar";
export type Translation = typeof en;

const translations: Record<Lang, Translation> = { en, ar };

let currentLang: Lang = "en";

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function t(): Translation {
  return translations[currentLang];
}

export function getLang(): Lang {
  return currentLang;
}

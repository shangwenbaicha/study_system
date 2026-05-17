import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import en from "./locales/en.json";

// 从 localStorage 读取语言设置，默认中文
const savedLang = localStorage.getItem("lang") || "zh";

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
});

export function setLanguage(lang: "zh" | "ja" | "en") {
  localStorage.setItem("lang", lang);
  i18n.changeLanguage(lang);
  // 更新 html lang 属性
  document.documentElement.lang = lang;
}

export default i18n;

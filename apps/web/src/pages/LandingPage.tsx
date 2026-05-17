import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, Video, MessageCircle, Globe, Calendar, ArrowRight } from "lucide-react";
import { setLanguage } from "../i18n";

export default function LandingPage() {
  const { t, i18n } = useTranslation();

  const features = [
    { icon: BookOpen, title: t("nav.wordbook"), desc: "艾宾浩斯记忆曲线 + SM-2 算法，科学背单词" },
    { icon: GraduationCap, title: t("nav.grammar"), desc: "知识点 + 例句 + 自测，系统掌握语法" },
    { icon: Calendar, title: t("nav.exam"), desc: "在线答题、自动批改、错题本，模拟真实考试" },
    { icon: Video, title: t("nav.video"), desc: "上传/嵌入解析视频，边看边学做笔记" },
    { icon: Globe, title: t("nav.translate"), desc: "AI 翻译 + 缓存，支持多语言互译" },
    { icon: MessageCircle, title: t("nav.community"), desc: "学习经验分享，与全球学习者交流" },
  ];

  const currentLang = i18n.language as "zh" | "ja" | "en";

  return (
    <div className="landing-page">
      {/* 导航栏 */}
      <header className="landing-header">
        <div className="landing-logo">📚 {t("app.title")}</div>
        <nav className="landing-nav">
          <div className="lang-switcher">
            <button
              className={`lang-btn ${currentLang === "zh" ? "active" : ""}`}
              onClick={() => setLanguage("zh")}
            >
              中文
            </button>
            <button
              className={`lang-btn ${currentLang === "ja" ? "active" : ""}`}
              onClick={() => setLanguage("ja")}
            >
              日本語
            </button>
            <button
              className={`lang-btn ${currentLang === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
          </div>
          <Link to="/auth" className="btn btn-primary btn-sm">
            {t("auth.login")}
          </Link>
          <Link to="/auth?mode=register" className="btn btn-outline btn-sm">
            {t("auth.register")}
          </Link>
        </nav>
      </header>

      {/* Hero 区域 */}
      <section className="hero">
        <div className="hero-content">
          <h1>{t("app.title")}</h1>
          <p className="hero-subtitle">{t("app.subtitle")}</p>
          <div className="hero-actions">
            <Link to="/auth?mode=register" className="btn btn-primary btn-lg">
              {t("auth.register")} <ArrowRight size={18} />
            </Link>
            <Link to="/auth" className="btn btn-outline btn-lg">
              {t("auth.login")}
            </Link>
          </div>
        </div>
        <div className="hero-illustration">
          <div className="hero-card">
            <div className="hero-card-header">
              <span className="jp-text">日本語</span>
              <span className="en-text">Japanese</span>
            </div>
            <div className="hero-card-body">
              <div className="word-card">
                <span className="word">勉強</span>
                <span className="reading">べんきょう</span>
                <span className="meaning">学习 / study</span>
              </div>
              <div className="word-card">
                <span className="word">言語</span>
                <span className="reading">げんご</span>
                <span className="meaning">语言 / language</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="features">
        <h2>核心功能</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <f.icon size={32} />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 三语支持 */}
      <section className="lang-support">
        <h2>三语界面 · 自由切换</h2>
        <p>支持中文、日本語、English 三种界面语言，满足不同地区用户需求</p>
        <div className="lang-cards">
          <div className="lang-card" onClick={() => setLanguage("zh")}>
            <span className="flag">🇨🇳</span>
            <span>中文</span>
          </div>
          <div className="lang-card" onClick={() => setLanguage("ja")}>
            <span className="flag">🇯🇵</span>
            <span>日本語</span>
          </div>
          <div className="lang-card" onClick={() => setLanguage("en")}>
            <span className="flag">🇺🇸</span>
            <span>English</span>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="landing-footer">
        <p>© 2024 {t("app.title")} · 用邮箱注册即可开始学习</p>
      </footer>
    </div>
  );
}

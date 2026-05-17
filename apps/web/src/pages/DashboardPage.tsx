import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { setLanguage } from "../i18n";
import {
  BookOpen,
  GraduationCap,
  FileText,
  Video,
  Globe,
  MessageCircle,
  Calendar,
  ListTodo,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  User,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";

interface UserInfo {
  id: string;
  email: string;
  displayName: string;
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") ?? "light"
  );
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const currentLang = i18n.language as "zh" | "ja" | "en";

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("workspaceId");
    localStorage.removeItem("user");
    navigate("/");
  };

  const modules = [
    { icon: BookOpen, path: "/wordbook", label: t("nav.wordbook"), color: "#6366f1" },
    { icon: GraduationCap, path: "/grammar", label: t("nav.grammar"), color: "#8b5cf6" },
    { icon: FileText, path: "/exam", label: t("nav.exam"), color: "#ec4899" },
    { icon: Video, path: "/video", label: t("nav.video"), color: "#f59e0b" },
    { icon: Globe, path: "/translate", label: t("nav.translate"), color: "#10b981" },
    { icon: MessageCircle, path: "/community", label: t("nav.community"), color: "#3b82f6" },
    { icon: Calendar, path: "/course", label: t("nav.course"), color: "#ef4444" },
    { icon: ListTodo, path: "/study", label: t("nav.study"), color: "#14b8a6" },
    { icon: Calendar, path: "/agenda", label: t("nav.agenda"), color: "#f97316" },
    { icon: Calendar, path: "/calendar", label: t("nav.calendar"), color: "#06b6d4" },
    { icon: BarChart3, path: "/analytics", label: t("nav.analytics"), color: "#8b5cf6" },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-logo">📚 {t("app.title")}</div>
        <div className="dashboard-actions">
          {/* 用户信息 */}
          {user && (
            <Link to="/profile" className="btn-icon" title={user.displayName}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            </Link>
          )}
          <div className="lang-switcher">
            <button
              className={`lang-btn ${currentLang === "zh" ? "active" : ""}`}
              onClick={() => setLanguage("zh")}
            >
              中
            </button>
            <button
              className={`lang-btn ${currentLang === "ja" ? "active" : ""}`}
              onClick={() => setLanguage("ja")}
            >
              日
            </button>
            <button
              className={`lang-btn ${currentLang === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
          <Link to="/settings" className="btn-icon" title={t("nav.settings") || "设置"}>
            <Settings size={18} />
          </Link>
          <button onClick={toggleTheme} className="btn-icon" title={theme === "light" ? t("common.darkMode") : t("common.lightMode")}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button onClick={handleLogout} className="btn-icon" title={t("auth.logout")}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <h2 className="dashboard-greeting">
          {user ? `👋 ${user.displayName}，${t("nav.core")}` : t("nav.core")}
        </h2>
        <div className="module-grid">
          {modules.map((m, i) => (
            <Link to={m.path} key={i} className="module-card" style={{ borderTopColor: m.color }}>
              <m.icon size={32} color={m.color} />
              <span>{m.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

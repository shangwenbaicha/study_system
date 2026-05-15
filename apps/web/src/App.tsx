import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  Calendar,
  BookOpen,
  ListTodo,
  BarChart3,
  Download,
  Settings,
  Sun,
  Moon,
  Archive,
} from "lucide-react";
import { useState, useEffect } from "react";
import CoursePage from "./pages/course/CoursePage";
import StudyPage from "./pages/study/StudyPage";
import AgendaPage from "./pages/agenda/AgendaPage";
import CalendarPage from "./pages/global/CalendarPage";
import AnalyticsPage from "./pages/global/AnalyticsPage";
import BackupPage from "./pages/global/BackupPage";
import SettingsPage from "./pages/global/SettingsPage";
import ToastContainer from "./components/Toast";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") ?? "light"
  );

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>📚 学习系统</h1>
        <nav>
          <div className="nav-section">核心模块</div>
          <NavLink to="/course" className={({ isActive }) => isActive ? "active" : ""}>
            <Calendar size={16} />
            <span>课程表</span>
          </NavLink>
          <NavLink to="/study" className={({ isActive }) => isActive ? "active" : ""}>
            <BookOpen size={16} />
            <span>学习计划</span>
          </NavLink>
          <NavLink to="/agenda" className={({ isActive }) => isActive ? "active" : ""}>
            <ListTodo size={16} />
            <span>日程安排</span>
          </NavLink>

          <div className="nav-section">全局功能</div>
          <NavLink to="/calendar" className={({ isActive }) => isActive ? "active" : ""}>
            <Calendar size={16} />
            <span>日历总览</span>
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}>
            <BarChart3 size={16} />
            <span>数据分析</span>
          </NavLink>
          <NavLink to="/backup" className={({ isActive }) => isActive ? "active" : ""}>
            <Archive size={16} />
            <span>备份管理</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}>
            <Settings size={16} />
            <span>设置</span>
          </NavLink>
        </nav>

        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "none",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius)",
            color: "var(--text-sidebar)",
            cursor: "pointer",
            fontSize: "0.875rem",
            marginTop: "auto",
          }}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === "light" ? "深色模式" : "浅色模式"}</span>
        </button>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/course" replace />} />
          <Route path="/course" element={<CoursePage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>

  );
}

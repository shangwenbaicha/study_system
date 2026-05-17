import { useState } from "react";
import { Sun, Moon, Palette, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const THEME_COLORS = [
  { primary: "#6366f1", name: "靛蓝" },
  { primary: "#22c55e", name: "翠绿" },
  { primary: "#f59e0b", name: "琥珀" },
  { primary: "#ef4444", name: "赤红" },
  { primary: "#06b6d4", name: "青蓝" },
  { primary: "#ec4899", name: "粉红" },
  { primary: "#8b5cf6", name: "紫色" },
  { primary: "#14b8a6", name: "青绿" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") ?? "light"
  );
  const [primaryColor, setPrimaryColor] = useState(
    () => localStorage.getItem("primary-color") ?? "#6366f1"
  );

  const handleThemeChange = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    localStorage.setItem("primary-color", color);
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--primary-hover", color + "dd");
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>⚙️ 设置</h1>
        </div>
      </div>

      <div className="grid-2">
        {/* Theme */}
        <div className="card">
          <div className="card-header">
            <h2>
              {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
              <span style={{ marginLeft: "0.375rem" }}>主题模式</span>
            </h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className={`btn ${theme === "light" ? "btn-primary" : ""}`}
              onClick={() => handleThemeChange("light")}
            >
              <Sun size={16} /> 浅色模式
            </button>
            <button
              className={`btn ${theme === "dark" ? "btn-primary" : ""}`}
              onClick={() => handleThemeChange("dark")}
            >
              <Moon size={16} /> 深色模式
            </button>
          </div>
        </div>

        {/* Primary Color */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Palette size={16} />
              <span style={{ marginLeft: "0.375rem" }}>主题色</span>
            </h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {THEME_COLORS.map((c) => (
              <div
                key={c.primary}
                style={{ textAlign: "center", cursor: "pointer" }}
                onClick={() => handleColorChange(c.primary)}
              >
                <span
                  className={`color-dot ${primaryColor === c.primary ? "selected" : ""}`}
                  style={{
                    background: c.primary,
                    width: 32,
                    height: 32,
                    borderColor: primaryColor === c.primary ? c.primary : "var(--border)",
                  }}
                />
                <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", color: "var(--text-secondary)" }}>
                  {c.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>关于系统</h2>
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 2 }}>
          <div>📚 学习系统 v2.0</div>
          <div>三大核心模块：课程表 · 学习计划 · 日程安排</div>
          <div>全局功能：日历总览 · 数据分析 · 备份管理</div>
          <div>技术栈：React + TypeScript + Prisma + SQLite</div>
        </div>
      </div>
    </div>
  );
}

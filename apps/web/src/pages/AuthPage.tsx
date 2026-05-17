import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/new-client";

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(
    (searchParams.get("mode") as "login" | "register") || "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "register") {
        result = await authApi.register({ email, password, displayName });
      } else {
        result = await authApi.login({ email, password });
      }
      // 保存 token 和用户信息到 localStorage
      localStorage.setItem("token", result.token);
      if (result.workspaceId) {
        localStorage.setItem("workspaceId", result.workspaceId);
      }
      if (result.user) {
        localStorage.setItem("user", JSON.stringify(result.user));
      }
      // 跳转到 Dashboard
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>📚</h1>
          <h2>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label>{t("auth.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label>{t("auth.displayName")}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>{t("auth.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t("common.loading") : mode === "login" ? t("auth.login") : t("auth.register")}
          </button>
        </form>

        <div className="auth-footer">
          {mode === "login" ? (
            <p>
              {t("auth.noAccount")}{" "}
              <button className="link-btn" onClick={() => setMode("register")}>
                {t("auth.register")}
              </button>
            </p>
          ) : (
            <p>
              {t("auth.hasAccount")}{" "}
              <button className="link-btn" onClick={() => setMode("login")}>
                {t("auth.login")}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

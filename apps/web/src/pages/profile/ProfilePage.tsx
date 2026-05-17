import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { authApi, AuthUser } from "../../api/new-client";

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => navigate("/auth"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("workspaceId");
    localStorage.removeItem("user");
    navigate("/");
  };

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>👤 {t("nav.profile") || "个人中心"}</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              margin: "0 auto 1rem",
            }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <h2>{user.displayName}</h2>
          <p style={{ color: "var(--text-secondary)" }}>{user.email}</p>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "1rem 0" }}>
          <div className="form-group">
            <label>{t("auth.displayName")}</label>
            <input className="form-input" type="text" value={user.displayName} disabled />
          </div>
          <div className="form-group">
            <label>{t("auth.email")}</label>
            <input className="form-input" type="email" value={user.email} disabled />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", paddingTop: "1rem" }}>
          <button className="btn btn-outline" onClick={handleLogout}>
            🚪 {t("auth.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

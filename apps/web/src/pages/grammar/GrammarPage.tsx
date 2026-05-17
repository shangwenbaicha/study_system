import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { grammarApi, GrammarPointDTO } from "../../api/new-client";

export default function GrammarPage() {
  const { t } = useTranslation();
  const [points, setPoints] = useState<GrammarPointDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    grammarApi.list().then(setPoints).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📝 {t("nav.grammar")}</h1>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", padding: "2rem", textAlign: "center" }}>
          语法学习模块已就绪，共 {points.length} 个语法点
        </p>
      </div>
    </div>
  );
}

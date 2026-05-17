import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { examApi, ExamDTO } from "../../api/new-client";

export default function ExamPage() {
  const { t } = useTranslation();
  const [exams, setExams] = useState<ExamDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examApi.list().then(setExams).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📝 {t("nav.exam")}</h1>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", padding: "2rem", textAlign: "center" }}>
          模拟真题模块已就绪，共 {exams.length} 套试卷
        </p>
      </div>
    </div>
  );
}

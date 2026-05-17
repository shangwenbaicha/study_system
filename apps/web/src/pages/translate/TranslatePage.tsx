import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { translateApi } from "../../api/new-client";

export default function TranslatePage() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await translateApi.translate(text, "auto", "zh");
      setResult(res.translatedText);
    } catch (err: any) {
      setResult("翻译失败: " + (err.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>🌐 {t("nav.translate")}</h1>
        </div>
      </div>
      <div className="card">
        <textarea
          className="form-input"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入要翻译的文本..."
          style={{ width: "100%", marginBottom: "1rem" }}
        />
        <button className="btn btn-primary" onClick={handleTranslate} disabled={loading}>
          {loading ? t("common.loading") : "翻译"}
        </button>
        {result && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

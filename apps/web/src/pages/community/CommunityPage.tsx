import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { communityApi, PostDTO } from "../../api/new-client";

export default function CommunityPage() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi.listPosts().then((res) => setPosts(res.posts)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>💬 {t("nav.community")}</h1>
        </div>
      </div>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", padding: "2rem", textAlign: "center" }}>
          社群模块已就绪，共 {posts.length} 个帖子
        </p>
      </div>
    </div>
  );
}

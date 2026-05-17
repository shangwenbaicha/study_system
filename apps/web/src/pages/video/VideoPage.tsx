import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { videoApi, VideoDTO } from "../../api/new-client";

export default function VideoPage() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    videoApi.list().then(setVideos).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>🎬 {t("nav.video")}</h1>
      </div>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", padding: "2rem", textAlign: "center" }}>
          视频学习模块已就绪，共 {videos.length} 个视频
        </p>
      </div>
    </div>
  );
}

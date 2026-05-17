import { useState } from "react";
import { Download, Upload, Archive, FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { backupApi, exportApi } from "../../api/client";


export default function BackupPage() {
  const [scope, setScope] = useState<string>("all");
  const [encrypted, setEncrypted] = useState(false);
  const [importPayload, setImportPayload] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setStatus("正在导出...");
      const result = await backupApi.export(scope, encrypted);
      const blob = new Blob([result], {
        type: encrypted ? "application/octet-stream" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${scope}-${new Date().toISOString().slice(0, 10)}.${encrypted ? "enc" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("导出成功！");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleImport = async () => {
    if (!importPayload.trim()) {
      setError("请粘贴备份内容");
      return;
    }
    try {
      setStatus("正在导入...");
      await backupApi.import(importPayload);
      setStatus("导入成功！");
      setImportPayload("");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleArchive = async () => {
    try {
      setStatus("正在归档...");
      const result = await backupApi.archive(scope);
      setStatus(`归档成功: ${result}`);
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>💾 备份管理</h1>
        </div>
      </div>

      {/* Status Messages */}
      {status && (
        <div className="toast success" style={{ position: "static", marginBottom: "1rem" }}>
          ✅ {status}
        </div>
      )}
      {error && (
        <div className="toast error" style={{ position: "static", marginBottom: "1rem" }}>
          ❌ {error}
        </div>
      )}

      <div className="grid-2">
        {/* Export */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Download size={16} style={{ marginRight: "0.375rem" }} />
              导出备份
            </h2>
          </div>

          <div className="form-group">
            <label>备份范围</label>
            <select
              className="form-select"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">全部数据</option>
              <option value="schedule-course">仅课程表</option>
              <option value="study-plan">仅学习计划</option>
              <option value="daily-agenda">仅日程安排</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={encrypted}
                onChange={(e) => setEncrypted(e.target.checked)}
              />
              加密导出（Base64）
            </label>
          </div>

          <button className="btn btn-primary" onClick={handleExport} style={{ width: "100%" }}>
            <Download size={16} /> 导出备份文件
          </button>
        </div>

        {/* Import */}
        <div className="card">
          <div className="card-header">
            <h2>
              <Upload size={16} style={{ marginRight: "0.375rem" }} />
              导入备份
            </h2>
          </div>

          <div className="form-group">
            <label>粘贴备份内容（JSON 或 Base64）</label>
            <textarea
              className="form-input"
              value={importPayload}
              onChange={(e) => setImportPayload(e.target.value)}
              rows={6}
              placeholder="在此粘贴备份内容..."
              style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
            />
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "1rem" }}>
            ⚠️ 导入将覆盖当前工作区的所有数据
          </div>

          <button className="btn btn-primary" onClick={handleImport} style={{ width: "100%" }}>
            <Upload size={16} /> 导入数据
          </button>
        </div>
      </div>

      {/* PDF Export */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>
            <FileText size={16} style={{ marginRight: "0.375rem" }} />
            PDF 导出
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          将数据导出为 PDF 文档，方便打印和分享
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="form-select"
            id="pdf-module"
            style={{ maxWidth: 160 }}
            defaultValue="schedule-course"
          >
            <option value="schedule-course">课程表</option>
            <option value="study-plan">学习计划</option>
            <option value="daily-agenda">日程安排</option>
          </select>
          <select
            className="form-select"
            id="pdf-range"
            style={{ maxWidth: 120 }}
            defaultValue="week"
          >
            <option value="single">单日</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
            <option value="year">本年</option>
            <option value="report">报告</option>
          </select>
          <select
            className="form-select"
            id="pdf-template"
            style={{ maxWidth: 120 }}
            defaultValue="simple"
          >
            <option value="simple">简洁</option>
            <option value="formal">正式</option>
            <option value="student">学生</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                setStatus("正在生成 PDF...");
                const module = (document.getElementById("pdf-module") as HTMLSelectElement).value as any;
                const range = (document.getElementById("pdf-range") as HTMLSelectElement).value as any;
                const template = (document.getElementById("pdf-template") as HTMLSelectElement).value as any;
                await exportApi.pdf({ module, range, template });
                setStatus("PDF 导出成功！");
                setTimeout(() => setStatus(null), 3000);
              } catch (err: any) {
                setError(err.message);
                setTimeout(() => setError(null), 3000);
              }
            }}
          >
            <FileText size={16} /> 导出 PDF
          </button>
        </div>
      </div>

      {/* Archive */}
      <div className="card" style={{ marginTop: "1.5rem" }}>

        <div className="card-header">
          <h2>
            <Archive size={16} style={{ marginRight: "0.375rem" }} />
            数据归档
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          归档会将当前数据快照保存，方便日后回溯
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select
            className="form-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="all">全部数据</option>
            <option value="schedule-course">仅课程表</option>
            <option value="study-plan">仅学习计划</option>
            <option value="daily-agenda">仅日程安排</option>
          </select>
          <button className="btn btn-primary" onClick={handleArchive}>
            <Archive size={16} /> 创建归档
          </button>
        </div>
      </div>
    </div>
  );
}

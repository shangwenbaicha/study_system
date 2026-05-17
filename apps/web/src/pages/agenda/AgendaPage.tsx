import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Archive, ArrowLeft, CheckCircle } from "lucide-react";
import { agendaApi, type AgendaDTO } from "../../api/client";
import { showToast } from "../../components/Toast";
import { Link } from "react-router-dom";

const CATEGORIES = [
  { value: "work", label: "工作", color: "#6366f1" },
  { value: "study", label: "学习", color: "#22c55e" },
  { value: "health", label: "健康", color: "#f59e0b" },
  { value: "social", label: "社交", color: "#ec4899" },
  { value: "other", label: "其他", color: "#94a3b8" },
] as const;

export default function AgendaPage() {
  const [items, setItems] = useState<AgendaDTO[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AgendaDTO | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
    location: "",
    category: "other" as AgendaDTO["category"],
    tags: "",
    recurrenceRule: "",
    reminderAt: "",
    priority: "medium" as AgendaDTO["priority"],
    note: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await agendaApi.list();
      setItems(data);
    } catch (err) {
      console.error("Failed to load agenda", err);
      showToast("error", "加载日程数据失败: " + (err as Error).message);
    }

  };

  const openCreate = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 3600000);
    setEditing(null);
    setForm({
      title: "",
      startAt: now.toISOString().slice(0, 16),
      endAt: end.toISOString().slice(0, 16),
      location: "",
      category: "other",
      tags: "",
      recurrenceRule: "",
      reminderAt: "",
      priority: "medium",
      note: "",
    });
    setShowModal(true);
  };

  const openEdit = (item: AgendaDTO) => {
    setEditing(item);
    setForm({
      title: item.title,
      startAt: item.startAt.slice(0, 16),
      endAt: item.endAt.slice(0, 16),
      location: item.location ?? "",
      category: item.category,
      tags: item.tags.join(", "),
      recurrenceRule: item.recurrenceRule ?? "",
      reminderAt: item.reminderAt ? item.reminderAt.slice(0, 16) : "",
      priority: item.priority,
      note: item.note ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        title: form.title,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        location: form.location || undefined,
        category: form.category,
        tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
        recurrenceRule: form.recurrenceRule || undefined,
        reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : undefined,
        priority: form.priority,
        note: form.note || undefined,
      };
      if (editing) {
        await agendaApi.update(editing.id, data);
      } else {
        await agendaApi.create(data as any);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save agenda", err);
      showToast("error", "保存日程失败: " + (err as Error).message);
    }

  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除？")) return;
    try {
      await agendaApi.delete(id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete", err);
      showToast("error", "删除日程失败: " + (err as Error).message);
    }

  };

  const handleArchive = async (id: string) => {
    try {
      await agendaApi.archive(id);
      await loadData();
    } catch (err) {
      console.error("Failed to archive", err);
      showToast("error", "归档失败: " + (err as Error).message);
    }

  };

  const handleToggleDone = async (item: AgendaDTO) => {
    try {
      await agendaApi.update(item.id, {
        status: item.status === "done" ? "todo" : "done",
      });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle status", err);
      showToast("error", "更新状态失败: " + (err as Error).message);
    }

  };

  const visibleItems = items.filter((i) => showArchived || !i.archivedAt);
  const activeItems = visibleItems.filter((i) => i.status === "todo");
  const doneItems = visibleItems.filter((i) => i.status === "done");

  const getCategoryInfo = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[4];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📋 日程安排</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={`btn btn-sm ${showArchived ? "btn-primary" : ""}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive size={14} /> {showArchived ? "隐藏归档" : "显示归档"}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> 添加日程
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card stat-card">
          <div className="stat-value">{activeItems.length}</div>
          <div className="stat-label">待办</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{doneItems.length}</div>
          <div className="stat-label">已完成</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: "var(--text-secondary)" }}>
            {items.filter((i) => i.archivedAt).length}
          </div>
          <div className="stat-label">已归档</div>
        </div>
      </div>

      {/* Active Items */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-header">
          <h2>待办事项</h2>
        </div>
        {activeItems.length === 0 ? (
          <div className="empty-state">
            <p>暂无待办事项</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>状态</th>
                <th>标题</th>
                <th>时间</th>
                <th>分类</th>
                <th>优先级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item) => {
                const cat = getCategoryInfo(item.category);
                return (
                  <tr key={item.id}>
                    <td>
                      <button className="btn btn-sm" onClick={() => handleToggleDone(item)}>
                        <CheckCircle size={16} />
                      </button>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.title}</div>
                      {item.location && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          📍 {item.location}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: "0.8rem" }}>
                        {new Date(item.startAt).toLocaleString("zh-CN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${cat.color}20`,
                          color: cat.color,
                        }}
                      >
                        {cat.label}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            item.priority === "high"
                              ? "rgba(239,68,68,0.1)"
                              : item.priority === "medium"
                              ? "rgba(245,158,11,0.1)"
                              : "rgba(100,116,139,0.1)",
                          color:
                            item.priority === "high"
                              ? "var(--danger)"
                              : item.priority === "medium"
                              ? "var(--warning)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button className="btn btn-sm" onClick={() => openEdit(item)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn btn-sm" onClick={() => handleArchive(item.id)}>
                          <Archive size={14} />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Done Items */}
      {doneItems.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>已完成</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>状态</th>
                <th>标题</th>
                <th>时间</th>
                <th>分类</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {doneItems.map((item) => (
                <tr key={item.id} style={{ opacity: 0.6 }}>
                  <td>
                    <button className="btn btn-sm" style={{ color: "var(--success)" }} onClick={() => handleToggleDone(item)}>
                      <CheckCircle size={16} />
                    </button>
                  </td>
                  <td>
                    <span style={{ textDecoration: "line-through" }}>{item.title}</span>
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {new Date(item.startAt).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <span className="badge" style={{ background: "rgba(148,163,184,0.1)", color: "var(--text-secondary)" }}>
                      {getCategoryInfo(item.category).label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "编辑日程" : "添加日程"}</h3>

            <div className="form-group">
              <label>标题</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="日程标题"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>开始时间</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>结束时间</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>地点</label>
                <input
                  className="form-input"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>分类</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AgendaDTO["category"] }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>标签（逗号分隔）</label>
                <input
                  className="form-input"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="标签1, 标签2"
                />
              </div>
              <div className="form-group">
                <label>优先级</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as AgendaDTO["priority"] }))}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>提醒时间</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.reminderAt}
                  onChange={(e) => setForm((f) => ({ ...f, reminderAt: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>重复规则</label>
                <select
                  className="form-select"
                  value={form.recurrenceRule}
                  onChange={(e) => setForm((f) => ({ ...f, recurrenceRule: e.target.value }))}
                >
                  <option value="">不重复</option>
                  <option value="DAILY">每天</option>
                  <option value="WEEKLY">每周</option>
                  <option value="MONTHLY">每月</option>
                  <option value="YEARLY">每年</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea
                className="form-input"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

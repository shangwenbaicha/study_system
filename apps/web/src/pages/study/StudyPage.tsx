import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, CheckCircle, Clock, Play, ArrowLeft } from "lucide-react";
import { studyTaskApi, subjectApi, type StudyTaskDTO, type SubjectDTO } from "../../api/client";
import { showToast } from "../../components/Toast";
import { Link } from "react-router-dom";

const PRIORITY_COLORS: Record<string, string> = {
  high: "var(--danger)",
  medium: "var(--warning)",
  low: "var(--text-secondary)",
};

export default function StudyPage() {
  const [tasks, setTasks] = useState<StudyTaskDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StudyTaskDTO | null>(null);
  const [tab, setTab] = useState<"all" | "todo" | "doing" | "done">("all");
  const [form, setForm] = useState({
    subject: "",
    subjectId: "",
    targetCycle: "",
    plannedMinutes: 60,
    taskDetail: "",
    status: "todo" as StudyTaskDTO["status"],
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    priority: "medium" as StudyTaskDTO["priority"],
    relatedNote: "",
    reviewCycleDays: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, s] = await Promise.all([studyTaskApi.list(), subjectApi.list()]);
      setTasks(t);
      setSubjects(s);
    } catch (err) {
      console.error("Failed to load study data", err);
      showToast("error", "加载学习数据失败: " + (err as Error).message);
    }

  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      subject: "",
      subjectId: "",
      targetCycle: "本周",
      plannedMinutes: 60,
      taskDetail: "",
      status: "todo",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      priority: "medium",
      relatedNote: "",
      reviewCycleDays: 0,
    });
    setShowModal(true);
  };

  const openEdit = (task: StudyTaskDTO) => {
    setEditing(task);
    setForm({
      subject: task.subject,
      subjectId: task.subjectId ?? "",
      targetCycle: task.targetCycle,
      plannedMinutes: task.plannedMinutes,
      taskDetail: task.taskDetail,
      status: task.status,
      startDate: task.startDate,
      dueDate: task.dueDate ?? "",
      priority: task.priority,
      relatedNote: task.relatedNote ?? "",
      reviewCycleDays: task.reviewCycleDays ?? 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        ...form,
        dueDate: form.dueDate || undefined,
        subjectId: form.subjectId || undefined,
        relatedNote: form.relatedNote || undefined,
        reviewCycleDays: form.reviewCycleDays || undefined,
      };
      if (editing) {
        await studyTaskApi.update(editing.id, data);
      } else {
        await studyTaskApi.create(data as any);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save task", err);
      showToast("error", "保存任务失败: " + (err as Error).message);
    }

  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此任务？")) return;
    try {
      await studyTaskApi.delete(id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete task", err);
      showToast("error", "删除任务失败: " + (err as Error).message);
    }

  };

  const handleStatusChange = async (task: StudyTaskDTO, status: StudyTaskDTO["status"]) => {
    try {
      await studyTaskApi.update(task.id, { status });
      await loadData();
    } catch (err) {
      console.error("Failed to update status", err);
      showToast("error", "更新状态失败: " + (err as Error).message);
    }

  };

  const filteredTasks = tasks.filter((t) => tab === "all" || t.status === tab);

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    todo: tasks.filter((t) => t.status === "todo").length,
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📖 学习计划</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> 添加任务
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
        <div className="card stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总任务</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{stats.done}</div>
          <div className="stat-label">已完成</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{stats.doing}</div>
          <div className="stat-label">进行中</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: "var(--text-secondary)" }}>{stats.todo}</div>
          <div className="stat-label">待开始</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(["all", "todo", "doing", "done"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "全部" : t === "todo" ? "待开始" : t === "doing" ? "进行中" : "已完成"}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>状态</th>
              <th>任务</th>
              <th>科目</th>
              <th>计划时长</th>
              <th>日期</th>
              <th>优先级</th>
              <th>番茄钟</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <button
                    className="btn btn-sm"
                    style={{
                      color: t.status === "done" ? "var(--success)" : "var(--text-secondary)",
                    }}
                    onClick={() =>
                      handleStatusChange(
                        t,
                        t.status === "todo" ? "doing" : t.status === "doing" ? "done" : "todo"
                      )
                    }
                    title={
                      t.status === "todo"
                        ? "开始"
                        : t.status === "doing"
                        ? "完成"
                        : "重置"
                    }
                  >
                    {t.status === "done" ? (
                      <CheckCircle size={16} />
                    ) : t.status === "doing" ? (
                      <Play size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </button>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{t.taskDetail}</div>
                  {t.relatedNote && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      📝 {t.relatedNote}
                    </div>
                  )}
                </td>
                <td>
                  <span className="badge badge-primary">{t.subject}</span>
                </td>
                <td>{t.plannedMinutes}分钟</td>
                <td>
                  <div style={{ fontSize: "0.8rem" }}>{t.startDate}</div>
                  {t.dueDate && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      截止: {t.dueDate}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${PRIORITY_COLORS[t.priority]}20`,
                      color: PRIORITY_COLORS[t.priority],
                    }}
                  >
                    {t.priority === "high" ? "高" : t.priority === "medium" ? "中" : "低"}
                  </span>
                </td>
                <td>
                  <span className="badge badge-warning">🍅 {t.pomodoroCount}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button className="btn btn-sm" onClick={() => openEdit(t)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                  暂无学习任务
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "编辑任务" : "添加学习任务"}</h3>

            <div className="form-group">
              <label>任务描述</label>
              <input
                className="form-input"
                value={form.taskDetail}
                onChange={(e) => setForm((f) => ({ ...f, taskDetail: e.target.value }))}
                placeholder="例如：完成第三章复习"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>科目</label>
                <input
                  className="form-input"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="输入科目名称"
                  list="subjects-list"
                />
                <datalist id="subjects-list">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>目标周期</label>
                <input
                  className="form-input"
                  value={form.targetCycle}
                  onChange={(e) => setForm((f) => ({ ...f, targetCycle: e.target.value }))}
                  placeholder="例如：本周、本月"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>计划时长（分钟）</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.plannedMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, plannedMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>优先级</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as StudyTaskDTO["priority"] }))}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>开始日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>截止日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>复习周期（天）</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.reviewCycleDays}
                  onChange={(e) => setForm((f) => ({ ...f, reviewCycleDays: Number(e.target.value) }))}
                  placeholder="0 = 不复习"
                />
              </div>
              <div className="form-group">
                <label>关联笔记</label>
                <input
                  className="form-input"
                  value={form.relatedNote}
                  onChange={(e) => setForm((f) => ({ ...f, relatedNote: e.target.value }))}
                />
              </div>
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

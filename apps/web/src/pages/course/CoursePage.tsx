import { useEffect, useRef, useState } from "react";
import { Plus, Edit3, Trash2, Copy, ChevronLeft, ChevronRight, Download, X, ArrowLeft, BookOpen, ListTodo } from "lucide-react";
import { courseApi, studyTaskApi, agendaApi, exportApi, type CourseDTO, type StudyTaskDTO, type AgendaDTO } from "../../api/client";
import { showToast } from "../../components/Toast";
import { Link } from "react-router-dom";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const TIMEZONES = [
  { value: "Asia/Shanghai" as const, label: "北京时间 (UTC+8)" },
  { value: "Asia/Tokyo" as const, label: "东京时间 (UTC+9)" },
];

const TZ_OFFSET_MINUTES: Record<"Asia/Shanghai" | "Asia/Tokyo", number> = {
  "Asia/Shanghai": 8 * 60,
  "Asia/Tokyo": 9 * 60,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const getTimezoneOffsetMinutes = (timezone: "Asia/Shanghai" | "Asia/Tokyo") =>
  TZ_OFFSET_MINUTES[timezone];

const toTimezoneParts = (isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") => {
  const ms = new Date(isoStr).getTime() + getTimezoneOffsetMinutes(timezone) * 60_000;
  const shifted = new Date(ms);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
};

const toTimezoneDateKey = (isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") => {
  const p = toTimezoneParts(isoStr, timezone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
};

const toTimezoneTimeLabel = (isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") => {
  const p = toTimezoneParts(isoStr, timezone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
};

const dayIndexFromKey = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

const buildIsoFromTimezoneParts = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: "Asia/Shanghai" | "Asia/Tokyo"
) => {
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcMs = localAsUtcMs - getTimezoneOffsetMinutes(timezone) * 60_000;
  return new Date(utcMs).toISOString();
};

export default function CoursePage() {
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [studyTasks, setStudyTasks] = useState<StudyTaskDTO[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaDTO[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CourseDTO | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState<CourseDTO | null>(null);
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [showStudyPanel, setShowStudyPanel] = useState(false);
  const [showAgendaPanel, setShowAgendaPanel] = useState(false);
  const dragNodeRef = useRef<HTMLElement | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const [form, setForm] = useState({
    courseName: "",
    teacher: "",
    startDate: "",
    startTime: "09:00",
    endTime: "10:00",
    timezone: "Asia/Shanghai" as "Asia/Shanghai" | "Asia/Tokyo",
    color: "#6366f1",
    note: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const c = await courseApi.list();
      setCourses(c);
    } catch (err) {
      console.error("Failed to load courses", err);
      showToast("error", "加载课程数据失败: " + (err as Error).message);
    }
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const getCoursesForDay = (day: number) => {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    return courses.filter((c) => toTimezoneDateKey(c.startAt, c.timezone) === dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openCreate = (day?: number) => {
    setEditing(null);
    const d = day ?? today.getDate();
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    setForm({
      courseName: "",
      teacher: "",
      startDate: dateStr,
      startTime: "09:00",
      endTime: "10:00",
      timezone: "Asia/Shanghai",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      note: "",
    });
    setShowModal(true);
  };

  const openEdit = (course: CourseDTO) => {
    setEditing(course);
    const start = toTimezoneParts(course.startAt, course.timezone);
    const end = toTimezoneParts(course.endAt, course.timezone);

    setForm({
      courseName: course.courseName,
      teacher: course.teacher,
      startDate: `${start.year}-${pad2(start.month)}-${pad2(start.day)}`,
      startTime: `${pad2(start.hour)}:${pad2(start.minute)}`,
      endTime: `${pad2(end.hour)}:${pad2(end.minute)}`,
      timezone: course.timezone,
      color: course.color,
      note: course.note ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const [sy, sm, sd] = form.startDate.split("-").map(Number);
      const [sh, smin] = form.startTime.split(":").map(Number);
      const [eh, emin] = form.endTime.split(":").map(Number);
      const startAt = buildIsoFromTimezoneParts(sy, sm, sd, sh, smin, 0, form.timezone);
      const endAt = buildIsoFromTimezoneParts(sy, sm, sd, eh, emin, 0, form.timezone);

      if (editing) {
        await courseApi.update(editing.id, {
          courseName: form.courseName,
          teacher: form.teacher,
          startAt,
          endAt,
          timezone: form.timezone,
          color: form.color,
          note: form.note || undefined,
        });
      } else {
        await courseApi.create({
          courseName: form.courseName,
          teacher: form.teacher,
          startAt,
          endAt,
          timezone: form.timezone,
          color: form.color,
          note: form.note || undefined,
        });
      }

      setShowModal(false);
      await loadData();
      showToast("success", editing ? "课程已更新" : "课程已添加");
    } catch (err) {
      console.error("Failed to save course", err);
      showToast("error", "保存课程失败: " + (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这门课程吗？")) return;
    try {
      await courseApi.delete(id);
      await loadData();
      showToast("success", "课程已删除");
    } catch (err) {
      console.error("Failed to delete course", err);
      showToast("error", "删除课程失败");
    }
  };

  const openCopy = (course: CourseDTO) => {
    setCopySource(course);
    setCopyTargetDates([]);
    setShowCopyModal(true);
  };

  const toggleCopyDate = (dateStr: string) => {
    setCopyTargetDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleCopy = async () => {
    if (!copySource || copyTargetDates.length === 0) return;

    try {
      const sourceStart = new Date(copySource.startAt);
      const sourceEnd = new Date(copySource.endAt);
      const duration = sourceEnd.getTime() - sourceStart.getTime();
      const sourceParts = toTimezoneParts(copySource.startAt, copySource.timezone);

      for (const targetDateStr of copyTargetDates) {
        const [y, m, d] = targetDateStr.split("-").map(Number);
        const newStartAt = buildIsoFromTimezoneParts(
          y,
          m,
          d,
          sourceParts.hour,
          sourceParts.minute,
          sourceParts.second,
          copySource.timezone
        );
        const newEndAt = new Date(new Date(newStartAt).getTime() + duration).toISOString();

        await courseApi.create({
          courseName: copySource.courseName,
          teacher: copySource.teacher,
          startAt: newStartAt,
          endAt: newEndAt,
          timezone: copySource.timezone,
          color: copySource.color,
          note: copySource.note ?? undefined,
        });
      }

      setShowCopyModal(false);
      setCopySource(null);
      setCopyTargetDates([]);
      await loadData();
      showToast("success", `已复制到 ${copyTargetDates.length} 天`);
    } catch (err) {
      console.error("Failed to copy courses", err);
      showToast("error", "复制课程失败: " + (err as Error).message);
    }
  };

  const handleDragStart = (course: CourseDTO, evt: React.DragEvent) => {
    dragNodeRef.current = evt.currentTarget as HTMLElement;
    evt.dataTransfer.effectAllowed = "move";
    evt.dataTransfer.setData("text/plain", JSON.stringify(course));
    (evt.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
      dragNodeRef.current = null;
    }
    setDragOverDay(null);
  };

  const handleDragOver = (day: number, evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "move";
    setDragOverDay(day);
  };

  const handleDragLeave = (evt: React.DragEvent<HTMLDivElement>) => {
    const relatedNode = evt.relatedTarget as Node | null;
    if (relatedNode && evt.currentTarget.contains(relatedNode)) return;
    setDragOverDay(null);
  };

  const handleDrop = async (targetDay: number, evt: React.DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (isDropping) return;
    setDragOverDay(null);

    const rawData = evt.dataTransfer.getData("text/plain");
    if (!rawData) return;

    let course: CourseDTO;
    try {
      course = JSON.parse(rawData) as CourseDTO;
    } catch {
      return;
    }
    if (!course || !course.id) return;

    const targetDateStr = `${year}-${pad2(month + 1)}-${pad2(targetDay)}`;
    const sourceDateStr = toTimezoneDateKey(course.startAt, course.timezone);
    const dayDelta = dayIndexFromKey(targetDateStr) - dayIndexFromKey(sourceDateStr);
    if (dayDelta === 0) return;

    const oldStart = new Date(course.startAt);
    const oldEnd = new Date(course.endAt);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const sourceStartParts = toTimezoneParts(course.startAt, course.timezone);
    const sourceDayMs = Date.UTC(sourceStartParts.year, sourceStartParts.month - 1, sourceStartParts.day);
    const targetDayByDelta = new Date(sourceDayMs + dayDelta * 86_400_000);

    const nextStartAt = buildIsoFromTimezoneParts(
      targetDayByDelta.getUTCFullYear(),
      targetDayByDelta.getUTCMonth() + 1,
      targetDayByDelta.getUTCDate(),
      sourceStartParts.hour,
      sourceStartParts.minute,
      sourceStartParts.second,
      course.timezone
    );
    const nextEndAt = new Date(new Date(nextStartAt).getTime() + durationMs).toISOString();

    try {
      setIsDropping(true);
      await courseApi.update(course.id, {
        startAt: nextStartAt,
        endAt: nextEndAt,
      });

      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id ? { ...c, startAt: nextStartAt, endAt: nextEndAt } : c
        )
      );

      await loadData();
      showToast("success", `课程已移动到 ${targetDateStr}`);
    } catch (err) {
      console.error("Failed to move course", err);
      showToast("error", "移动课程失败: " + (err as Error).message);
    } finally {
      setIsDropping(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportApi.pdf({
        module: "schedule-course",
        range: "month",
        template: "simple",
        year,
        month: month + 1,
      });
      showToast("success", "PDF 导出成功");
    } catch (err) {
      showToast("error", "PDF 导出失败: " + (err as Error).message);
    }
  };

  const formatTime = (isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") =>
    toTimezoneTimeLabel(isoStr, timezone);

  const getDuration = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}分钟`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const getTimezoneLabel = (tz: string) => (tz === "Asia/Shanghai" ? "北京时间" : "东京时间");

  // 加载学习计划和日程数据
  const loadStudyAndAgenda = async () => {
    try {
      const [tasks, items] = await Promise.all([
        studyTaskApi.list(),
        agendaApi.list(),
      ]);
      setStudyTasks(tasks);
      setAgendaItems(items);
    } catch (err) {
      console.error("Failed to load study/agenda data", err);
    }
  };

  useEffect(() => {
    loadStudyAndAgenda();
  }, []);

  // 当月学习任务
  const monthTasks = studyTasks.filter((t) => {
    const d = new Date(t.startDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // 当月日程
  const monthAgenda = agendaItems.filter((i) => {
    const d = new Date(i.startAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>课程表</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/study" className="btn btn-sm" title="学习计划">
            <BookOpen size={14} /> 学习计划
          </Link>
          <Link to="/agenda" className="btn btn-sm" title="日程安排">
            <ListTodo size={14} /> 日程安排
          </Link>
          <button className="btn btn-sm" onClick={handleExportPdf}>
            <Download size={14} /> 导出PDF
          </button>
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <Plus size={16} /> 添加课程
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <button className="btn btn-sm" onClick={prevMonth}>
          <ChevronLeft size={16} />
        </button>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          {year}年{month + 1}月
        </h2>
        <button className="btn btn-sm" onClick={nextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="day-header">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="day-cell other-month" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayCourses = getCoursesForDay(day);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;

          return (
            <div
              key={day}
              className={`day-cell ${isToday ? "today" : ""} ${dragOverDay === day ? "drag-over" : ""}`}
              onDoubleClick={() => openCreate(day)}
              onDragOver={(evt) => handleDragOver(day, evt)}
              onDragLeave={(evt) => handleDragLeave(evt)}
              onDrop={(evt) => handleDrop(day, evt)}
            >
              <div className="day-number" draggable={false}>
                {day}
              </div>

              {dayCourses.map((c) => (
                <div
                  key={c.id}
                  className="course-event"
                  style={{ background: c.color }}
                  onClick={() => openEdit(c)}
                  title={`${c.courseName}\n老师: ${c.teacher}\n${formatTime(c.startAt, c.timezone)}-${formatTime(c.endAt, c.timezone)}\n时长: ${getDuration(c.startAt, c.endAt)}`}
                  draggable
                  onDragStart={(evt) => handleDragStart(c, evt)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    className="course-event-delete-btn"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      handleDelete(c.id);
                    }}
                    title="删除课程"
                  >
                    <X size={10} />
                  </button>
                  <span className="course-event-title">{c.courseName}</span>
                  <span className="course-event-time">
                    {formatTime(c.startAt, c.timezone)}-{formatTime(c.endAt, c.timezone)}
                  </span>
                  <span className="course-event-teacher">👨‍🏫 {c.teacher}</span>
                  <span className="course-event-duration">⏱ {getDuration(c.startAt, c.endAt)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>课程列表</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            共 {courses.length} 门课程
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>课程</th>
              <th>老师</th>
              <th>日期</th>
              <th>时间</th>
              <th>时区</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="color-dot" style={{ background: c.color, borderColor: c.color }} />
                    {c.courseName}
                  </span>
                </td>
                <td>{c.teacher}</td>
                <td>{toTimezoneDateKey(c.startAt, c.timezone)}</td>
                <td>
                  {formatTime(c.startAt, c.timezone)} - {formatTime(c.endAt, c.timezone)}
                </td>
                <td>
                  <span className="badge badge-primary">{getTimezoneLabel(c.timezone)}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button className="btn btn-sm" onClick={() => openEdit(c)} title="编辑">
                      <Edit3 size={14} />
                    </button>
                    <button className="btn btn-sm" onClick={() => openCopy(c)} title="复制到其他日期">
                      <Copy size={14} />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                  暂无课程，点击右上角添加，或双击日历日期快速创建。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "编辑课程" : "添加课程"}</h3>

            <div className="grid-2">
              <div className="form-group">
                <label>课程名称</label>
                <input
                  className="form-input"
                  value={form.courseName}
                  onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
                  placeholder="例如：日语会话"
                />
              </div>
              <div className="form-group">
                <label>任课老师</label>
                <input
                  className="form-input"
                  value={form.teacher}
                  onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))}
                  placeholder="老师姓名"
                />
              </div>
            </div>

            <div className="form-group">
              <label>日期</label>
              <input
                type="date"
                className="form-input"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>开始时间</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>结束时间</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>时区</label>
              <select
                className="form-select"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value as "Asia/Shanghai" | "Asia/Tokyo" }))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>课程颜色</label>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {COLORS.map((color) => (
                  <span
                    key={color}
                    className={`color-dot ${form.color === color ? "selected" : ""}`}
                    style={{ background: color }}
                    onClick={() => setForm((f) => ({ ...f, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>备注</label>
              <input
                className="form-input"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="可选备注信息"
              />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 学习计划面板 */}
      {showStudyPanel && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <h2>
              <BookOpen size={16} style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              学习计划
            </h2>
            <Link to="/study" className="btn btn-sm">
              查看全部
            </Link>
          </div>
          {monthTasks.length === 0 ? (
            <div className="empty-state">
              <p>本月暂无学习任务</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>科目</th>
                  <th>时长</th>
                  <th>日期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {monthTasks.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.taskDetail}</td>
                    <td><span className="badge badge-primary">{t.subject}</span></td>
                    <td>{t.plannedMinutes}分钟</td>
                    <td style={{ fontSize: "0.8rem" }}>{t.startDate}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            t.status === "done"
                              ? "rgba(34,197,94,0.1)"
                              : t.status === "doing"
                              ? "rgba(245,158,11,0.1)"
                              : "rgba(148,163,184,0.1)",
                          color:
                            t.status === "done"
                              ? "var(--success)"
                              : t.status === "doing"
                              ? "var(--warning)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {t.status === "done" ? "已完成" : t.status === "doing" ? "进行中" : "待开始"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 日程安排面板 */}
      {showAgendaPanel && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <h2>
              <ListTodo size={16} style={{ marginRight: "0.5rem", color: "var(--warning)" }} />
              日程安排
            </h2>
            <Link to="/agenda" className="btn btn-sm">
              查看全部
            </Link>
          </div>
          {monthAgenda.length === 0 ? (
            <div className="empty-state">
              <p>本月暂无日程安排</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>时间</th>
                  <th>分类</th>
                  <th>优先级</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {monthAgenda.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {new Date(item.startAt).toLocaleString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="badge" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                        {item.category === "work" ? "工作" : item.category === "study" ? "学习" : item.category === "health" ? "健康" : item.category === "social" ? "社交" : "其他"}
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
                      <span
                        className="badge"
                        style={{
                          background: item.status === "done" ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.1)",
                          color: item.status === "done" ? "var(--success)" : "var(--text-secondary)",
                        }}
                      >
                        {item.status === "done" ? "已完成" : "待办"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showCopyModal && copySource && (
        <div className="modal-overlay" onClick={() => setShowCopyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <h3>复制课程到其他日期</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              来源：<strong>{copySource.courseName}</strong>（{toTimezoneDateKey(copySource.startAt, copySource.timezone)}）
              <br />
              选择要复制到的日期（可多选），课程时间会自动沿用原课程。
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "4px",
                maxHeight: "300px",
                overflowY: "auto",
                marginBottom: "1rem",
              }}
            >
              {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
                const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
                const isSelected = copyTargetDates.includes(dateStr);
                const isSource = dateStr === toTimezoneDateKey(copySource.startAt, copySource.timezone);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`btn btn-sm ${isSelected ? "btn-primary" : ""}`}
                    style={{
                      padding: "0.5rem",
                      opacity: isSource ? 0.4 : 1,
                      cursor: isSource ? "not-allowed" : "pointer",
                    }}
                    disabled={isSource}
                    onClick={() => !isSource && toggleCopyDate(dateStr)}
                    title={isSource ? "来源日期" : dateStr}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCopyModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCopy} disabled={copyTargetDates.length === 0}>
                复制到 {copyTargetDates.length} 天
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

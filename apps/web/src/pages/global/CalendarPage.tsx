import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { calendarApi, courseApi, studyTaskApi, agendaApi, type CalendarEventDTO } from "../../api/client";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MODULE_OPTIONS = [
  { value: "schedule-course", label: "课程", color: "#6366f1" },
  { value: "study-plan", label: "学习", color: "#22c55e" },
  { value: "daily-agenda", label: "日程", color: "#f59e0b" },
] as const;

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "schedule-course",
    "study-plan",
    "daily-agenda",
  ]);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEventDTO | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadEvents();
  }, [currentDate, selectedModules]);

  const loadEvents = async () => {
    try {
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const data = await calendarApi.events(selectedModules, from, to);
      setEvents(data);
    } catch (err) {
      console.error("Failed to load calendar events", err);
    }
  };

  const toggleModule = (module: string) => {
    setSelectedModules((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.startAt.startsWith(dateStr));
  };

  const getModuleColor = (module: string) => {
    const opt = MODULE_OPTIONS.find((m) => m.value === module);
    return opt?.color ?? "#94a3b8";
  };

  const getModuleLabel = (module: string) => {
    const opt = MODULE_OPTIONS.find((m) => m.value === module);
    return opt?.label ?? module;
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getDuration = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}分钟`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  // ============================================================
  // 删除事件
  // ============================================================
  const handleDeleteEvent = async (e: CalendarEventDTO, evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (!confirm(`确定要删除「${e.title}」吗？`)) return;
    try {
      if (e.sourceModule === "schedule-course") {
        await courseApi.delete(e.metaRefId);
      } else if (e.sourceModule === "study-plan") {
        await studyTaskApi.delete(e.metaRefId);
      } else if (e.sourceModule === "daily-agenda") {
        await agendaApi.delete(e.metaRefId);
      }
      await loadEvents();
    } catch (err) {
      console.error("Failed to delete event", err);
      alert("删除失败，请重试");
    }
  };

  // ============================================================
  // 拖拽事件
  // ============================================================
  const handleDragStart = (event: CalendarEventDTO, evt: React.DragEvent) => {
    setDraggedEvent(event);
    evt.dataTransfer.effectAllowed = "move";
    evt.dataTransfer.setData("text/plain", JSON.stringify(event));
    // 让拖拽时显示半透明
    (evt.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (evt: React.DragEvent) => {
    (evt.target as HTMLElement).style.opacity = "1";
    setDraggedEvent(null);
    setDragOverDay(null);
  };

  const handleDragOver = (day: number, evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "move";
    setDragOverDay(day);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = async (targetDay: number, evt: React.DragEvent) => {
    evt.preventDefault();
    setDragOverDay(null);
    const eventData = draggedEvent;
    if (!eventData) return;

    // 计算目标日期的 ISO 字符串
    const targetDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
    const oldStart = new Date(eventData.startAt);
    const oldEnd = new Date(eventData.endAt);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    // 新日期保持相同时间
    const newStart = new Date(targetDateStr);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
    const newEnd = new Date(newStart.getTime() + durationMs);

    try {
      if (eventData.sourceModule === "schedule-course") {
        await courseApi.update(eventData.metaRefId, {
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        });
      } else if (eventData.sourceModule === "study-plan") {
        // 学习任务只更新 startDate（日期部分）
        await studyTaskApi.update(eventData.metaRefId, {
          startDate: targetDateStr,
        });
      } else if (eventData.sourceModule === "daily-agenda") {
        await agendaApi.update(eventData.metaRefId, {
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        });
      }
      await loadEvents();
    } catch (err) {
      console.error("Failed to move event", err);
      alert("移动失败，请重试");
    }
  };

  // ============================================================
  // 复制粘贴事件
  // ============================================================
  const handleCopyEvent = async (event: CalendarEventDTO, evt: React.MouseEvent) => {
    evt.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(event));
      // 简单视觉反馈
      const target = evt.currentTarget as HTMLElement;
      target.style.outline = "2px solid var(--primary)";
      setTimeout(() => { target.style.outline = ""; }, 500);
    } catch (err) {
      console.error("Failed to copy event", err);
    }
  };

  const handlePasteEvent = async (targetDay: number, evt: React.ClipboardEvent) => {
    evt.preventDefault();
    const text = evt.clipboardData.getData("text/plain");
    try {
      const parsed = JSON.parse(text) as CalendarEventDTO;
      if (!parsed.sourceModule || !parsed.title) return;

      const targetDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
      const oldStart = new Date(parsed.startAt);
      const oldEnd = new Date(parsed.endAt);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStart = new Date(targetDateStr);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
      const newEnd = new Date(newStart.getTime() + durationMs);

      if (parsed.sourceModule === "schedule-course") {
        await courseApi.create({
          courseName: parsed.title,
          teacher: parsed.tag ?? "",
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          timezone: "Asia/Shanghai",
          color: parsed.color ?? "#6366f1",
        });
      } else if (parsed.sourceModule === "study-plan") {
        await studyTaskApi.create({
          subject: parsed.tag ?? "未分类",
          targetCycle: "daily",
          plannedMinutes: Math.round(durationMs / 60000),
          taskDetail: parsed.title,
          startDate: targetDateStr,
          priority: (parsed.priority as "low" | "medium" | "high") ?? "medium",
          status: "todo",
        });
      } else if (parsed.sourceModule === "daily-agenda") {
        await agendaApi.create({
          title: parsed.title,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          category: "other",
          priority: (parsed.priority as "low" | "medium" | "high") ?? "medium",
          tags: parsed.tag ? parsed.tag.split(",") : [],
        });
      }
      await loadEvents();
    } catch (err) {
      console.error("Failed to paste event", err);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📅 日历总览</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {MODULE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(opt.value)}
                onChange={() => toggleModule(opt.value)}
              />
              <span
                className="color-dot"
                style={{
                  width: 12,
                  height: 12,
                  background: opt.color,
                  borderColor: opt.color,
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Month Navigation */}
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

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="day-header">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="day-cell other-month" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayEvents = getEventsForDay(day);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;

          return (
            <div
              key={day}
              className={`day-cell ${isToday ? "today" : ""} ${dragOverDay === day ? "drag-over" : ""}`}
              onDragOver={(evt) => handleDragOver(day, evt)}
              onDragLeave={handleDragLeave}
              onDrop={(evt) => handleDrop(day, evt)}
              onPaste={(evt) => handlePasteEvent(day, evt)}
              tabIndex={0}
            >
              <div className="day-number">{day}</div>
              {dayEvents.map((e, idx) => (
                <div
                  key={idx}
                  className="day-event-rich"
                  style={{ borderLeftColor: e.color ?? getModuleColor(e.sourceModule) }}
                  title={`[${getModuleLabel(e.sourceModule)}] ${e.title}\n${e.tag ? "老师: " + e.tag : ""}\n${formatTime(e.startAt)}-${formatTime(e.endAt)}`}
                  draggable
                  onDragStart={(evt) => handleDragStart(e, evt)}
                  onDragEnd={handleDragEnd}
                  onClick={(evt) => handleCopyEvent(e, evt)}
                >
                  {/* 删除按钮 */}
                  <button
                    className="day-event-delete-btn"
                    onClick={(evt) => handleDeleteEvent(e, evt)}
                    title="删除"
                  >
                    <X size={10} />
                  </button>
                  <div className="day-event-rich-title">
                    <span className="day-event-rich-dot" style={{ background: e.color ?? getModuleColor(e.sourceModule) }} />
                    <span className="day-event-rich-name">{e.title}</span>
                    <span className="day-event-rich-time">{formatTime(e.startAt)}-{formatTime(e.endAt)}</span>
                  </div>
                  <div className="day-event-rich-meta">
                    {e.tag && <span className="day-event-rich-tag">{e.tag}</span>}
                  </div>
                </div>
              ))}
            </div>
          );

        })}
      </div>

      {/* Event Legend */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>今日事件</h2>
        </div>
        {events.filter((e) => e.startAt.startsWith(today.toISOString().slice(0, 10))).length ===
        0 ? (
          <div className="empty-state">
            <p>今日暂无事件</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>来源</th>
                <th>标题</th>
                <th>时间</th>
                <th>标签</th>
              </tr>
            </thead>
            <tbody>
              {events
                .filter((e) => e.startAt.startsWith(today.toISOString().slice(0, 10)))
                .map((e, idx) => (
                  <tr key={idx}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${getModuleColor(e.sourceModule)}20`,
                          color: getModuleColor(e.sourceModule),
                        }}
                      >
                        {getModuleLabel(e.sourceModule)}
                      </span>
                    </td>
                    <td>{e.title}</td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {new Date(e.startAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {e.tag}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { analyticsApi, type CourseAnalyticsDTO, type StudyAnalyticsDTO, type AgendaAnalyticsDTO } from "../../api/client";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"course" | "study" | "agenda">("course");
  const [courseData, setCourseData] = useState<CourseAnalyticsDTO | null>(null);
  const [studyData, setStudyData] = useState<StudyAnalyticsDTO | null>(null);
  const [agendaData, setAgendaData] = useState<AgendaAnalyticsDTO | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [c, s, a] = await Promise.all([
        analyticsApi.course(),
        analyticsApi.study(from, to),
        analyticsApi.agenda(from, to),
      ]);
      setCourseData(c);
      setStudyData(s);
      setAgendaData(a);
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/dashboard" className="btn btn-sm" title="返回仪表盘">
            <ArrowLeft size={16} />
          </Link>
          <h1>📊 数据分析</h1>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "course" ? "active" : ""}`} onClick={() => setTab("course")}>
          课程分析
        </button>
        <button className={`tab ${tab === "study" ? "active" : ""}`} onClick={() => setTab("study")}>
          学习分析
        </button>
        <button className={`tab ${tab === "agenda" ? "active" : ""}`} onClick={() => setTab("agenda")}>
          日程分析
        </button>
      </div>

      {/* Course Analytics */}
      {tab === "course" && courseData && (
        <div>
          <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
            <div className="card stat-card">
              <div className="stat-value">{courseData.totalCourses}</div>
              <div className="stat-label">课程数</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">{courseData.totalHoursPerWeek}</div>
              <div className="stat-label">周课时</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">
                {courseData.freePeriods.reduce((sum, d) => sum + d.periods.length, 0)}
              </div>
              <div className="stat-label">空闲节次/周</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h2>各科课时占比</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={courseData.subjectHourBreakdown}
                    dataKey="hours"
                    nameKey="subject"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ subject, percent }) =>
                      `${subject} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {courseData.subjectHourBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>各科课时对比</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courseData.subjectHourBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Study Analytics */}
      {tab === "study" && studyData && (
        <div>
          <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
            <div className="card stat-card">
              <div className="stat-value">{studyData.totalTasks}</div>
              <div className="stat-label">总任务</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {studyData.completionRate}%
              </div>
              <div className="stat-label">完成率</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">{studyData.averageDailyMinutes}</div>
              <div className="stat-label">日均学习(分钟)</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: "var(--warning)" }}>
                {studyData.streakDays}
              </div>
              <div className="stat-label">坚持天数</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h2>任务完成情况</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "已完成", value: studyData.completedTasks },
                      { name: "未完成", value: studyData.totalTasks - studyData.completedTasks },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>薄弱科目</h2>
              </div>
              {studyData.weakSubjects.length === 0 ? (
                <div className="empty-state">
                  <p>暂无薄弱科目标记</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {studyData.weakSubjects.map((s, idx) => (
                    <div
                      key={idx}
                      className="badge badge-danger"
                      style={{ fontSize: "0.9rem", padding: "0.375rem 0.75rem" }}
                    >
                      ⚠️ {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agenda Analytics */}
      {tab === "agenda" && agendaData && (
        <div>
          <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
            <div className="card stat-card">
              <div className="stat-value">{agendaData.totalItems}</div>
              <div className="stat-label">总事务</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: "var(--warning)" }}>
                {agendaData.busyDays}
              </div>
              <div className="stat-label">忙碌天数</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {agendaData.freeDays}
              </div>
              <div className="stat-label">空闲天数</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h2>事务分类占比</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agendaData.categoryBreakdown}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ category, percent }) =>
                      `${category} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {agendaData.categoryBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>分类数量对比</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agendaData.categoryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

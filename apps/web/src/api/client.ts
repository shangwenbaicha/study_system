const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...options?.headers as Record<string, string> },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// ============================================================
// 课程表 API（教师日历版）
// ============================================================

export interface CourseDTO {
  id: string;
  workspaceId: string;
  courseName: string;
  teacher: string;
  startAt: string;       // ISO datetime
  endAt: string;         // ISO datetime
  timezone: "Asia/Shanghai" | "Asia/Tokyo";
  color: string;
  note?: string;
}

export const courseApi = {
  list: () => request<CourseDTO[]>("/api/courses"),
  get: (id: string) => request<CourseDTO>(`/api/courses/${id}`),
  create: (data: Omit<CourseDTO, "id" | "workspaceId">) =>
    request<CourseDTO>("/api/courses", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CourseDTO>) =>
    request<CourseDTO>(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/courses/${id}`, { method: "DELETE" }),
};

// ============================================================
// 学期 API
// ============================================================

export interface SemesterDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  workspaceId: string;
}

export const semesterApi = {
  list: () => request<SemesterDTO[]>("/api/semesters"),
  create: (data: { name: string; startDate: string; endDate: string; weekCount: number }) =>
    request<SemesterDTO>("/api/semesters", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SemesterDTO>) =>
    request<SemesterDTO>(`/api/semesters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/semesters/${id}`, { method: "DELETE" }),
};

// ============================================================
// 科目 API
// ============================================================

export interface SubjectDTO {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  isWeak: boolean;
}

export const subjectApi = {
  list: () => request<SubjectDTO[]>("/api/subjects"),
  create: (data: { name: string; color?: string; isWeak?: boolean }) =>
    request<SubjectDTO>("/api/subjects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SubjectDTO>) =>
    request<SubjectDTO>(`/api/subjects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/subjects/${id}`, { method: "DELETE" }),
};

// ============================================================
// 学习任务 API
// ============================================================

export interface StudyTaskDTO {
  id: string;
  workspaceId: string;
  subjectId?: string;
  subject: string;
  targetCycle: string;
  plannedMinutes: number;
  taskDetail: string;
  status: "todo" | "doing" | "done";
  startDate: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
  relatedNote?: string;
  reviewCycleDays?: number;
  pomodoroCount: number;
  checkInDates: string[];
}

export const studyTaskApi = {
  list: () => request<StudyTaskDTO[]>("/api/study-tasks"),
  get: (id: string) => request<StudyTaskDTO>(`/api/study-tasks/${id}`),
  create: (data: Omit<StudyTaskDTO, "id" | "workspaceId" | "pomodoroCount" | "checkInDates">) =>
    request<StudyTaskDTO>("/api/study-tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<StudyTaskDTO>) =>
    request<StudyTaskDTO>(`/api/study-tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/study-tasks/${id}`, { method: "DELETE" }),
};

// ============================================================
// 日程 API
// ============================================================

export interface AgendaDTO {
  id: string;
  workspaceId: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  category: "work" | "study" | "health" | "social" | "other";
  tags: string[];
  recurrenceRule?: string;
  reminderAt?: string;
  priority: "low" | "medium" | "high";
  note?: string;
  status: "todo" | "done";
  archivedAt?: string;
}

export const agendaApi = {
  list: () => request<AgendaDTO[]>("/api/agenda-items"),
  get: (id: string) => request<AgendaDTO>(`/api/agenda-items/${id}`),
  create: (data: Omit<AgendaDTO, "id" | "workspaceId" | "status" | "archivedAt">) =>
    request<AgendaDTO>("/api/agenda-items", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<AgendaDTO>) =>
    request<AgendaDTO>(`/api/agenda-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/agenda-items/${id}`, { method: "DELETE" }),
  archive: (id: string) =>
    request<{ archived: boolean }>(`/api/agenda-items/${id}/archive`, { method: "POST" }),
};

// ============================================================
// 日历 API
// ============================================================

export interface CalendarEventDTO {
  sourceModule: "schedule-course" | "study-plan" | "daily-agenda";
  title: string;
  startAt: string;
  endAt: string;
  tag?: string;
  priority?: string;
  reminderAt?: string;
  metaRefId: string;
  color?: string;
}

export const calendarApi = {
  events: (modules: string[], from: string, to: string) =>
    request<CalendarEventDTO[]>(
      `/api/calendar/events?modules=${modules.join(",")}&from=${from}&to=${to}`
    ),
};

// ============================================================
// 分析 API
// ============================================================

export interface CourseAnalyticsDTO {
  totalCourses: number;
  totalHoursPerWeek: number;
  subjectHourBreakdown: Array<{ subject: string; hours: number }>;
  freePeriods: Array<{ weekday: number; periods: number[] }>;
}

export interface StudyAnalyticsDTO {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageDailyMinutes: number;
  streakDays: number;
  weakSubjects: string[];
}

export interface AgendaAnalyticsDTO {
  totalItems: number;
  busyDays: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  freeDays: number;
}

export const analyticsApi = {
  course: () => request<CourseAnalyticsDTO>("/api/analytics/course"),
  study: (from: string, to: string) =>
    request<StudyAnalyticsDTO>(`/api/analytics/study?from=${from}&to=${to}`),
  agenda: (from: string, to: string) =>
    request<AgendaAnalyticsDTO>(`/api/analytics/agenda?from=${from}&to=${to}`),
};

// ============================================================
// 备份 API
// ============================================================

export const exportApi = {
  pdf: async (params: {
    module: "schedule-course" | "study-plan" | "daily-agenda";
    range: "single" | "week" | "month" | "year" | "report";
    template: "simple" | "formal" | "student";
    includeCharts?: boolean;
    year?: number;
    month?: number;
  }) => {
    const res = await fetch(`${API_BASE}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      // 尝试读取错误信息，但 PDF 响应可能不是 JSON
      try {
        const json = await res.json();
        throw new Error(json.error?.message ?? "PDF export failed");
      } catch {
        throw new Error(`PDF export failed (HTTP ${res.status})`);
      }
    }
    // 使用 arrayBuffer 确保二进制数据完整性
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("生成的 PDF 文件为空");
    }
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${params.module}-${params.range}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 延迟释放 URL，确保下载开始
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const backupApi = {

  export: (scope: string, encrypted: boolean) =>
    request<string>("/api/backup/export", {
      method: "POST",
      body: JSON.stringify({ scope, encrypted }),
    }),
  import: (payload: string) =>
    request<{ imported: boolean }>("/api/backup/import", {
      method: "POST",
      body: JSON.stringify({ payload }),
    }),
  archive: (scope: string) =>
    request<string>("/api/backup/archive", {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),
};

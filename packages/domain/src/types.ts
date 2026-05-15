// ============================================================
// 基础类型
// ============================================================

export type ModuleName = "schedule-course" | "study-plan" | "daily-agenda";
export type Priority = "low" | "medium" | "high";
export type Role = "owner" | "editor" | "viewer";
export type TaskStatus = "todo" | "doing" | "done";
export type AgendaStatus = "todo" | "done";
export type AgendaCategory = "work" | "study" | "health" | "social" | "other";
export type Timezone = "Asia/Shanghai" | "Asia/Tokyo";

// ============================================================
// 日历事件（统一渲染用）
// ============================================================

export interface CalendarEvent {
  sourceModule: ModuleName;
  title: string;
  startAt: string;
  endAt: string;
  tag?: string;
  priority?: Priority;
  reminderAt?: string;
  metaRefId: string;
  color?: string;
}

// ============================================================
// 模块 1：课程表（教师日历版）
// ============================================================

export interface CourseItem {
  id: string;
  workspaceId: string;
  courseName: string;
  teacher: string;
  startAt: string;       // ISO datetime, e.g. "2026-05-01T09:00:00.000Z"
  endAt: string;         // ISO datetime, e.g. "2026-05-01T10:30:00.000Z"
  timezone: Timezone;    // 北京或东京时间
  color: string;
  note?: string;
}

export interface CourseCreateInput {
  courseName: string;
  teacher: string;
  startAt: string;
  endAt: string;
  timezone: Timezone;
  color: string;
  note?: string;
}

export interface CourseUpdateInput {
  courseName?: string;
  teacher?: string;
  startAt?: string;
  endAt?: string;
  timezone?: Timezone;
  color?: string;
  note?: string | null;
}

// ============================================================
// 学期配置（保留，其他模块可能依赖）
// ============================================================

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  workspaceId: string;
}

// ============================================================
// 模块 2：学习计划
// ============================================================

export interface Subject {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  isWeak: boolean;
}

export interface StudyTask {
  id: string;
  workspaceId: string;
  subjectId?: string;
  subject: string;
  targetCycle: string;
  plannedMinutes: number;
  taskDetail: string;
  status: TaskStatus;
  startDate: string;
  dueDate?: string;
  priority: Priority;
  relatedNote?: string;
  reviewCycleDays?: number;
  pomodoroCount: number;
  checkInDates: string[];
}

export interface StudyTaskCreateInput {
  subjectId?: string;
  subject: string;
  targetCycle: string;
  plannedMinutes: number;
  taskDetail: string;
  status?: TaskStatus;
  startDate: string;
  dueDate?: string;
  priority: Priority;
  relatedNote?: string;
  reviewCycleDays?: number;
}

export interface StudyTaskUpdateInput {
  subjectId?: string | null;
  subject?: string;
  targetCycle?: string;
  plannedMinutes?: number;
  taskDetail?: string;
  status?: TaskStatus;
  startDate?: string;
  dueDate?: string | null;
  priority?: Priority;
  relatedNote?: string | null;
  reviewCycleDays?: number | null;
  pomodoroCount?: number;
  checkInDates?: string[];
}

// ============================================================
// 模块 3：日程安排
// ============================================================

export interface AgendaItem {
  id: string;
  workspaceId: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  category: AgendaCategory;
  tags: string[];
  recurrenceRule?: string;
  reminderAt?: string;
  priority: Priority;
  note?: string;
  status: AgendaStatus;
  archivedAt?: string;
}

export interface AgendaCreateInput {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  category?: AgendaCategory;
  tags?: string[];
  recurrenceRule?: string;
  reminderAt?: string;
  priority: Priority;
  note?: string;
}

export interface AgendaUpdateInput {
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string | null;
  category?: AgendaCategory;
  tags?: string[];
  recurrenceRule?: string | null;
  reminderAt?: string | null;
  priority?: Priority;
  note?: string | null;
  status?: AgendaStatus;
}

// ============================================================
// 用户 & 工作区
// ============================================================

export interface WorkspaceMember {
  userId: string;
  role: Role;
  resourceScopes: ModuleName[];
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

// ============================================================
// 分析结果类型
// ============================================================

export interface CourseAnalytics {
  totalCourses: number;
  totalHoursPerWeek: number;
  subjectHourBreakdown: Array<{ subject: string; hours: number }>;
  freePeriods: Array<{ weekday: number; periods: number[] }>;
}

export interface StudyAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageDailyMinutes: number;
  streakDays: number;
  weakSubjects: string[];
}

export interface AgendaAnalytics {
  totalItems: number;
  busyDays: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  freeDays: number;
}

// ============================================================
// 备份类型
// ============================================================

export interface BackupPayload {
  version: string;
  exportedAt: string;
  scope: ModuleName | "all";
  encrypted: boolean;
  data: {
    courses?: CourseItem[];
    subjects?: Subject[];
    studyTasks?: StudyTask[];
    agendaItems?: AgendaItem[];
    semesters?: Semester[];
  };
}

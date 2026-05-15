import type {
  AgendaItem,
  CourseItem,
  ModuleName,
  Semester,
  StudyTask,
  Subject,
  CourseCreateInput,
  CourseUpdateInput,
  StudyTaskCreateInput,
  StudyTaskUpdateInput,
  AgendaCreateInput,
  AgendaUpdateInput,
  CalendarEvent,
  CourseAnalytics,
  StudyAnalytics,
  AgendaAnalytics,
  BackupPayload
} from "./types.js";

// ============================================================
// 模块仓储接口（每个模块一个）
// ============================================================

export interface CourseRepository {
  list(workspaceId: string): Promise<CourseItem[]>;
  getById(id: string): Promise<CourseItem | null>;
  create(input: CourseCreateInput, workspaceId: string): Promise<CourseItem>;
  update(id: string, input: CourseUpdateInput): Promise<CourseItem>;
  remove(id: string): Promise<void>;
}

export interface SubjectRepository {
  list(workspaceId: string): Promise<Subject[]>;
  getById(id: string): Promise<Subject | null>;
  create(input: { name: string; color?: string; isWeak?: boolean }, workspaceId: string): Promise<Subject>;
  update(id: string, input: Partial<Subject>): Promise<Subject>;
  remove(id: string): Promise<void>;
}

export interface StudyTaskRepository {
  list(workspaceId: string): Promise<StudyTask[]>;
  getById(id: string): Promise<StudyTask | null>;
  create(input: StudyTaskCreateInput, workspaceId: string): Promise<StudyTask>;
  update(id: string, input: StudyTaskUpdateInput): Promise<StudyTask>;
  remove(id: string): Promise<void>;
}

export interface AgendaRepository {
  list(workspaceId: string): Promise<AgendaItem[]>;
  getById(id: string): Promise<AgendaItem | null>;
  create(input: AgendaCreateInput, workspaceId: string): Promise<AgendaItem>;
  update(id: string, input: AgendaUpdateInput): Promise<AgendaItem>;
  remove(id: string): Promise<void>;
}

export interface SemesterRepository {
  list(workspaceId: string): Promise<Semester[]>;
  getById(id: string): Promise<Semester | null>;
  create(input: { name: string; startDate: string; endDate: string; weekCount: number }, workspaceId: string): Promise<Semester>;
  update(id: string, input: Partial<Semester>): Promise<Semester>;
  remove(id: string): Promise<void>;
}

// ============================================================
// 日历渲染接口
// ============================================================

export interface CalendarRenderable {
  toCalendarEvents(workspaceId: string): Promise<CalendarEvent[]>;
}

// ============================================================
// 分析计算接口
// ============================================================

export interface AnalyticsComputable {
  computeCourse(workspaceId: string, semesterId?: string): Promise<CourseAnalytics>;
  computeStudy(workspaceId: string, from: string, to: string): Promise<StudyAnalytics>;
  computeAgenda(workspaceId: string, from: string, to: string): Promise<AgendaAnalytics>;
}

// ============================================================
// 模块边界定义
// ============================================================

export interface ModuleBoundary {
  moduleName: ModuleName;
  calendar: CalendarRenderable;
  analytics: AnalyticsComputable;
}

// ============================================================
// 用户 & 认证
// ============================================================

export interface AuthService {
  register(email: string, password: string, displayName: string): Promise<{ user: { id: string; email: string; displayName: string }; token: string }>;
  login(email: string, password: string): Promise<{ user: { id: string; email: string; displayName: string }; token: string }>;
  verifyToken(token: string): Promise<{ userId: string; workspaceIds: string[] }>;
}

// ============================================================
// 备份接口
// ============================================================

export interface BackupService {
  export(workspaceId: string, scope: ModuleName | "all", encrypted: boolean): Promise<string>;
  import(workspaceId: string, payload: string): Promise<void>;
  archive(workspaceId: string, scope: ModuleName | "all"): Promise<string>;
}

import { PrismaClient } from "@prisma/client";
import type {
  AgendaItem,
  AgendaCreateInput,
  AgendaUpdateInput,
  CourseAnalytics,
  CourseItem,
  CourseCreateInput,
  CourseUpdateInput,
  Semester,
  StudyAnalytics,
  StudyTask,
  StudyTaskCreateInput,
  StudyTaskUpdateInput,
  Subject,
  AgendaAnalytics,
  CalendarEvent,
  ModuleName,
  BackupPayload,
  WordBook,
  Word,
  WordReview,
  StudyCheckIn,
  StudyStats,
  GrammarPoint,
  GrammarExample,
  GrammarQuiz,
  GrammarQuizResult,
  Exam,
  ExamQuestion,
  ExamAttempt,
  MistakeItem,
  VideoResource,
  VideoNote,
  VideoProgress,
  Post,
  Comment,
  PostLike,
  TranslationResult
} from "../../../packages/domain/src/index.js";
import {
  DefaultCalendarEngine,
  InAppNotifyEngine,
  MemoryChartEngine,
  MemoryPdfEngine
} from "../../../packages/common-engines/src/index.js";
import type { CalendarRenderable } from "../../../packages/domain/src/contracts.js";
import crypto from "crypto";

// ============================================================
// 数据库服务 — 统一 CRUD 实现
// ============================================================

export class DbStudySystemService {
  readonly prisma: PrismaClient;
  readonly pdf = new MemoryPdfEngine();
  readonly chart = new MemoryChartEngine();
  readonly notify = new InAppNotifyEngine();

  constructor(prisma = new PrismaClient()) {
    this.prisma = prisma;
  }

  async assertDatabaseReady() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing. Create .env from .env.example first.");
    }
    await this.prisma.$queryRaw`SELECT 1`;
  }

  // ============================================================
  // 用户 & 认证
  // ============================================================

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, passwordHash: string, displayName: string) {
    return this.prisma.user.create({
      data: { email, passwordHash, displayName }
    });
  }

  async getUserWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true }
    });
    return memberships.map((m: any) => m.workspace);
  }

  // 管理员：获取所有用户
  async listAllUsers() {
    return this.prisma.user.findMany({
      include: {
        _count: { select: { wordBooks: true, posts: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 管理员：更新用户角色
  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role }
    });
  }

  // 管理员：删除用户
  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  // ============================================================
  // 工作区
  // ============================================================

  async createWorkspace(name: string, ownerId: string) {
    return this.prisma.workspace.create({
      data: {
        name,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: "owner",
            resourceScopes: JSON.stringify(["schedule-course", "study-plan", "daily-agenda"])
          }
        }
      },
      include: { members: true }
    });
  }

  async listWorkspaces() {
    return this.prisma.workspace.findMany({
      include: { members: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async addWorkspaceMember(workspaceId: string, userId: string, role: string, scopes: string[]) {
    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
        resourceScopes: JSON.stringify(scopes)
      }
    });
  }

  // ============================================================
  // 学期
  // ============================================================

  async listSemesters(workspaceId: string): Promise<Semester[]> {
    const rows = await this.prisma.semester.findMany({
      where: { workspaceId },
      orderBy: { startDate: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      weekCount: r.weekCount,
      workspaceId: r.workspaceId
    }));
  }

  async createSemester(data: { name: string; startDate: string; endDate: string; weekCount: number }, workspaceId: string): Promise<Semester> {
    const r = await this.prisma.semester.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        weekCount: data.weekCount,
        workspaceId
      }
    });
    return {
      id: r.id,
      name: r.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      weekCount: r.weekCount,
      workspaceId: r.workspaceId
    };
  }

  async updateSemester(id: string, data: Partial<Semester>): Promise<Semester> {
    const r = await this.prisma.semester.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.weekCount !== undefined && { weekCount: data.weekCount })
      }
    });
    return {
      id: r.id,
      name: r.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      weekCount: r.weekCount,
      workspaceId: r.workspaceId
    };
  }

  async deleteSemester(id: string): Promise<void> {
    await this.prisma.semester.delete({ where: { id } });
  }

  // ============================================================
  // 课程表 CRUD
  // ============================================================

  async listCourses(workspaceId: string): Promise<CourseItem[]> {
    const rows = await this.prisma.courseItem.findMany({
      where: { workspaceId },
      orderBy: { startAt: "asc" }
    });
    return rows.map((x: any) => ({
      id: x.id,
      workspaceId: x.workspaceId,
      courseName: x.courseName,
      teacher: x.teacher,
      startAt: x.startAt.toISOString(),
      endAt: x.endAt.toISOString(),
      timezone: x.timezone as CourseItem["timezone"],
      color: x.color,
      note: x.note ?? undefined
    }));
  }

  async getCourse(id: string): Promise<CourseItem | null> {
    const x = await this.prisma.courseItem.findUnique({ where: { id } });
    if (!x) return null;
    return {
      id: x.id,
      workspaceId: x.workspaceId,
      courseName: x.courseName,
      teacher: x.teacher,
      startAt: x.startAt.toISOString(),
      endAt: x.endAt.toISOString(),
      timezone: x.timezone as CourseItem["timezone"],
      color: x.color,
      note: x.note ?? undefined
    };
  }

  async createCourse(input: CourseCreateInput, workspaceId: string): Promise<CourseItem> {
    const x = await this.prisma.courseItem.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId,
        courseName: input.courseName,
        teacher: input.teacher,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        timezone: input.timezone,
        color: input.color,
        note: input.note ?? null
      }
    });
    return (await this.getCourse(x.id))!;
  }

  async updateCourse(id: string, input: CourseUpdateInput): Promise<CourseItem> {
    const data: any = {};
    if (input.courseName !== undefined) data.courseName = input.courseName;
    if (input.teacher !== undefined) data.teacher = input.teacher;
    if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) data.endAt = new Date(input.endAt);
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.color !== undefined) data.color = input.color;
    if (input.note !== undefined) data.note = input.note;
    await this.prisma.courseItem.update({ where: { id }, data });
    return (await this.getCourse(id))!;
  }

  async deleteCourse(id: string): Promise<void> {
    await this.prisma.courseItem.delete({ where: { id } });
  }

  // ============================================================
  // 科目 CRUD
  // ============================================================

  async listSubjects(workspaceId: string): Promise<Subject[]> {
    const rows = await this.prisma.subject.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" }
    });
    return rows.map((x: any) => ({
      id: x.id,
      workspaceId: x.workspaceId,
      name: x.name,
      color: x.color,
      isWeak: x.isWeak
    }));
  }

  async createSubject(input: { name: string; color?: string; isWeak?: boolean }, workspaceId: string): Promise<Subject> {
    const x = await this.prisma.subject.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId,
        name: input.name,
        color: input.color ?? "#6366f1",
        isWeak: input.isWeak ?? false
      }
    });
    return {
      id: x.id,
      workspaceId: x.workspaceId,
      name: x.name,
      color: x.color,
      isWeak: x.isWeak
    };
  }

  async updateSubject(id: string, input: Partial<Subject>): Promise<Subject> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.isWeak !== undefined) data.isWeak = input.isWeak;
    const x = await this.prisma.subject.update({ where: { id }, data });
    return {
      id: x.id,
      workspaceId: x.workspaceId,
      name: x.name,
      color: x.color,
      isWeak: x.isWeak
    };
  }

  async deleteSubject(id: string): Promise<void> {
    await this.prisma.subject.delete({ where: { id } });
  }

  // ============================================================
  // 学习任务 CRUD
  // ============================================================

  async listStudyTasks(workspaceId: string): Promise<StudyTask[]> {
    const rows = await this.prisma.studyTask.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((x: any) => ({
      id: x.id,
      workspaceId: x.workspaceId,
      subjectId: x.subjectId ?? undefined,
      subject: x.subject,
      targetCycle: x.targetCycle,
      plannedMinutes: x.plannedMinutes,
      taskDetail: x.taskDetail,
      status: x.status as StudyTask["status"],
      startDate: x.startDate.toISOString().slice(0, 10),
      dueDate: x.dueDate?.toISOString().slice(0, 10),
      priority: x.priority as StudyTask["priority"],
      relatedNote: x.relatedNote ?? undefined,
      reviewCycleDays: x.reviewCycleDays ?? undefined,
      pomodoroCount: x.pomodoroCount,
      checkInDates: JSON.parse(x.checkInDates)
    }));
  }

  async getStudyTask(id: string): Promise<StudyTask | null> {
    const x = await this.prisma.studyTask.findUnique({ where: { id } });
    if (!x) return null;
    return {
      id: x.id,
      workspaceId: x.workspaceId,
      subjectId: x.subjectId ?? undefined,
      subject: x.subject,
      targetCycle: x.targetCycle,
      plannedMinutes: x.plannedMinutes,
      taskDetail: x.taskDetail,
      status: x.status as StudyTask["status"],
      startDate: x.startDate.toISOString().slice(0, 10),
      dueDate: x.dueDate?.toISOString().slice(0, 10),
      priority: x.priority as StudyTask["priority"],
      relatedNote: x.relatedNote ?? undefined,
      reviewCycleDays: x.reviewCycleDays ?? undefined,
      pomodoroCount: x.pomodoroCount,
      checkInDates: JSON.parse(x.checkInDates)
    };
  }

  async createStudyTask(input: StudyTaskCreateInput, workspaceId: string): Promise<StudyTask> {
    const x = await this.prisma.studyTask.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId,
        subjectId: input.subjectId ?? null,
        subject: input.subject,
        targetCycle: input.targetCycle,
        plannedMinutes: input.plannedMinutes,
        taskDetail: input.taskDetail,
        status: input.status ?? "todo",
        startDate: new Date(input.startDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority,
        relatedNote: input.relatedNote ?? null,
        reviewCycleDays: input.reviewCycleDays ?? null,
        pomodoroCount: 0,
        checkInDates: "[]"
      }
    });
    return (await this.getStudyTask(x.id))!;
  }

  async updateStudyTask(id: string, input: StudyTaskUpdateInput): Promise<StudyTask> {
    const data: any = {};
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.subjectId !== undefined) data.subjectId = input.subjectId;
    if (input.targetCycle !== undefined) data.targetCycle = input.targetCycle;
    if (input.plannedMinutes !== undefined) data.plannedMinutes = input.plannedMinutes;
    if (input.taskDetail !== undefined) data.taskDetail = input.taskDetail;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.relatedNote !== undefined) data.relatedNote = input.relatedNote;
    if (input.reviewCycleDays !== undefined) data.reviewCycleDays = input.reviewCycleDays;
    if (input.pomodoroCount !== undefined) data.pomodoroCount = input.pomodoroCount;
    if (input.checkInDates !== undefined) data.checkInDates = JSON.stringify(input.checkInDates);
    await this.prisma.studyTask.update({ where: { id }, data });
    return (await this.getStudyTask(id))!;
  }

  async deleteStudyTask(id: string): Promise<void> {
    await this.prisma.studyTask.delete({ where: { id } });
  }

  // ============================================================
  // 日程 CRUD
  // ============================================================

  async listAgendaItems(workspaceId: string): Promise<AgendaItem[]> {
    const rows = await this.prisma.agendaItem.findMany({
      where: { workspaceId },
      orderBy: { startAt: "desc" }
    });
    return rows.map((x: any) => ({
      id: x.id,
      workspaceId: x.workspaceId,
      title: x.title,
      startAt: x.startAt.toISOString(),
      endAt: x.endAt.toISOString(),
      location: x.location ?? undefined,
      category: x.category as AgendaItem["category"],
      tags: JSON.parse(x.tags),
      recurrenceRule: x.recurrenceRule ?? undefined,
      reminderAt: x.reminderAt?.toISOString(),
      priority: x.priority as AgendaItem["priority"],
      note: x.note ?? undefined,
      status: x.status as AgendaItem["status"],
      archivedAt: x.archivedAt?.toISOString()
    }));
  }

  async getAgendaItem(id: string): Promise<AgendaItem | null> {
    const x = await this.prisma.agendaItem.findUnique({ where: { id } });
    if (!x) return null;
    return {
      id: x.id,
      workspaceId: x.workspaceId,
      title: x.title,
      startAt: x.startAt.toISOString(),
      endAt: x.endAt.toISOString(),
      location: x.location ?? undefined,
      category: x.category as AgendaItem["category"],
      tags: JSON.parse(x.tags),
      recurrenceRule: x.recurrenceRule ?? undefined,
      reminderAt: x.reminderAt?.toISOString(),
      priority: x.priority as AgendaItem["priority"],
      note: x.note ?? undefined,
      status: x.status as AgendaItem["status"],
      archivedAt: x.archivedAt?.toISOString()
    };
  }

  async createAgendaItem(input: AgendaCreateInput, workspaceId: string): Promise<AgendaItem> {
    const x = await this.prisma.agendaItem.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId,
        title: input.title,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        location: input.location ?? null,
        category: input.category ?? "other",
        tags: JSON.stringify(input.tags ?? []),
        recurrenceRule: input.recurrenceRule ?? null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
        priority: input.priority,
        note: input.note ?? null,
        status: "todo"
      }
    });
    return (await this.getAgendaItem(x.id))!;
  }

  async updateAgendaItem(id: string, input: AgendaUpdateInput): Promise<AgendaItem> {
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) data.endAt = new Date(input.endAt);
    if (input.location !== undefined) data.location = input.location;
    if (input.category !== undefined) data.category = input.category;
    if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
    if (input.recurrenceRule !== undefined) data.recurrenceRule = input.recurrenceRule;
    if (input.reminderAt !== undefined) data.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.note !== undefined) data.note = input.note;
    if (input.status !== undefined) data.status = input.status;
    await this.prisma.agendaItem.update({ where: { id }, data });
    return (await this.getAgendaItem(id))!;
  }

  async deleteAgendaItem(id: string): Promise<void> {
    await this.prisma.agendaItem.delete({ where: { id } });
  }

  async archiveAgendaItem(id: string): Promise<void> {
    await this.prisma.agendaItem.update({
      where: { id },
      data: { archivedAt: new Date() }
    });
  }

  // ============================================================
  // 日历渲染（统一引擎）
  // ============================================================

  async renderCalendar(modules: ModuleName[], from: string, to: string, workspaceId: string): Promise<CalendarEvent[]> {
    const sources: Record<string, CalendarRenderable> = {};

    if (modules.includes("schedule-course")) {
      sources["schedule-course"] = {
        toCalendarEvents: async (wid: string) => {
          const courses = await this.listCourses(wid);
          return courses.map((item) => ({
            sourceModule: "schedule-course" as const,
            title: item.courseName,
            startAt: item.startAt,
            endAt: item.endAt,
            tag: item.teacher,
            priority: "medium" as const,
            metaRefId: item.id,
            color: item.color
          }));
        }
      };
    }

    if (modules.includes("study-plan")) {
      sources["study-plan"] = {
        toCalendarEvents: async (wid: string) => {
          const tasks = await this.listStudyTasks(wid);
          return tasks.map((item) => ({
            sourceModule: "study-plan" as const,
            title: item.taskDetail,
            startAt: `${item.startDate}T10:00:00.000Z`,
            endAt: `${item.startDate}T11:00:00.000Z`,
            tag: item.subject,
            priority: item.priority,
            reminderAt: `${item.startDate}T09:45:00.000Z`,
            metaRefId: item.id
          }));
        }
      };
    }

    if (modules.includes("daily-agenda")) {
      sources["daily-agenda"] = {
        toCalendarEvents: async (wid: string) => {
          const items = await this.listAgendaItems(wid);
          return items.map((item) => ({
            sourceModule: "daily-agenda" as const,
            title: item.title,
            startAt: item.startAt,
            endAt: item.endAt,
            tag: item.tags.join(","),
            priority: item.priority,
            reminderAt: item.reminderAt,
            metaRefId: item.id
          }));
        }
      };
    }

    const calendar = new DefaultCalendarEngine(sources as any);
    return calendar.render({ modules, from, to, workspaceId });
  }

  // ============================================================
  // 数据分析
  // ============================================================

  async computeCourseAnalytics(workspaceId: string): Promise<CourseAnalytics> {
    const courses = await this.listCourses(workspaceId);
    const totalHoursPerWeek = courses.reduce((sum, c) => {
      const start = new Date(c.startAt);
      const end = new Date(c.endAt);
      const hours = (end.getTime() - start.getTime()) / 3600000;
      return sum + hours;
    }, 0);

    const subjectMap = new Map<string, number>();
    for (const c of courses) {
      const start = new Date(c.startAt);
      const end = new Date(c.endAt);
      const hours = (end.getTime() - start.getTime()) / 3600000;
      subjectMap.set(c.courseName, (subjectMap.get(c.courseName) ?? 0) + hours);
    }
    const subjectHourBreakdown = Array.from(subjectMap.entries()).map(([subject, hours]) => ({ subject, hours }));

    const freePeriods: Array<{ weekday: number; periods: number[] }> = [];

    return {
      totalCourses: courses.length,
      totalHoursPerWeek,
      subjectHourBreakdown,
      freePeriods
    };
  }

  async computeStudyAnalytics(workspaceId: string, from: string, to: string): Promise<StudyAnalytics> {
    const tasks = await this.listStudyTasks(workspaceId);
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    const inRange = tasks.filter((t) => {
      const start = new Date(t.startDate).getTime();
      return start >= fromTime && start <= toTime;
    });

    const completed = inRange.filter((t) => t.status === "done").length;
    const completionRate = inRange.length > 0 ? completed / inRange.length : 0;

    const totalMinutes = inRange.reduce((sum, t) => sum + t.plannedMinutes, 0);
    const dayCount = Math.max(1, Math.ceil((toTime - fromTime) / 86400000));
    const averageDailyMinutes = Math.round(totalMinutes / dayCount);

    const allCheckInDates = new Set<string>();
    inRange.forEach((t) => t.checkInDates.forEach((d) => allCheckInDates.add(d)));
    const streakDays = allCheckInDates.size;

    const subjects = await this.listSubjects(workspaceId);
    const weakSubjects = subjects.filter((s) => s.isWeak).map((s) => s.name);

    return {
      totalTasks: inRange.length,
      completedTasks: completed,
      completionRate: Math.round(completionRate * 100),
      averageDailyMinutes,
      streakDays,
      weakSubjects
    };
  }

  async computeAgendaAnalytics(workspaceId: string, from: string, to: string): Promise<AgendaAnalytics> {
    const items = await this.listAgendaItems(workspaceId);
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    const inRange = items.filter((a) => {
      const start = new Date(a.startAt).getTime();
      return start >= fromTime && start <= toTime;
    });

    const busyDays = new Set(inRange.map((a) => a.startAt.slice(0, 10))).size;

    const categoryMap = new Map<string, number>();
    inRange.forEach((a) => categoryMap.set(a.category, (categoryMap.get(a.category) ?? 0) + 1));
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    const totalDays = Math.max(1, Math.ceil((toTime - fromTime) / 86400000));
    const freeDays = totalDays - busyDays;

    return {
      totalItems: inRange.length,
      busyDays,
      categoryBreakdown,
      freeDays: Math.max(0, freeDays)
    };
  }

  // ============================================================
  // 备份 / 还原
  // ============================================================

  async exportBackup(workspaceId: string, scope: ModuleName | "all", encrypted: boolean): Promise<string> {
    const data: BackupPayload["data"] = {};
    if (scope === "all" || scope === "schedule-course") {
      data.courses = await this.listCourses(workspaceId);
      data.semesters = await this.listSemesters(workspaceId);
    }
    if (scope === "all" || scope === "study-plan") {
      data.subjects = await this.listSubjects(workspaceId);
      data.studyTasks = await this.listStudyTasks(workspaceId);
    }
    if (scope === "all" || scope === "daily-agenda") {
      data.agendaItems = await this.listAgendaItems(workspaceId);
    }

    const payload: BackupPayload = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      scope,
      encrypted,
      data
    };

    const json = JSON.stringify(payload, null, 2);
    return encrypted ? Buffer.from(json).toString("base64") : json;
  }

  async importBackup(workspaceId: string, payload: string): Promise<void> {
    const decoded = payload.trim().startsWith("{")
      ? payload
      : Buffer.from(payload, "base64").toString("utf8");
    const backup = JSON.parse(decoded) as BackupPayload;

    await this.prisma.$transaction([
      this.prisma.courseItem.deleteMany({ where: { workspaceId } }),
      this.prisma.studyTask.deleteMany({ where: { workspaceId } }),
      this.prisma.agendaItem.deleteMany({ where: { workspaceId } }),
      this.prisma.subject.deleteMany({ where: { workspaceId } }),
      this.prisma.semester.deleteMany({ where: { workspaceId } })
    ]);

    if (backup.data.courses) {
      for (const c of backup.data.courses) {
        await this.createCourse(c, workspaceId);
      }
    }
    if (backup.data.semesters) {
      for (const s of backup.data.semesters) {
        await this.createSemester(s, workspaceId);
      }
    }
    if (backup.data.subjects) {
      for (const s of backup.data.subjects) {
        await this.createSubject(s, workspaceId);
      }
    }
    if (backup.data.studyTasks) {
      for (const t of backup.data.studyTasks) {
        await this.createStudyTask(t, workspaceId);
      }
    }
    if (backup.data.agendaItems) {
      for (const a of backup.data.agendaItems) {
        await this.createAgendaItem(a, workspaceId);
      }
    }
  }

  async archiveBackup(workspaceId: string, scope: ModuleName | "all"): Promise<string> {
    const payload = await this.exportBackup(workspaceId, scope, false);
    return `archive://${workspaceId}/${scope}/${Date.now()}`;
  }

  // ============================================================
  // ================ 新增模块方法 =============================
  // ============================================================

  // ============================================================
  // 背单词模块
  // ============================================================

  async listBuiltInWordBooks(): Promise<WordBook[]> {
    const rows = await this.prisma.wordBook.findMany({
      where: { isBuiltIn: true },
      orderBy: { name: "asc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      language: r.language as WordBook["language"],
      wordCount: r.wordCount,
      isBuiltIn: r.isBuiltIn,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async installBuiltInWordBook(wordBookId: string, userId: string): Promise<WordBook> {
    const builtIn = await this.prisma.wordBook.findUnique({
      where: { id: wordBookId },
      include: { words: true }
    });
    if (!builtIn || !builtIn.isBuiltIn) {
      throw new Error("WordBook not found or not built-in");
    }

    // 为用户创建副本
    const newBook = await this.prisma.wordBook.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        name: builtIn.name,
        language: builtIn.language,
        wordCount: builtIn.wordCount,
        isBuiltIn: false
      }
    });

    // 复制单词
    for (const w of builtIn.words) {
      await this.prisma.word.create({
        data: {
          id: crypto.randomUUID(),
          wordBookId: newBook.id,
          word: w.word,
          reading: w.reading,
          meaning: w.meaning,
          partOfSpeech: w.partOfSpeech,
          exampleSentence: w.exampleSentence,
          exampleTranslation: w.exampleTranslation,
          audioUrl: w.audioUrl
        }
      });
    }

    return {
      id: newBook.id,
      userId: newBook.userId,
      name: newBook.name,
      language: newBook.language as WordBook["language"],
      wordCount: newBook.wordCount,
      isBuiltIn: newBook.isBuiltIn,
      createdAt: newBook.createdAt.toISOString(),
      updatedAt: newBook.updatedAt.toISOString()
    };
  }

  async listWordBooks(userId: string): Promise<WordBook[]> {
    const rows = await this.prisma.wordBook.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      language: r.language as WordBook["language"],
      wordCount: r.wordCount,
      isBuiltIn: r.isBuiltIn,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createWordBook(input: { name: string; language: string }, userId: string): Promise<WordBook> {
    const r = await this.prisma.wordBook.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        name: input.name,
        language: input.language,
        wordCount: 0,
        isBuiltIn: false
      }
    });
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      language: r.language as WordBook["language"],
      wordCount: r.wordCount,
      isBuiltIn: r.isBuiltIn,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async getWordBook(id: string): Promise<WordBook | null> {
    const r = await this.prisma.wordBook.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      language: r.language as WordBook["language"],
      wordCount: r.wordCount,
      isBuiltIn: r.isBuiltIn,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async updateWordBook(id: string, input: { name?: string; language?: string }): Promise<WordBook> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.language !== undefined) data.language = input.language;
    const r = await this.prisma.wordBook.update({ where: { id }, data });
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      language: r.language as WordBook["language"],
      wordCount: r.wordCount,
      isBuiltIn: r.isBuiltIn,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async deleteWordBook(id: string): Promise<void> {
    await this.prisma.wordBook.delete({ where: { id } });
  }

  async listWords(wordBookId: string): Promise<Word[]> {
    const rows = await this.prisma.word.findMany({
      where: { wordBookId },
      orderBy: { createdAt: "asc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      wordBookId: r.wordBookId,
      word: r.word,
      reading: r.reading ?? undefined,
      meaning: r.meaning,
      partOfSpeech: r.partOfSpeech ?? undefined,
      exampleSentence: r.exampleSentence ?? undefined,
      exampleTranslation: r.exampleTranslation ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async createWord(wordBookId: string, input: {
    word: string;
    reading?: string;
    meaning: string;
    partOfSpeech?: string;
    exampleSentence?: string;
    exampleTranslation?: string;
    audioUrl?: string;
  }): Promise<Word> {
    const r = await this.prisma.word.create({
      data: {
        id: crypto.randomUUID(),
        wordBookId,
        word: input.word,
        reading: input.reading ?? null,
        meaning: input.meaning,
        partOfSpeech: input.partOfSpeech ?? null,
        exampleSentence: input.exampleSentence ?? null,
        exampleTranslation: input.exampleTranslation ?? null,
        audioUrl: input.audioUrl ?? null
      }
    });
    // 更新词书单词计数
    await this.prisma.wordBook.update({
      where: { id: wordBookId },
      data: { wordCount: { increment: 1 } }
    });
    return {
      id: r.id,
      wordBookId: r.wordBookId,
      word: r.word,
      reading: r.reading ?? undefined,
      meaning: r.meaning,
      partOfSpeech: r.partOfSpeech ?? undefined,
      exampleSentence: r.exampleSentence ?? undefined,
      exampleTranslation: r.exampleTranslation ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      createdAt: r.createdAt.toISOString()
    };
  }

  async updateWord(id: string, input: {
    word?: string;
    reading?: string | null;
    meaning?: string;
    partOfSpeech?: string | null;
    exampleSentence?: string | null;
    exampleTranslation?: string | null;
    audioUrl?: string | null;
  }): Promise<Word> {
    const data: any = {};
    if (input.word !== undefined) data.word = input.word;
    if (input.reading !== undefined) data.reading = input.reading;
    if (input.meaning !== undefined) data.meaning = input.meaning;
    if (input.partOfSpeech !== undefined) data.partOfSpeech = input.partOfSpeech;
    if (input.exampleSentence !== undefined) data.exampleSentence = input.exampleSentence;
    if (input.exampleTranslation !== undefined) data.exampleTranslation = input.exampleTranslation;
    if (input.audioUrl !== undefined) data.audioUrl = input.audioUrl;
    const r = await this.prisma.word.update({ where: { id }, data });
    return {
      id: r.id,
      wordBookId: r.wordBookId,
      word: r.word,
      reading: r.reading ?? undefined,
      meaning: r.meaning,
      partOfSpeech: r.partOfSpeech ?? undefined,
      exampleSentence: r.exampleSentence ?? undefined,
      exampleTranslation: r.exampleTranslation ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      createdAt: r.createdAt.toISOString()
    };
  }

  async deleteWord(id: string): Promise<void> {
    const word = await this.prisma.word.findUnique({ where: { id } });
    if (word) {
      await this.prisma.wordBook.update({
        where: { id: word.wordBookId },
        data: { wordCount: { decrement: 1 } }
      });
    }
    await this.prisma.word.delete({ where: { id } });
  }

  async importWords(wordBookId: string, words: Array<{
    word: string;
    reading?: string;
    meaning: string;
    partOfSpeech?: string;
    exampleSentence?: string;
    exampleTranslation?: string;
  }>): Promise<{ imported: number }> {
    let count = 0;
    for (const w of words) {
      await this.prisma.word.create({
        data: {
          id: crypto.randomUUID(),
          wordBookId,
          word: w.word,
          reading: w.reading ?? null,
          meaning: w.meaning,
          partOfSpeech: w.partOfSpeech ?? null,
          exampleSentence: w.exampleSentence ?? null,
          exampleTranslation: w.exampleTranslation ?? null
        }
      });
      count++;
    }
    await this.prisma.wordBook.update({
      where: { id: wordBookId },
      data: { wordCount: { increment: count } }
    });
    return { imported: count };
  }

  // SM-2 算法实现
  private calculateSM2(score: number, previous: { easeFactor: number; interval: number; repetitions: number }) {
    let { easeFactor, interval, repetitions } = previous;

    if (score >= 3) {
      // 正确
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    } else {
      // 错误，重置
      repetitions = 0;
      interval = 1;
    }

    // 更新 ease factor
    easeFactor = easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    return { easeFactor, interval, repetitions };
  }

  async getTodayReviewWords(userId: string): Promise<Word[]> {
    const now = new Date();
    const reviews = await this.prisma.wordReview.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now }
      },
      include: { word: true },
      orderBy: { nextReviewAt: "asc" }
    });
    return reviews.map((r: any) => ({
      id: r.word.id,
      wordBookId: r.word.wordBookId,
      word: r.word.word,
      reading: r.word.reading ?? undefined,
      meaning: r.word.meaning,
      partOfSpeech: r.word.partOfSpeech ?? undefined,
      exampleSentence: r.word.exampleSentence ?? undefined,
      exampleTranslation: r.word.exampleTranslation ?? undefined,
      audioUrl: r.word.audioUrl ?? undefined,
      createdAt: r.word.createdAt.toISOString()
    }));
  }

  async submitReview(userId: string, wordId: string, score: number): Promise<WordReview> {
    const existing = await this.prisma.wordReview.findUnique({
      where: { wordId_userId: { wordId, userId } }
    });

    const previous = existing
      ? { easeFactor: existing.easeFactor, interval: existing.interval, repetitions: existing.repetitions }
      : { easeFactor: 2.5, interval: 0, repetitions: 0 };

    const result = this.calculateSM2(score, previous);
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + result.interval);

    let status: string;
    if (result.repetitions >= 5 && result.interval >= 21) {
      status = "mastered";
    } else if (result.repetitions >= 1) {
      status = "reviewing";
    } else {
      status = "learning";
    }

    const r = await this.prisma.wordReview.upsert({
      where: { wordId_userId: { wordId, userId } },
      create: {
        id: crypto.randomUUID(),
        wordId,
        userId,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt,
        lastReviewAt: new Date(),
        status
      },
      update: {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt,
        lastReviewAt: new Date(),
        status
      }
    });

    return {
      id: r.id,
      wordId: r.wordId,
      userId: r.userId,
      easeFactor: r.easeFactor,
      interval: r.interval,
      repetitions: r.repetitions,
      nextReviewAt: r.nextReviewAt.toISOString(),
      lastReviewAt: r.lastReviewAt.toISOString(),
      status: r.status as WordReview["status"]
    };
  }

  async getStudyStats(userId: string): Promise<StudyStats> {
    const totalWords = await this.prisma.word.count({
      where: { wordBook: { userId } }
    });

    const reviews = await this.prisma.wordReview.findMany({ where: { userId } });
    const learnedWords = reviews.filter((r: any) => r.repetitions >= 1).length;
    const reviewingWords = reviews.filter((r: any) => r.status === "reviewing").length;
    const masteredWords = reviews.filter((r: any) => r.status === "mastered").length;

    const now = new Date();
    const todayReviewCount = reviews.filter((r: any) => {
      const next = new Date(r.nextReviewAt);
      return next <= now;
    }).length;

    const checkIns = await this.prisma.studyCheckIn.findMany({
      where: { userId },
      orderBy: { date: "desc" }
    });

    // 计算连续打卡天数
    let streakDays = 0;
    if (checkIns.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 0; i < checkIns.length; i++) {
        const checkDate = new Date(checkIns[i].date);
        checkDate.setHours(0, 0, 0, 0);
        const diff = Math.round((today.getTime() - checkDate.getTime()) / 86400000);
        if (diff === streakDays) {
          streakDays++;
        } else if (diff > streakDays) {
          break;
        }
      }
    }

    return {
      totalWords,
      learnedWords,
      reviewingWords,
      masteredWords,
      todayReviewCount,
      streakDays,
      totalCheckIns: checkIns.length
    };
  }

  async createCheckIn(userId: string): Promise<StudyCheckIn> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.studyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    if (existing) {
      return {
        id: existing.id,
        userId: existing.userId,
        date: existing.date.toISOString(),
        createdAt: existing.createdAt.toISOString()
      };
    }

    const r = await this.prisma.studyCheckIn.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        date: today
      }
    });

    return {
      id: r.id,
      userId: r.userId,
      date: r.date.toISOString(),
      createdAt: r.createdAt.toISOString()
    };
  }

  // ============================================================
  // 语法学习模块
  // ============================================================

  async listGrammarPoints(query: { level?: string; language?: string; category?: string }): Promise<GrammarPoint[]> {
    const where: any = {};
    if (query.level) where.level = query.level;
    if (query.language) where.language = query.language;
    if (query.category) where.category = query.category;

    const rows = await this.prisma.grammarPoint.findMany({
      where,
      orderBy: { level: "asc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      language: r.language,
      title: r.title,
      level: r.level,
      explanation: r.explanation,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createGrammarPoint(input: {
    language: string;
    title: string;
    level: string;
    explanation: string;
    category: string;
  }): Promise<GrammarPoint> {
    const r = await this.prisma.grammarPoint.create({
      data: {
        id: crypto.randomUUID(),
        language: input.language,
        title: input.title,
        level: input.level,
        explanation: input.explanation,
        category: input.category
      }
    });
    return {
      id: r.id,
      language: r.language,
      title: r.title,
      level: r.level,
      explanation: r.explanation,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async getGrammarPoint(id: string): Promise<GrammarPoint | null> {
    const r = await this.prisma.grammarPoint.findUnique({
      where: { id },
      include: { examples: true, quizzes: true }
    });
    if (!r) return null;
    return {
      id: r.id,
      language: r.language,
      title: r.title,
      level: r.level,
      explanation: r.explanation,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      examples: r.examples.map((e: any) => ({
        id: e.id,
        grammarPointId: e.grammarPointId,
        sentence: e.sentence,
        reading: e.reading ?? undefined,
        translation: e.translation,
        audioUrl: e.audioUrl ?? undefined
      })),
      quizzes: r.quizzes.map((q: any) => ({
        id: q.id,
        grammarPointId: q.grammarPointId,
        question: q.question,
        options: JSON.parse(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? undefined
      }))
    };
  }

  async updateGrammarPoint(id: string, input: {
    title?: string;
    level?: string;
    explanation?: string;
    category?: string;
  }): Promise<GrammarPoint> {
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.level !== undefined) data.level = input.level;
    if (input.explanation !== undefined) data.explanation = input.explanation;
    if (input.category !== undefined) data.category = input.category;
    const r = await this.prisma.grammarPoint.update({ where: { id }, data });
    return {
      id: r.id,
      language: r.language,
      title: r.title,
      level: r.level,
      explanation: r.explanation,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async deleteGrammarPoint(id: string): Promise<void> {
    await this.prisma.grammarPoint.delete({ where: { id } });
  }

  async listGrammarExamples(grammarPointId: string): Promise<GrammarExample[]> {
    const rows = await this.prisma.grammarExample.findMany({
      where: { grammarPointId }
    });
    return rows.map((r: any) => ({
      id: r.id,
      grammarPointId: r.grammarPointId,
      sentence: r.sentence,
      reading: r.reading ?? undefined,
      translation: r.translation,
      audioUrl: r.audioUrl ?? undefined
    }));
  }

  async createGrammarExample(grammarPointId: string, input: {
    sentence: string;
    reading?: string;
    translation: string;
    audioUrl?: string;
  }): Promise<GrammarExample> {
    const r = await this.prisma.grammarExample.create({
      data: {
        id: crypto.randomUUID(),
        grammarPointId,
        sentence: input.sentence,
        reading: input.reading ?? null,
        translation: input.translation,
        audioUrl: input.audioUrl ?? null
      }
    });
    return {
      id: r.id,
      grammarPointId: r.grammarPointId,
      sentence: r.sentence,
      reading: r.reading ?? undefined,
      translation: r.translation,
      audioUrl: r.audioUrl ?? undefined
    };
  }

  async listGrammarQuizzes(grammarPointId: string): Promise<GrammarQuiz[]> {
    const rows = await this.prisma.grammarQuiz.findMany({
      where: { grammarPointId }
    });
    return rows.map((r: any) => ({
      id: r.id,
      grammarPointId: r.grammarPointId,
      question: r.question,
      options: JSON.parse(r.options),
      correctAnswer: r.correctAnswer,
      explanation: r.explanation ?? undefined
    }));
  }

  async submitGrammarQuiz(quizId: string, answer: string): Promise<GrammarQuizResult> {
    const quiz = await this.prisma.grammarQuiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new Error("Quiz not found");
    return {
      correct: quiz.correctAnswer === answer,
      correctAnswer: quiz.correctAnswer,
      explanation: quiz.explanation ?? undefined
    };
  }

  // ============================================================
  // 模拟真题模块
  // ============================================================

  async listExams(query: { level?: string; language?: string }): Promise<Exam[]> {
    const where: any = {};
    if (query.level) where.level = query.level;
    if (query.language) where.language = query.language;

    const rows = await this.prisma.exam.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      language: r.language,
      level: r.level,
      timeLimit: r.timeLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createExam(input: {
    title: string;
    language: string;
    level: string;
    timeLimit: number;
  }): Promise<Exam> {
    const r = await this.prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: input.title,
        language: input.language,
        level: input.level,
        timeLimit: input.timeLimit
      }
    });
    return {
      id: r.id,
      title: r.title,
      language: r.language,
      level: r.level,
      timeLimit: r.timeLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async getExam(id: string): Promise<Exam | null> {
    const r = await this.prisma.exam.findUnique({
      where: { id },
      include: { questions: { orderBy: { questionNum: "asc" } } }
    });
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      language: r.language,
      level: r.level,
      timeLimit: r.timeLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      questions: r.questions.map((q: any) => ({
        id: q.id,
        examId: q.examId,
        section: q.section,
        questionNum: q.questionNum,
        question: q.question,
        options: JSON.parse(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? undefined,
        points: q.points
      }))
    };
  }

  async updateExam(id: string, input: {
    title?: string;
    level?: string;
    timeLimit?: number;
  }): Promise<Exam> {
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.level !== undefined) data.level = input.level;
    if (input.timeLimit !== undefined) data.timeLimit = input.timeLimit;
    const r = await this.prisma.exam.update({ where: { id }, data });
    return {
      id: r.id,
      title: r.title,
      language: r.language,
      level: r.level,
      timeLimit: r.timeLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async deleteExam(id: string): Promise<void> {
    await this.prisma.exam.delete({ where: { id } });
  }

  async createExamQuestion(examId: string, input: {
    section: string;
    questionNum: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    points?: number;
  }): Promise<ExamQuestion> {
    const r = await this.prisma.examQuestion.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        section: input.section,
        questionNum: input.questionNum,
        question: input.question,
        options: JSON.stringify(input.options),
        correctAnswer: input.correctAnswer,
        explanation: input.explanation ?? null,
        points: input.points ?? 1
      }
    });
    return {
      id: r.id,
      examId: r.examId,
      section: r.section,
      questionNum: r.questionNum,
      question: r.question,
      options: JSON.parse(r.options),
      correctAnswer: r.correctAnswer,
      explanation: r.explanation ?? undefined,
      points: r.points
    };
  }

  async startExamAttempt(examId: string, userId: string): Promise<ExamAttempt> {
    const r = await this.prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        userId,
        startedAt: new Date(),
        answers: "[]"
      }
    });
    return {
      id: r.id,
      examId: r.examId,
      userId: r.userId,
      startedAt: r.startedAt.toISOString(),
      answers: []
    };
  }

  async submitExamAttempt(attemptId: string, answers: Array<{ questionId: string; selectedAnswer: string }>): Promise<ExamAttempt> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: { questions: true } } }
    });
    if (!attempt) throw new Error("Attempt not found");

    let score = 0;
    let totalPoints = 0;
    const gradedAnswers = answers.map((a) => {
      const question = attempt.exam.questions.find((q: any) => q.id === a.questionId);
      const isCorrect = question ? question.correctAnswer === a.selectedAnswer : false;
      if (isCorrect) score += question?.points ?? 1;
      totalPoints += question?.points ?? 1;
      return { questionId: a.questionId, selectedAnswer: a.selectedAnswer, isCorrect };
    });

    // 记录错题
    for (const ga of gradedAnswers) {
      if (!ga.isCorrect) {
        const question = attempt.exam.questions.find((q: any) => q.id === ga.questionId);
        await this.prisma.mistakeItem.create({
          data: {
            id: crypto.randomUUID(),
            userId: attempt.userId,
            questionId: ga.questionId,
            examId: attempt.examId,
            wrongAnswer: ga.selectedAnswer,
            correctAnswer: question?.correctAnswer ?? "",
            reviewed: false
          }
        });
      }
    }

    const r = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        completedAt: new Date(),
        score,
        totalPoints,
        answers: JSON.stringify(gradedAnswers)
      }
    });

    return {
      id: r.id,
      examId: r.examId,
      userId: r.userId,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      score: r.score ?? undefined,
      totalPoints: r.totalPoints ?? undefined,
      answers: JSON.parse(r.answers)
    };
  }

  async listExamAttempts(userId: string): Promise<ExamAttempt[]> {
    const rows = await this.prisma.examAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      examId: r.examId,
      userId: r.userId,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      score: r.score ?? undefined,
      totalPoints: r.totalPoints ?? undefined,
      answers: JSON.parse(r.answers)
    }));
  }

  async listMistakes(userId: string): Promise<MistakeItem[]> {
    const rows = await this.prisma.mistakeItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      questionId: r.questionId,
      examId: r.examId ?? undefined,
      wrongAnswer: r.wrongAnswer,
      correctAnswer: r.correctAnswer,
      reviewed: r.reviewed,
      reviewedAt: r.reviewedAt?.toISOString(),
      createdAt: r.createdAt.toISOString()
    }));
  }

  async reviewMistake(id: string): Promise<void> {
    await this.prisma.mistakeItem.update({
      where: { id },
      data: { reviewed: true, reviewedAt: new Date() }
    });
  }

  // ============================================================
  // 视频学习模块
  // ============================================================

  async listVideos(userId: string): Promise<VideoResource[]> {
    const rows = await this.prisma.videoResource.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      url: r.url,
      sourceType: r.sourceType as VideoResource["sourceType"],
      language: r.language,
      duration: r.duration ?? undefined,
      thumbnail: r.thumbnail ?? undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createVideo(input: {
    userId: string;
    title: string;
    url: string;
    sourceType: string;
    language: string;
    duration?: number;
    thumbnail?: string;
  }): Promise<VideoResource> {
    const r = await this.prisma.videoResource.create({
      data: {
        id: crypto.randomUUID(),
        userId: input.userId,
        title: input.title,
        url: input.url,
        sourceType: input.sourceType,
        language: input.language,
        duration: input.duration ?? null,
        thumbnail: input.thumbnail ?? null
      }
    });
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      url: r.url,
      sourceType: r.sourceType as VideoResource["sourceType"],
      language: r.language,
      duration: r.duration ?? undefined,
      thumbnail: r.thumbnail ?? undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async deleteVideo(id: string): Promise<void> {
    await this.prisma.videoResource.delete({ where: { id } });
  }

  async addVideoNote(videoId: string, input: { timestamp: number; content: string }): Promise<VideoNote> {
    const r = await this.prisma.videoNote.create({
      data: {
        id: crypto.randomUUID(),
        videoId,
        timestamp: input.timestamp,
        content: input.content
      }
    });
    return {
      id: r.id,
      videoId: r.videoId,
      timestamp: r.timestamp,
      content: r.content,
      createdAt: r.createdAt.toISOString()
    };
  }

  async listVideoNotes(videoId: string): Promise<VideoNote[]> {
    const rows = await this.prisma.videoNote.findMany({
      where: { videoId },
      orderBy: { timestamp: "asc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      videoId: r.videoId,
      timestamp: r.timestamp,
      content: r.content,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async updateVideoProgress(videoId: string, userId: string, progress: number, position: number): Promise<VideoProgress> {
    const r = await this.prisma.videoProgress.upsert({
      where: { videoId_userId: { videoId, userId } },
      create: {
        id: crypto.randomUUID(),
        videoId,
        userId,
        progress,
        lastPosition: position,
        completed: progress >= 0.9
      },
      update: {
        progress,
        lastPosition: position,
        completed: progress >= 0.9
      }
    });
    return {
      id: r.id,
      videoId: r.videoId,
      userId: r.userId,
      progress: r.progress,
      lastPosition: r.lastPosition,
      completed: r.completed,
      updatedAt: r.updatedAt.toISOString()
    };
  }

  // ============================================================
  // 社群模块
  // ============================================================

  async listPosts(query: { language?: string; tag?: string; page?: number; limit?: number }): Promise<{ posts: Post[]; total: number }> {
    const where: any = {};
    if (query.language) where.language = query.language;
    if (query.tag) where.tags = { contains: query.tag };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true } },
          _count: { select: { comments: true } }
        }
      }),
      this.prisma.post.count({ where })
    ]);

    return {
      posts: rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        content: r.content,
        tags: JSON.parse(r.tags),
        language: r.language,
        likes: r.likes,
        views: r.views,
        pinned: r.pinned,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        user: r.user,
        commentCount: r._count.comments
      })),
      total
    };
  }

  async createPost(input: {
    userId: string;
    title: string;
    content: string;
    tags?: string[];
    language?: string;
  }): Promise<Post> {
    const r = await this.prisma.post.create({
      data: {
        id: crypto.randomUUID(),
        userId: input.userId,
        title: input.title,
        content: input.content,
        tags: JSON.stringify(input.tags ?? []),
        language: input.language ?? "zh",
        likes: 0,
        views: 0,
        pinned: false
      },
      include: { user: { select: { id: true, displayName: true } } }
    });
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      language: r.language as Post["language"],
      likes: r.likes,
      views: r.views,
      pinned: r.pinned,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: r.user
    };
  }

  async getPost(id: string): Promise<Post | null> {
    const r = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, displayName: true } } }
        }
      }
    });
    if (!r) return null;

    // 增加浏览量
    await this.prisma.post.update({ where: { id }, data: { views: { increment: 1 } } });

    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags),
      language: r.language as Post["language"],
      likes: r.likes,
      views: r.views + 1,
      pinned: r.pinned,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: r.user,
      comments: r.comments.map((c: any) => ({
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        user: c.user
      }))
    };
  }

  async deletePost(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  async createComment(postId: string, userId: string, content: string): Promise<Comment> {
    const r = await this.prisma.comment.create({
      data: {
        id: crypto.randomUUID(),
        postId,
        userId,
        content
      },
      include: { user: { select: { id: true, displayName: true } } }
    });
    return {
      id: r.id,
      postId: r.postId,
      userId: r.userId,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      user: r.user
    };
  }

  async togglePostLike(postId: string, userId: string): Promise<{ liked: boolean; likes: number }> {
    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      await this.prisma.post.update({ where: { id: postId }, data: { likes: { decrement: 1 } } });
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      return { liked: false, likes: post?.likes ?? 0 };
    } else {
      await this.prisma.postLike.create({
        data: { id: crypto.randomUUID(), postId, userId }
      });
      await this.prisma.post.update({ where: { id: postId }, data: { likes: { increment: 1 } } });
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      return { liked: true, likes: post?.likes ?? 0 };
    }
  }

  // ============================================================
  // 翻译（缓存 + 多服务商切换）
  // ============================================================

  /**
   * 翻译文本 — 支持多服务商切换
   * 通过环境变量 TRANSLATION_PROVIDER 控制：
   *   - "libretranslate"（默认）：LibreTranslate 免费 API
   *   - "deepseek"：DeepSeek API（需配置 DEEPSEEK_API_KEY）
   *   - "dummy"：返回原文（开发调试用）
   */
  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
    // 检查缓存
    const cached = await this.prisma.translationCache.findUnique({
      where: {
        sourceText_sourceLang_targetLang: { sourceText: text, sourceLang, targetLang }
      }
    });
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return {
        translatedText: cached.translatedText,
        sourceLang,
        targetLang
      };
    }

    // 根据环境变量选择翻译服务商
    const provider = (process.env.TRANSLATION_PROVIDER || "libretranslate").toLowerCase();
    let translatedText: string;

    try {
      switch (provider) {
        case "deepseek":
          translatedText = await this.translateWithDeepSeek(text, sourceLang, targetLang);
          break;
        case "dummy":
          translatedText = text; // 开发调试：返回原文
          break;
        case "libretranslate":
        default:
          translatedText = await this.translateWithLibreTranslate(text, sourceLang, targetLang);
          break;
      }
    } catch (error) {
      console.warn(`[Translation] ${provider} failed, falling back to original text:`, error);
      // 降级：返回原文
      return { translatedText: text, sourceLang, targetLang };
    }

    // 缓存结果（7天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.translationCache.upsert({
      where: {
        sourceText_sourceLang_targetLang: { sourceText: text, sourceLang, targetLang }
      },
      create: {
        id: crypto.randomUUID(),
        sourceText: text,
        sourceLang,
        targetLang,
        translatedText,
        expiresAt
      },
      update: {
        translatedText,
        expiresAt
      }
    });

    return { translatedText, sourceLang, targetLang };
  }

  /**
   * LibreTranslate 翻译（默认方案）
   */
  private async translateWithLibreTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text"
      })
    });

    if (!response.ok) throw new Error(`LibreTranslate API error: ${response.status}`);
    const result = await response.json();
    return result.translatedText;
  }

  /**
   * DeepSeek 翻译（备用方案，通过环境变量切换）
   */
  private async translateWithDeepSeek(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const langMap: Record<string, string> = {
      zh: "Chinese",
      ja: "Japanese",
      en: "English"
    };

    const sourceName = langMap[sourceLang] || sourceLang;
    const targetName = langMap[targetLang] || targetLang;

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a translator. Translate the following text from ${sourceName} to ${targetName}. Return ONLY the translated text, no explanations.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || text;
  }
}

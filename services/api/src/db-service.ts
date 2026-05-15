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
  BackupPayload
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
  // 课程表 CRUD（教师日历版）
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
}

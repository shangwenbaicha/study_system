import type {
  AgendaItem,
  CalendarEvent,
  CalendarRenderable,
  CourseItem,
  ModuleName,
  StudyTask
} from "../../../packages/domain/src/index.js";
import { MemoryStore } from "./memory-store.js";

abstract class ModuleBase<T extends { id: string }>
  implements CalendarRenderable
{
  constructor(
    protected readonly store: MemoryStore,
    protected readonly moduleName: ModuleName
  ) {}

  protected log(entityId: string, operation: "create" | "update" | "delete", field?: string, value?: unknown) {
    const ts = new Date().toISOString();
    this.store.syncLogs.push({
      id: `${this.moduleName}_${entityId}_${ts}`,
      module: this.moduleName,
      entityId,
      operation,
      field,
      value,
      ts
    });
    this.store.auditLogs.push({
      id: `${this.moduleName}_${entityId}_${ts}_audit`,
      module: this.moduleName,
      entityId,
      message: `${operation}${field ? `:${field}` : ""}`,
      ts
    });
  }

  abstract toCalendarEvents(): Promise<CalendarEvent[]>;
}

export class CourseModuleService extends ModuleBase<CourseItem> {
  constructor(store: MemoryStore) {
    super(store, "schedule-course");
  }

  async list() {
    return [...this.store.courses.values()];
  }

  async create(item: CourseItem) {
    this.store.courses.set(item.id, item);
    this.log(item.id, "create");
  }

  async toCalendarEvents(): Promise<CalendarEvent[]> {
    return (await this.list()).map((item) => ({
      sourceModule: "schedule-course",
      title: item.courseName,
      startAt: item.startAt,
      endAt: item.endAt,
      tag: item.teacher,
      priority: "medium",
      metaRefId: item.id,
      color: item.color
    }));
  }

  async compute(period: { from: string; to: string }): Promise<Record<string, number>> {
    const courses = await this.list();
    const from = new Date(period.from).getTime();
    const to = new Date(period.to).getTime();
    const inRange = courses.filter((item) => {
      const courseDate = new Date(item.startAt).getTime();
      return courseDate >= from && courseDate <= to;
    });
    return { totalCourses: inRange.length };
  }
}

export class StudyPlanModuleService extends ModuleBase<StudyTask> {
  constructor(store: MemoryStore) {
    super(store, "study-plan");
  }

  async list() {
    return [...this.store.studyTasks.values()];
  }

  async create(item: StudyTask) {
    this.store.studyTasks.set(item.id, item);
    this.log(item.id, "create");
  }

  async toCalendarEvents(): Promise<CalendarEvent[]> {
    return (await this.list()).map((item) => ({
      sourceModule: "study-plan",
      title: item.taskDetail,
      startAt: `${item.startDate}T10:00:00.000Z`,
      endAt: `${item.startDate}T11:00:00.000Z`,
      tag: item.subject,
      priority: item.priority,
      reminderAt: `${item.startDate}T09:45:00.000Z`,
      metaRefId: item.id
    }));
  }

  async compute(period: { from: string; to: string }): Promise<Record<string, number>> {
    const tasks = await this.list();
    const from = new Date(period.from).getTime();
    const to = new Date(period.to).getTime();
    const inRange = tasks.filter((task) => {
      const start = new Date(task.startDate).getTime();
      return start >= from && start <= to;
    });
    const done = inRange.filter((task) => task.status === "done").length;
    return { totalTasks: inRange.length, completedTasks: done };
  }
}

export class DailyAgendaModuleService extends ModuleBase<AgendaItem> {
  constructor(store: MemoryStore) {
    super(store, "daily-agenda");
  }

  async list() {
    return [...this.store.agendaItems.values()];
  }

  async create(item: AgendaItem) {
    this.store.agendaItems.set(item.id, item);
    this.log(item.id, "create");
  }

  async toCalendarEvents(): Promise<CalendarEvent[]> {
    return (await this.list()).map((item) => ({
      sourceModule: "daily-agenda",
      title: item.title,
      startAt: item.startAt,
      endAt: item.endAt,
      tag: item.tags.join(","),
      priority: item.priority,
      reminderAt: item.reminderAt,
      metaRefId: item.id
    }));
  }

  async compute(period: { from: string; to: string }): Promise<Record<string, number>> {
    const items = await this.list();
    const from = new Date(period.from).getTime();
    const to = new Date(period.to).getTime();
    const inRange = items.filter((item) => {
      const start = new Date(item.startAt).getTime();
      return start >= from && start <= to;
    });
    const busyDays = new Set(inRange.map((item) => item.startAt.slice(0, 10))).size;
    return { totalItems: inRange.length, busyDays };
  }
}

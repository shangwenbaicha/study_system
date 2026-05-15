import type {
  AgendaItem,
  CourseItem,
  StudyTask,
  Workspace
} from "../../../packages/domain/src/index.js";

export interface SyncLogRecord {
  id: string;
  module: "schedule-course" | "study-plan" | "daily-agenda";
  entityId: string;
  operation: "create" | "update" | "delete";
  field?: string;
  value?: unknown;
  ts: string;
}

export interface AuditRecord {
  id: string;
  module: "schedule-course" | "study-plan" | "daily-agenda";
  entityId: string;
  message: string;
  ts: string;
}

export interface StoreSnapshot {
  courses: CourseItem[];
  studyTasks: StudyTask[];
  agendaItems: AgendaItem[];
  syncLogs: SyncLogRecord[];
  auditLogs: AuditRecord[];
  workspaces: Workspace[];
}

export class MemoryStore {
  readonly courses = new Map<string, CourseItem>();
  readonly studyTasks = new Map<string, StudyTask>();
  readonly agendaItems = new Map<string, AgendaItem>();
  readonly syncLogs: SyncLogRecord[] = [];
  readonly auditLogs: AuditRecord[] = [];
  readonly workspaces = new Map<string, Workspace>();

  snapshot(): StoreSnapshot {
    return {
      courses: [...this.courses.values()],
      studyTasks: [...this.studyTasks.values()],
      agendaItems: [...this.agendaItems.values()],
      syncLogs: [...this.syncLogs],
      auditLogs: [...this.auditLogs],
      workspaces: [...this.workspaces.values()]
    };
  }

  restore(snapshot: StoreSnapshot): void {
    this.courses.clear();
    this.studyTasks.clear();
    this.agendaItems.clear();
    this.workspaces.clear();
    snapshot.courses.forEach((course) => this.courses.set(course.id, course));
    snapshot.studyTasks.forEach((task) => this.studyTasks.set(task.id, task));
    snapshot.agendaItems.forEach((item) => this.agendaItems.set(item.id, item));
    snapshot.workspaces.forEach((ws) => this.workspaces.set(ws.id, ws));
    this.syncLogs.splice(0, this.syncLogs.length, ...snapshot.syncLogs);
    this.auditLogs.splice(0, this.auditLogs.length, ...snapshot.auditLogs);
  }
}

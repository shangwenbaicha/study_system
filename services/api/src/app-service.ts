import {
  DefaultAnalyticsEngine,
  DefaultCalendarEngine,
  GoogleConnectorStub,
  InAppNotifyEngine,
  JsonBackupEngine,
  MemoryChartEngine,
  MemoryPdfEngine
} from "../../../packages/common-engines/src/index.js";
import type { ModuleName, Workspace } from "../../../packages/domain/src/index.js";
import { MemoryStore } from "./memory-store.js";
import {
  CourseModuleService,
  DailyAgendaModuleService,
  StudyPlanModuleService
} from "./modules.js";

export class StudySystemService {
  readonly store = new MemoryStore();
  readonly course = new CourseModuleService(this.store);
  readonly study = new StudyPlanModuleService(this.store);
  readonly agenda = new DailyAgendaModuleService(this.store);

  readonly pdf = new MemoryPdfEngine();
  readonly chart = new MemoryChartEngine();
  readonly notify = new InAppNotifyEngine();
  readonly googleConnector = new GoogleConnectorStub();
  readonly calendar = new DefaultCalendarEngine({
    "schedule-course": this.course,
    "study-plan": this.study,
    "daily-agenda": this.agenda
  });
  readonly analytics = new DefaultAnalyticsEngine({
    "schedule-course": { compute: (period: { from: string; to: string }) => this.course.compute(period) } as any,
    "study-plan": { compute: (period: { from: string; to: string }) => this.study.compute(period) } as any,
    "daily-agenda": { compute: (period: { from: string; to: string }) => this.agenda.compute(period) } as any,
  } as any);
  readonly backup = new JsonBackupEngine(
    async () => this.store.snapshot() as unknown as Record<string, unknown>,
    async (snapshot) => this.store.restore(snapshot as unknown as ReturnType<MemoryStore["snapshot"]>)
  );

  createWorkspace(workspace: Workspace) {
    this.store.workspaces.set(workspace.id, workspace);
  }

  listWorkspaceMembers(workspaceId: string) {
    return this.store.workspaces.get(workspaceId)?.members ?? [];
  }

  async renderCalendar(
    modules: ModuleName[],
    from: string,
    to: string,
    workspaceId: string
  ) {
    return this.calendar.render({ modules, from, to, workspaceId });
  }
}

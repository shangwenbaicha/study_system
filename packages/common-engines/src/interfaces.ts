import type { CalendarEvent, ModuleName } from "../../domain/src/index.js";

export type PdfTemplate = "simple" | "formal" | "student";
export type PdfRange = "single" | "week" | "month" | "year" | "report";

export type ChartType = "pie" | "bar" | "line";

export interface PdfEngine {
  export(
    module: ModuleName,
    range: PdfRange,
    template: PdfTemplate,
    includeCharts: boolean,
    data: unknown,
    context?: {
      year?: number;
      month?: number;
    }
  ): Promise<Uint8Array>;
}

export interface ChartEngine {
  generate(
    type: ChartType,
    dataset: Array<{ label: string; value: number }>,
    theme: "light" | "dark"
  ): Promise<{ format: "png" | "svg"; data: string }>;
}

export interface CalendarEngine {
  render(filters: {
    modules: ModuleName[];
    from: string;
    to: string;
    workspaceId: string;
  }): Promise<CalendarEvent[]>;
}

export interface NotifyEngine {
  schedule(eventId: string, remindAt: string, channel: "in-app"): Promise<void>;
  cancel(eventId: string, channel: "in-app"): Promise<void>;
}

export interface BackupEngine {
  export(scope: ModuleName | "all", encrypted: boolean): Promise<string>;
  import(payload: string): Promise<void>;
  archive(scope: ModuleName | "all"): Promise<string>;
}

export interface AnalyticsEngine {
  compute(module: ModuleName, period: { from: string; to: string }): Promise<Record<string, number>>;
}

export interface CalendarConnector {
  pushEvents(events: CalendarEvent[]): Promise<void>;
  pullChanges(sinceISO: string): Promise<CalendarEvent[]>;
  mapExternalId(localId: string): Promise<string>;
}

import PDFDocument from "pdfkit";
import fs from "fs";
import type {
  AnalyticsComputable,
  CalendarEvent,
  CalendarRenderable,
  ModuleName
} from "../../domain/src/index.js";
import type {
  AnalyticsEngine,
  BackupEngine,
  CalendarConnector,
  CalendarEngine,
  ChartEngine,
  NotifyEngine,
  PdfEngine
} from "./interfaces.js";

type CoursePdfItem = {
  courseName: string;
  teacher: string;
  startAt: string;
  endAt: string;
  timezone: "Asia/Shanghai" | "Asia/Tokyo" | string;
  color?: string;
  note?: string;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function registerChineseFont(doc: PDFKit.PDFDocument): boolean {
  const fontConfigs: Array<{ path: string; regularName: string; boldName: string }> = [
    { path: "C:/Windows/Fonts/yahei.ttf", regularName: "ChineseFont", boldName: "ChineseFont-Bold" },
    { path: "C:/Windows/Fonts/simhei.ttf", regularName: "ChineseFont", boldName: "ChineseFont-Bold" },
  ];

  for (const cfg of fontConfigs) {
    if (!fs.existsSync(cfg.path)) continue;
    try {
      doc.registerFont(cfg.regularName, cfg.path);
      try {
        doc.registerFont(cfg.boldName, cfg.path);
      } catch {
        doc.registerFont(cfg.boldName, cfg.path);
      }
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function toTimezoneParts(isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") {
  const offsetMinutes = timezone === "Asia/Tokyo" ? 9 * 60 : 8 * 60;
  const shifted = new Date(new Date(isoStr).getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function toTimezoneDateKey(isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") {
  const p = toTimezoneParts(isoStr, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function toTimezoneTimeLabel(isoStr: string, timezone: "Asia/Shanghai" | "Asia/Tokyo") {
  const p = toTimezoneParts(isoStr, timezone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function formatDurationLabel(startAt: string, endAt: string) {
  const diffMin = Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function normalizeTimezone(timezone: string): "Asia/Shanghai" | "Asia/Tokyo" {
  return timezone === "Asia/Tokyo" ? "Asia/Tokyo" : "Asia/Shanghai";
}

export class MemoryPdfEngine implements PdfEngine {
  private chineseFontAvailable = false;

  private getFont(bold = false): string {
    if (this.chineseFontAvailable) {
      return "ChineseFont" + (bold ? "-Bold" : "");
    }
    return bold ? "Helvetica-Bold" : "Helvetica";
  }

  async export(
    module: ModuleName,
    range: "single" | "week" | "month" | "year" | "report",
    template: "simple" | "formal" | "student",
    includeCharts: boolean,
    data: unknown,
    context?: {
      year?: number;
      month?: number;
    }
  ): Promise<Uint8Array> {
    const isCourseModule = module === "schedule-course";
    const doc = new PDFDocument({
      size: "A4",
      layout: isCourseModule ? "landscape" : "portrait",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `${module} - ${range}`,
        Author: "Study System",
        Subject: module,
      },
    });

    this.chineseFontAvailable = registerChineseFont(doc);

    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));

    return new Promise<Uint8Array>((resolve, reject) => {
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(new Uint8Array(pdfBuffer));
      });
      doc.on("error", reject);

      if (module === "schedule-course") {
        this.renderCalendarGrid(doc, data, range, context);
      } else if (module === "study-plan") {
        this.renderStudyTable(doc, data);
      } else if (module === "daily-agenda") {
        this.renderAgendaTable(doc, data);
      }

      doc.end();
    });
  }

  private renderCalendarGrid(
    doc: PDFKit.PDFDocument,
    data: unknown,
    range: string,
    context?: {
      year?: number;
      month?: number;
    }
  ) {
    const courses = data as CoursePdfItem[];

    if (!courses || courses.length === 0) {
      doc.fontSize(12).font(this.getFont()).text("暂无课程数据", { align: "center" });
      return;
    }

    if (
      range === "month" &&
      context?.year !== undefined &&
      context?.month !== undefined &&
      context.month >= 1 &&
      context.month <= 12
    ) {
      this.renderSingleMonth(doc, courses, context.year, context.month - 1);
      return;
    }

    const monthSet = new Set<string>();
    courses.forEach((course) => {
      const tz = normalizeTimezone(course.timezone);
      const key = toTimezoneDateKey(course.startAt, tz);
      const [y, m] = key.split("-");
      monthSet.add(`${y}-${Number(m) - 1}`);
    });

    const sortedMonths = Array.from(monthSet).sort();
    sortedMonths.forEach((monthKey, idx) => {
      if (idx > 0) doc.addPage();
      const [y, m] = monthKey.split("-").map(Number);
      this.renderSingleMonth(doc, courses, y, m);
    });

    if (sortedMonths.length === 0) {
      const now = new Date();
      this.renderSingleMonth(doc, courses, now.getFullYear(), now.getMonth());
    }
  }

  private renderSingleMonth(doc: PDFKit.PDFDocument, courses: CoursePdfItem[], year: number, month: number) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const startX = 50;
    const usableWidth = doc.page.width - 100;
    const cellWidth = usableWidth / 7;
    const headerHeight = 20;
    const dayLabelHeight = 10;
    const minSegmentHeight = 24;
    const minRowHeight = 46;

    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const coursesByDate = new Map<string, CoursePdfItem[]>();
    courses.forEach((course) => {
      const tz = normalizeTimezone(course.timezone);
      const dateKey = toTimezoneDateKey(course.startAt, tz);
      if (!dateKey.startsWith(monthPrefix)) return;
      if (!coursesByDate.has(dateKey)) coursesByDate.set(dateKey, []);
      coursesByDate.get(dateKey)!.push(course);
    });
    coursesByDate.forEach((list) =>
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    );

    type WeekCell = { day: number | null; courses: CoursePdfItem[]; dateKey: string | null };
    type WeekRow = { cells: WeekCell[]; height: number };
    const weeks: WeekRow[] = [];

    let dayCounter = 1;
    const rows = Math.ceil((firstDay + daysInMonth) / 7);
    for (let row = 0; row < rows; row++) {
      const cells: WeekCell[] = [];
      let maxDayCourses = 0;
      for (let col = 0; col < 7; col++) {
        if ((row === 0 && col < firstDay) || dayCounter > daysInMonth) {
          cells.push({ day: null, courses: [], dateKey: null });
          continue;
        }

        const day = dayCounter;
        dayCounter++;
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayCourses = coursesByDate.get(dateKey) ?? [];
        maxDayCourses = Math.max(maxDayCourses, dayCourses.length);
        cells.push({ day, courses: dayCourses, dateKey });
      }

      const rowHeight = Math.max(minRowHeight, dayLabelHeight + maxDayCourses * minSegmentHeight + 4);
      weeks.push({ cells, height: rowHeight });
    }

    const drawHeader = (continued = false) => {
      doc
        .fontSize(15.5)
        .font(this.getFont(true))
        .text(`${year}年${month + 1}月${continued ? "（续）" : ""}`, { align: "center" });
      doc.moveDown(0.3);

      const y = doc.y;
      doc.fontSize(9.5).font(this.getFont(true));
      WEEKDAYS.forEach((day, i) => {
        const x = startX + i * cellWidth;
        doc.text(day, x, y, { width: cellWidth, align: "center" });
      });
      const headerBottomY = y + headerHeight;
      doc
        .moveTo(startX, headerBottomY)
        .lineTo(startX + cellWidth * 7, headerBottomY)
        .strokeColor("#333333")
        .stroke();
      return headerBottomY + 2;
    };

    let currentY = drawHeader(false);
    const pageBottom = doc.page.height - 60;

    for (const week of weeks) {
      if (currentY + week.height > pageBottom) {
        doc.addPage();
        currentY = drawHeader(true);
      }

      week.cells.forEach((cell, col) => {
        const x = startX + col * cellWidth;
        const y = currentY;
        doc.rect(x, y, cellWidth, week.height).strokeColor("#e0e0e0").stroke();

        if (cell.day === null || !cell.dateKey) return;

        doc
          .fontSize(8.5)
          .font(this.getFont(true))
          .fillColor("#333333")
          .text(String(cell.day), x + 2, y + 2, { width: cellWidth - 4, align: "left" });

        if (cell.courses.length === 0) return;

        // Fill the whole day content area with equal-height colored segments.
        const contentTop = y + dayLabelHeight;
        const contentBottom = y + week.height - 1;
        const segmentHeight = (contentBottom - contentTop) / cell.courses.length;
        cell.courses.forEach((course, idx) => {
          const tz = normalizeTimezone(course.timezone);
          const color = course.color || "#6366f1";
          const timeRange = `${toTimezoneTimeLabel(course.startAt, tz)}-${toTimezoneTimeLabel(course.endAt, tz)}`;
          const duration = formatDurationLabel(course.startAt, course.endAt);
          const segmentTop = contentTop + segmentHeight * idx;
          const segmentBottom = idx === cell.courses.length - 1 ? contentBottom : contentTop + segmentHeight * (idx + 1);
          const segmentBoxHeight = Math.max(1, segmentBottom - segmentTop);
          const colGap = 4;
          const innerX = x + 4;
          const innerWidth = cellWidth - 8;
          const colWidth = (innerWidth - colGap) / 2;

          doc.rect(x + 1, segmentTop, cellWidth - 2, segmentBoxHeight).fillColor(color).fill();

          // Two-line, two-column layout for compact readability.
          doc.fontSize(6.6).font(this.getFont(true)).fillColor("#111111").text(course.courseName, innerX, segmentTop + 2, {
            width: colWidth,
            ellipsis: true,
          });
          doc.fontSize(6.2).font(this.getFont(true)).fillColor("#111111").text(timeRange, innerX + colWidth + colGap, segmentTop + 2, {
            width: colWidth,
            align: "right",
            ellipsis: true,
          });
          doc.fontSize(6.2).font(this.getFont(true)).fillColor("#111111").text(course.teacher, innerX, segmentTop + 12, {
            width: colWidth,
            ellipsis: true,
          });
          doc.fontSize(6).font(this.getFont(true)).fillColor("#111111").text(duration, innerX + colWidth + colGap, segmentTop + 12, {
            width: colWidth,
            align: "right",
            ellipsis: true,
          });
          doc.fillColor("#000000");
        });
      });

      currentY += week.height;
    }

    doc.y = currentY + 10;
  }

  private renderStudyTable(doc: PDFKit.PDFDocument, data: unknown) {
    const tasks = data as Array<{
      subject: string;
      taskDetail: string;
      status: string;
      startDate: string;
      dueDate?: string;
      priority: string;
    }>;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      doc.fontSize(12).font(this.getFont()).text("暂无学习任务数据", { align: "center" });
      return;
    }

    const headers = ["科目", "任务", "状态", "开始", "截止", "优先级"];
    const colWidths = [70, 165, 60, 70, 70, 60];
    const startX = 50;
    let currentY = doc.y;

    doc.font(this.getFont(true)).fontSize(10);
    let xPos = startX;
    headers.forEach((header, i) => {
      doc.text(header, xPos, currentY, { width: colWidths[i], align: "left" });
      xPos += colWidths[i];
    });

    currentY += 18;
    doc
      .moveTo(startX, currentY)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY)
      .strokeColor("#333333")
      .stroke();
    currentY += 5;

    doc.font(this.getFont()).fontSize(9);
    tasks.forEach((task, rowIndex) => {
      if (currentY > doc.page.height - 80) {
        doc.addPage();
        currentY = 50;
      }

      if (rowIndex % 2 === 0) {
        doc
          .rect(startX, currentY - 2, colWidths.reduce((a, b) => a + b, 0), 16)
          .fillColor("#f0f0f0")
          .fill();
        doc.fillColor("#000000");
      }

      const statusLabels: Record<string, string> = { todo: "待办", doing: "进行中", done: "已完成" };
      const priorityLabels: Record<string, string> = { low: "低", medium: "中", high: "高" };

      xPos = startX;
      const rowData = [
        task.subject,
        task.taskDetail,
        statusLabels[task.status] ?? task.status,
        task.startDate,
        task.dueDate ?? "-",
        priorityLabels[task.priority] ?? task.priority,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos, currentY, { width: colWidths[i], align: "left" });
        xPos += colWidths[i];
      });

      currentY += 16;
    });
  }

  private renderAgendaTable(doc: PDFKit.PDFDocument, data: unknown) {
    const items = data as Array<{
      title: string;
      startAt: string;
      endAt: string;
      category: string;
      priority: string;
      status: string;
      location?: string;
    }>;

    if (!Array.isArray(items) || items.length === 0) {
      doc.fontSize(12).font(this.getFont()).text("暂无日程数据", { align: "center" });
      return;
    }

    const headers = ["标题", "开始", "结束", "分类", "优先级", "状态"];
    const colWidths = [120, 80, 80, 60, 60, 60];
    const startX = 50;
    let currentY = doc.y;

    doc.font(this.getFont(true)).fontSize(10);
    let xPos = startX;
    headers.forEach((header, i) => {
      doc.text(header, xPos, currentY, { width: colWidths[i], align: "left" });
      xPos += colWidths[i];
    });

    currentY += 18;
    doc
      .moveTo(startX, currentY)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY)
      .strokeColor("#333333")
      .stroke();
    currentY += 5;

    doc.font(this.getFont()).fontSize(9);
    items.forEach((item, rowIndex) => {
      if (currentY > doc.page.height - 80) {
        doc.addPage();
        currentY = 50;
      }

      if (rowIndex % 2 === 0) {
        doc
          .rect(startX, currentY - 2, colWidths.reduce((a, b) => a + b, 0), 16)
          .fillColor("#f0f0f0")
          .fill();
        doc.fillColor("#000000");
      }

      const formatTime = (isoStr: string) => {
        const d = new Date(isoStr);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      };

      const categoryLabels: Record<string, string> = {
        work: "工作",
        study: "学习",
        health: "健康",
        social: "社交",
        other: "其他",
      };
      const priorityLabels: Record<string, string> = { low: "低", medium: "中", high: "高" };
      const statusLabels: Record<string, string> = { todo: "待办", done: "已完成" };

      xPos = startX;
      const rowData = [
        item.title,
        `${item.startAt.slice(0, 10)} ${formatTime(item.startAt)}`,
        `${item.endAt.slice(0, 10)} ${formatTime(item.endAt)}`,
        categoryLabels[item.category] ?? item.category,
        priorityLabels[item.priority] ?? item.priority,
        statusLabels[item.status] ?? item.status,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos, currentY, { width: colWidths[i], align: "left" });
        xPos += colWidths[i];
      });

      currentY += 16;
    });
  }
}

export class MemoryChartEngine implements ChartEngine {
  async generate(
    type: "pie" | "bar" | "line",
    dataset: Array<{ label: string; value: number }>,
    theme: "light" | "dark"
  ): Promise<{ format: "png" | "svg"; data: string }> {
    return {
      format: "svg",
      data: `<svg data-type="${type}" data-theme="${theme}" data-size="${dataset.length}" />`
    };
  }
}

export class DefaultCalendarEngine implements CalendarEngine {
  constructor(private readonly sources: Record<ModuleName, CalendarRenderable>) {}

  async render(filters: {
    modules: ModuleName[];
    from: string;
    to: string;
    workspaceId: string;
  }) {
    const rawEvents = await Promise.all(
      filters.modules.map((module) => this.sources[module].toCalendarEvents(filters.workspaceId))
    );
    const from = new Date(filters.from).getTime();
    const to = new Date(filters.to).getTime();
    return rawEvents.flat().filter((event) => {
      const startAt = new Date(event.startAt).getTime();
      return startAt >= from && startAt <= to;
    });
  }
}

export class DefaultAnalyticsEngine implements AnalyticsEngine {
  constructor(private readonly sources: Record<ModuleName, AnalyticsComputable>) {}

  async compute(module: ModuleName, period: { from: string; to: string }): Promise<Record<string, number>> {
    const source = this.sources[module] as any;
    if (source && typeof source.compute === "function") {
      const result = await source.compute(period);
      return result as Record<string, number>;
    }
    throw new Error(`Analytics source for ${module} does not implement compute(period)`);
  }
}

export class JsonBackupEngine implements BackupEngine {
  constructor(
    private readonly snapshotLoader: () => Promise<Record<string, unknown>>,
    private readonly snapshotWriter: (payload: Record<string, unknown>) => Promise<void>
  ) {}

  async export(scope: ModuleName | "all", encrypted: boolean): Promise<string> {
    const snapshot = await this.snapshotLoader();
    const payload = JSON.stringify({ scope, encrypted, snapshot });
    return encrypted ? Buffer.from(payload).toString("base64") : payload;
  }

  async import(payload: string): Promise<void> {
    const decoded = payload.trim().startsWith("{")
      ? payload
      : Buffer.from(payload, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { snapshot: Record<string, unknown> };
    await this.snapshotWriter(parsed.snapshot);
  }

  async archive(scope: ModuleName | "all"): Promise<string> {
    return `archive://${scope}/${Date.now()}`;
  }
}

export class InAppNotifyEngine implements NotifyEngine {
  private readonly reminders = new Map<string, { remindAt: string; channel: "in-app" }>();

  async schedule(eventId: string, remindAt: string, channel: "in-app"): Promise<void> {
    this.reminders.set(eventId, { remindAt, channel });
  }

  async cancel(eventId: string, channel: "in-app"): Promise<void> {
    const existing = this.reminders.get(eventId);
    if (existing?.channel === channel) this.reminders.delete(eventId);
  }
}

export class GoogleConnectorStub implements CalendarConnector {
  private readonly map = new Map<string, string>();

  async pushEvents(events: CalendarEvent[]): Promise<void> {
    void events;
    return;
  }

  async pullChanges(sinceISO: string): Promise<CalendarEvent[]> {
    void sinceISO;
    return [];
  }

  async mapExternalId(localId: string): Promise<string> {
    if (!this.map.has(localId)) {
      this.map.set(localId, `google_${localId}`);
    }
    return this.map.get(localId)!;
  }
}

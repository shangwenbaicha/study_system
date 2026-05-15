import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { MemoryPdfEngine } from "../packages/common-engines/src/implementations.js";

const getFirstPageSize = (pdfBytes: Uint8Array) => {
  const raw = Buffer.from(pdfBytes).toString("latin1");
  const match = raw.match(/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
  if (!match) throw new Error("MediaBox not found in PDF");
  return { width: Number(match[1]), height: Number(match[2]) };
};

describe("pdf export strips decorative header/footer text", () => {
  it("does not render top title/export-time/divider-footer texts for all modules", async () => {
    const engine = new MemoryPdfEngine();
    const capturedTexts: string[] = [];
    let schedulePdf = new Uint8Array();
    let studyPdf = new Uint8Array();
    let agendaPdf = new Uint8Array();

    const originalText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patchedText(text: any, ...args: any[]) {
      capturedTexts.push(String(text));
      return originalText.call(this, text, ...args);
    };

    try {
      schedulePdf = await engine.export(
        "schedule-course",
        "month",
        "simple",
        false,
        [
          {
            courseName: "Math",
            teacher: "T1",
            startAt: "2026-05-10T01:00:00.000Z",
            endAt: "2026-05-10T02:00:00.000Z",
            timezone: "Asia/Shanghai",
            color: "#6366f1",
          },
        ],
        { year: 2026, month: 5 }
      );

      studyPdf = await engine.export(
        "study-plan",
        "month",
        "simple",
        false,
        [
          {
            subject: "English",
            taskDetail: "Read chapter 1",
            status: "todo",
            startDate: "2026-05-10",
            dueDate: "2026-05-12",
            priority: "high",
          },
        ]
      );

      agendaPdf = await engine.export(
        "daily-agenda",
        "month",
        "simple",
        false,
        [
          {
            title: "Meeting",
            startAt: "2026-05-11T01:00:00.000Z",
            endAt: "2026-05-11T02:00:00.000Z",
            category: "work",
            priority: "medium",
            status: "todo",
          },
        ]
      );
    } finally {
      PDFDocument.prototype.text = originalText;
    }

    const rendered = capturedTexts.join("\n");
    expect(rendered).not.toContain("导出时间");
    expect(rendered).not.toContain("Study System -");
    expect(rendered).not.toContain("课程表 - 月");
    expect(rendered).not.toContain("学习计划 - 月");
    expect(rendered).not.toContain("日程安排 - 月");

    const scheduleSize = getFirstPageSize(schedulePdf);
    const studySize = getFirstPageSize(studyPdf);
    const agendaSize = getFirstPageSize(agendaPdf);
    expect(scheduleSize.width).toBeGreaterThan(scheduleSize.height);
    expect(studySize.width).toBeLessThan(studySize.height);
    expect(agendaSize.width).toBeLessThan(agendaSize.height);
  });
});

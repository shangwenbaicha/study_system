import { describe, expect, it } from "vitest";
import { MemoryPdfEngine } from "../packages/common-engines/src/implementations.js";

type TextCall = { text: string };
type RectCall = { width: number; height: number };

class FakePdfDoc {
  public y = 80;
  public page = { width: 595.28, height: 842 };
  public textCalls: TextCall[] = [];
  public rectCalls: RectCall[] = [];
  public addPageCount = 0;

  constructor(height = 842, width = 595.28) {
    this.page.height = height;
    this.page.width = width;
  }

  fontSize(_size: number) {
    return this;
  }

  font(_fontName: string) {
    return this;
  }

  text(text: string, _x?: number, _y?: number, _options?: unknown) {
    this.textCalls.push({ text });
    return this;
  }

  moveDown(lines = 1) {
    this.y += lines * 12;
    return this;
  }

  moveTo(_x: number, _y: number) {
    return this;
  }

  lineTo(_x: number, _y: number) {
    return this;
  }

  strokeColor(_color: string) {
    return this;
  }

  stroke() {
    return this;
  }

  rect(_x: number, _y: number, width: number, height: number) {
    this.rectCalls.push({ width, height });
    return this;
  }

  fillColor(_color: string) {
    return this;
  }

  fill() {
    return this;
  }

  addPage() {
    this.addPageCount += 1;
    this.y = 80;
    return this;
  }
}

type CourseLike = {
  courseName: string;
  teacher: string;
  startAt: string;
  endAt: string;
  timezone: "Asia/Shanghai" | "Asia/Tokyo";
  color?: string;
};

describe("course pdf month grid renderer", () => {
  it("renders course card fields aligned with course page", () => {
    const engine = new MemoryPdfEngine();
    const doc = new FakePdfDoc();
    const courses: CourseLike[] = [
      {
        courseName: "Linear Algebra",
        teacher: "Prof Lee",
        startAt: "2026-05-12T01:00:00.000Z",
        endAt: "2026-05-12T02:30:00.000Z",
        timezone: "Asia/Shanghai",
        color: "#123456",
      },
    ];

    (engine as any).renderSingleMonth(doc, courses, 2026, 4);
    const allText = doc.textCalls.map((t) => t.text);

    expect(allText).toContain("Linear Algebra");
    expect(allText).toContain("09:00-10:30");
    expect(allText).toContain("Prof Lee");
    expect(allText).toContain("1h30m");

    const hasFullCardBlock = doc.rectCalls.some((r) => r.width >= 60 && r.width < 70);
    const hasLegacyColorStrip = doc.rectCalls.some((r) => r.width === 2);
    expect(hasFullCardBlock).toBe(true);
    expect(hasLegacyColorStrip).toBe(false);
  });

  it("fills a day cell by splitting equal color segments for two courses", () => {
    const engine = new MemoryPdfEngine();
    const doc = new FakePdfDoc();
    const courses: CourseLike[] = [
      {
        courseName: "Course A",
        teacher: "T1",
        startAt: "2026-05-12T01:00:00.000Z",
        endAt: "2026-05-12T02:00:00.000Z",
        timezone: "Asia/Shanghai",
        color: "#ff0000",
      },
      {
        courseName: "Course B",
        teacher: "T2",
        startAt: "2026-05-12T03:00:00.000Z",
        endAt: "2026-05-12T04:00:00.000Z",
        timezone: "Asia/Shanghai",
        color: "#00ff00",
      },
    ];

    (engine as any).renderSingleMonth(doc, courses, 2026, 4);

    const segmentHeights = doc.rectCalls
      .filter((r) => r.width >= 60 && r.width < 70)
      .map((r) => r.height);
    expect(segmentHeights.length).toBe(2);
    expect(Math.abs(segmentHeights[0] - segmentHeights[1])).toBeLessThan(2);
  });

  it("does not truncate to +Nmore and expands week row for dense days", () => {
    const engine = new MemoryPdfEngine();
    const doc = new FakePdfDoc();
    const courses: CourseLike[] = Array.from({ length: 5 }, (_, i) => ({
      courseName: `Course-${i + 1}`,
      teacher: `Teacher-${i + 1}`,
      startAt: `2026-05-12T0${i}:00:00.000Z`,
      endAt: `2026-05-12T0${i}:50:00.000Z`,
      timezone: "Asia/Shanghai",
      color: "#6366f1",
    }));

    (engine as any).renderSingleMonth(doc, courses, 2026, 4);
    const allText = doc.textCalls.map((t) => t.text);

    for (const c of courses) {
      expect(allText).toContain(c.courseName);
    }
    expect(allText.some((t) => t.includes("+N"))).toBe(false);

    const dayCellHeights = doc.rectCalls
      .filter((r) => r.width > 70)
      .map((r) => r.height);
    expect(Math.max(...dayCellHeights)).toBeGreaterThan(120);
  });

  it("paginates from week boundary when page cannot fit current week", () => {
    const engine = new MemoryPdfEngine();
    const doc = new FakePdfDoc(220);
    const courses: CourseLike[] = Array.from({ length: 6 }, (_, i) => ({
      courseName: `Packed-${i + 1}`,
      teacher: "Dense",
      startAt: `2026-05-12T0${i}:00:00.000Z`,
      endAt: `2026-05-12T0${i}:55:00.000Z`,
      timezone: "Asia/Shanghai",
      color: "#22c55e",
    }));

    (engine as any).renderSingleMonth(doc, courses, 2026, 4);
    expect(doc.addPageCount).toBeGreaterThan(0);
  });

  it("renders only requested month when month context is provided", () => {
    const engine = new MemoryPdfEngine();
    const doc = new FakePdfDoc();
    const courses: CourseLike[] = [
      {
        courseName: "MayOnly",
        teacher: "A",
        startAt: "2026-05-12T01:00:00.000Z",
        endAt: "2026-05-12T02:00:00.000Z",
        timezone: "Asia/Shanghai",
      },
      {
        courseName: "JuneShouldNotAppear",
        teacher: "B",
        startAt: "2026-06-12T01:00:00.000Z",
        endAt: "2026-06-12T02:00:00.000Z",
        timezone: "Asia/Shanghai",
      },
    ];

    (engine as any).renderCalendarGrid(doc, courses, "month", { year: 2026, month: 5 });
    const allText = doc.textCalls.map((t) => t.text);

    expect(allText).toContain("MayOnly");
    expect(allText).not.toContain("JuneShouldNotAppear");
  });
});

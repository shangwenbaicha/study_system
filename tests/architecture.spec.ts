import { describe, expect, it } from "vitest";
import { StudySystemService } from "../services/api/src/index.js";

describe("study-system architecture", () => {
  it("keeps module storage isolated", async () => {
    const app = new StudySystemService();
    await app.course.create({
      id: "c1",
      workspaceId: "w1",
      courseName: "Math",
      teacher: "T1",
      startAt: "2026-05-01T10:00:00.000Z",
      endAt: "2026-05-01T11:30:00.000Z",
      timezone: "Asia/Tokyo",
      color: "#000"
    });

    expect((await app.course.list()).length).toBe(1);
    expect((await app.study.list()).length).toBe(0);
    expect((await app.agenda.list()).length).toBe(0);
  });

  it("renders read-only aggregated calendar events", async () => {
    const app = new StudySystemService();
    await app.study.create({
      id: "s1",
      workspaceId: "w1",
      subject: "English",
      targetCycle: "2026-Q2",
      plannedMinutes: 60,
      taskDetail: "Read chapter 1",
      status: "todo",
      startDate: "2026-05-10",
      dueDate: "2026-05-12",
      priority: "high",
      reviewCycleDays: 2,
      pomodoroCount: 0,
      checkInDates: []
    });
    const events = await app.renderCalendar(
      ["study-plan"],
      "2026-05-01T00:00:00.000Z",
      "2026-05-31T23:59:59.999Z",
      "w1"
    );
    expect(events.length).toBe(1);
    expect(events[0].sourceModule).toBe("study-plan");
    expect((await app.study.list()).length).toBe(1);
  });

  it("supports backup export and import", async () => {
    const app = new StudySystemService();
    await app.agenda.create({
      id: "a1",
      workspaceId: "w1",
      title: "Dentist",
      startAt: "2026-05-15T01:00:00.000Z",
      endAt: "2026-05-15T02:00:00.000Z",
      tags: ["health"],
      priority: "medium",
      status: "todo",
      category: "other"
    });
    const payload = await app.backup.export("all", true);

    const another = new StudySystemService();
    await another.backup.import(payload);
    expect((await another.agenda.list()).length).toBe(1);
    expect((await another.agenda.list())[0].title).toBe("Dentist");
  });

  it("offers unified public engines", async () => {
    const app = new StudySystemService();
    const pdf = await app.pdf.export("daily-agenda", "month", "student", true, {});
    const chart = await app.chart.generate(
      "pie",
      [{ label: "study", value: 10 }],
      "light"
    );
    const stats = await app.analytics.compute("daily-agenda", {
      from: "2026-05-01",
      to: "2026-05-31"
    });

    expect(pdf.byteLength).toBeGreaterThan(0);
    expect(chart.format).toBe("svg");
    expect(typeof stats).toBe("object");
  });
});

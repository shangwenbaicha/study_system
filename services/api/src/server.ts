import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { DbStudySystemService } from "./db-service.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const service = new DbStudySystemService();

// ============================================================
// 中间件：简单 JWT 认证（开发阶段可绕过）
// ============================================================

// 开发阶段使用 header: x-workspace-id 来指定工作区
// 生产环境应替换为真实 JWT 认证
function getWorkspaceId(req: express.Request): string {
  const wsId = req.headers["x-workspace-id"] as string;
  if (wsId) return wsId;
  // 默认工作区（开发用）
  return "default";
}

// ============================================================
// 健康检查
// ============================================================

app.get("/api/health", async (_req, res) => {
  try {
    await service.assertDatabaseReady();
    res.json({ data: { status: "ok", now: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ error: { code: "DB_NOT_READY", message: (error as Error).message } });
  }
});

// ============================================================
// 用户 & 认证
// ============================================================

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      displayName: z.string().min(1)
    });
    const { email, password, displayName } = schema.parse(req.body);

    const existing = await service.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: { code: "EMAIL_EXISTS", message: "Email already registered" } });
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const user = await service.createUser(email, passwordHash, displayName);

    // 自动创建默认工作区
    const workspace = await service.createWorkspace(`${displayName}'s Workspace`, user.id);

    // 生成简单 token（生产环境应使用 JWT）
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");

    res.status(201).json({
      data: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        token,
        workspaceId: workspace.id
      }
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string()
    });
    const { email, password } = schema.parse(req.body);

    const user = await service.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }

    const workspaces = await service.getUserWorkspaces(user.id);
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");

    res.json({
      data: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        token,
        workspaces
      }
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 工作区
// ============================================================

app.get("/api/workspaces", async (_req, res, next) => {
  try {
    res.json({ data: await service.listWorkspaces() });
  } catch (e) {
    next(e);
  }
});

app.post("/api/workspaces", async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string(), ownerId: z.string() });
    const { name, ownerId } = schema.parse(req.body);
    const ws = await service.createWorkspace(name, ownerId);
    res.status(201).json({ data: ws });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 学期
// ============================================================

app.get("/api/semesters", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    res.json({ data: await service.listSemesters(wsId) });
  } catch (e) {
    next(e);
  }
});

app.post("/api/semesters", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      name: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      weekCount: z.number().int().min(1).max(30)
    });
    const parsed = schema.parse(req.body);
    const semester = await service.createSemester(parsed, wsId);
    res.status(201).json({ data: semester });
  } catch (e) {
    next(e);
  }
});

app.put("/api/semesters/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      weekCount: z.number().int().min(1).max(30).optional()
    });
    const parsed = schema.parse(req.body);
    const semester = await service.updateSemester(req.params.id, parsed);
    res.json({ data: semester });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/semesters/:id", async (req, res, next) => {
  try {
    await service.deleteSemester(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 课程表 CRUD
// ============================================================

app.get("/api/courses", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    res.json({ data: await service.listCourses(wsId) });
  } catch (e) {
    next(e);
  }
});

app.get("/api/courses/:id", async (req, res, next) => {
  try {
    const course = await service.getCourse(req.params.id);
    if (!course) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found" } });
    res.json({ data: course });
  } catch (e) {
    next(e);
  }
});

app.post("/api/courses", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      courseName: z.string(),
      teacher: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      timezone: z.enum(["Asia/Shanghai", "Asia/Tokyo"]),
      color: z.string(),
      note: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const course = await service.createCourse(parsed, wsId);
    res.status(201).json({ data: course });
  } catch (e) {
    next(e);
  }
});

app.put("/api/courses/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      courseName: z.string().optional(),
      teacher: z.string().optional(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      timezone: z.enum(["Asia/Shanghai", "Asia/Tokyo"]).optional(),
      color: z.string().optional(),
      note: z.string().nullable().optional()
    });
    const parsed = schema.parse(req.body);
    const course = await service.updateCourse(req.params.id, parsed);
    res.json({ data: course });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/courses/:id", async (req, res, next) => {
  try {
    await service.deleteCourse(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 科目 CRUD
// ============================================================

app.get("/api/subjects", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    res.json({ data: await service.listSubjects(wsId) });
  } catch (e) {
    next(e);
  }
});

app.post("/api/subjects", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      name: z.string(),
      color: z.string().optional(),
      isWeak: z.boolean().optional()
    });
    const parsed = schema.parse(req.body);
    const subject = await service.createSubject(parsed, wsId);
    res.status(201).json({ data: subject });
  } catch (e) {
    next(e);
  }
});

app.put("/api/subjects/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      color: z.string().optional(),
      isWeak: z.boolean().optional()
    });
    const parsed = schema.parse(req.body);
    const subject = await service.updateSubject(req.params.id, parsed);
    res.json({ data: subject });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/subjects/:id", async (req, res, next) => {
  try {
    await service.deleteSubject(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 学习任务 CRUD
// ============================================================

app.get("/api/study-tasks", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    res.json({ data: await service.listStudyTasks(wsId) });
  } catch (e) {
    next(e);
  }
});

app.get("/api/study-tasks/:id", async (req, res, next) => {
  try {
    const task = await service.getStudyTask(req.params.id);
    if (!task) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Study task not found" } });
    res.json({ data: task });
  } catch (e) {
    next(e);
  }
});

app.post("/api/study-tasks", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      subjectId: z.string().optional(),
      subject: z.string(),
      targetCycle: z.string(),
      plannedMinutes: z.number().int().min(1),
      taskDetail: z.string(),
      status: z.enum(["todo", "doing", "done"]).optional(),
      startDate: z.string(),
      dueDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]),
      relatedNote: z.string().optional(),
      reviewCycleDays: z.number().int().optional()
    });
    const parsed = schema.parse(req.body);
    const task = await service.createStudyTask(parsed, wsId);
    res.status(201).json({ data: task });
  } catch (e) {
    next(e);
  }
});

app.put("/api/study-tasks/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      subjectId: z.string().nullable().optional(),
      subject: z.string().optional(),
      targetCycle: z.string().optional(),
      plannedMinutes: z.number().int().min(1).optional(),
      taskDetail: z.string().optional(),
      status: z.enum(["todo", "doing", "done"]).optional(),
      startDate: z.string().optional(),
      dueDate: z.string().nullable().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      relatedNote: z.string().nullable().optional(),
      reviewCycleDays: z.number().int().nullable().optional(),
      pomodoroCount: z.number().int().optional(),
      checkInDates: z.array(z.string()).optional()
    });
    const parsed = schema.parse(req.body);
    const task = await service.updateStudyTask(req.params.id, parsed);
    res.json({ data: task });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/study-tasks/:id", async (req, res, next) => {
  try {
    await service.deleteStudyTask(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 日程 CRUD
// ============================================================

app.get("/api/agenda-items", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    res.json({ data: await service.listAgendaItems(wsId) });
  } catch (e) {
    next(e);
  }
});

app.get("/api/agenda-items/:id", async (req, res, next) => {
  try {
    const item = await service.getAgendaItem(req.params.id);
    if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agenda item not found" } });
    res.json({ data: item });
  } catch (e) {
    next(e);
  }
});

app.post("/api/agenda-items", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      title: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      location: z.string().optional(),
      category: z.enum(["work", "study", "health", "social", "other"]).optional(),
      tags: z.array(z.string()).optional(),
      recurrenceRule: z.string().optional(),
      reminderAt: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]),
      note: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const item = await service.createAgendaItem(parsed, wsId);
    res.status(201).json({ data: item });
  } catch (e) {
    next(e);
  }
});

app.put("/api/agenda-items/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      location: z.string().nullable().optional(),
      category: z.enum(["work", "study", "health", "social", "other"]).optional(),
      tags: z.array(z.string()).optional(),
      recurrenceRule: z.string().nullable().optional(),
      reminderAt: z.string().nullable().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      note: z.string().nullable().optional(),
      status: z.enum(["todo", "done"]).optional()
    });
    const parsed = schema.parse(req.body);
    const item = await service.updateAgendaItem(req.params.id, parsed);
    res.json({ data: item });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/agenda-items/:id", async (req, res, next) => {
  try {
    await service.deleteAgendaItem(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

app.post("/api/agenda-items/:id/archive", async (req, res, next) => {
  try {
    await service.archiveAgendaItem(req.params.id);
    res.json({ data: { archived: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 日历渲染
// ============================================================

app.get("/api/calendar/events", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      modules: z.string().default("schedule-course,study-plan,daily-agenda"),
      from: z.string(),
      to: z.string()
    });
    const parsed = schema.parse(req.query);
    const modules = parsed.modules.split(",") as ("schedule-course" | "study-plan" | "daily-agenda")[];
    const data = await service.renderCalendar(modules, parsed.from, parsed.to, wsId);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 数据分析
// ============================================================

app.get("/api/analytics/course", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const data = await service.computeCourseAnalytics(wsId);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.get("/api/analytics/study", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const q = z.object({ from: z.string(), to: z.string() }).parse(req.query);
    const data = await service.computeStudyAnalytics(wsId, q.from, q.to);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.get("/api/analytics/agenda", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const q = z.object({ from: z.string(), to: z.string() }).parse(req.query);
    const data = await service.computeAgendaAnalytics(wsId, q.from, q.to);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 备份 / 还原 / 归档
// ============================================================

app.post("/api/backup/export", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const body = z.object({
      scope: z.enum(["schedule-course", "study-plan", "daily-agenda", "all"]),
      encrypted: z.boolean()
    }).parse(req.body);
    const data = await service.exportBackup(wsId, body.scope, body.encrypted);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.post("/api/backup/import", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const body = z.object({ payload: z.string() }).parse(req.body);
    await service.importBackup(wsId, body.payload);
    res.json({ data: { imported: true } });
  } catch (e) {
    next(e);
  }
});

app.post("/api/backup/archive", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const body = z.object({ scope: z.enum(["schedule-course", "study-plan", "daily-agenda", "all"]) }).parse(req.body);
    const data = await service.archiveBackup(wsId, body.scope);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// PDF 导出
// ============================================================

app.post("/api/export/pdf", async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const schema = z.object({
      module: z.enum(["schedule-course", "study-plan", "daily-agenda"]),
      range: z.enum(["single", "week", "month", "year", "report"]),
      template: z.enum(["simple", "formal", "student"]),
      includeCharts: z.boolean().default(false),
      year: z.number().int().min(1970).max(9999).optional(),
      month: z.number().int().min(1).max(12).optional()
    });
    const parsed = schema.parse(req.body);

    // 收集数据
    let data: unknown;
    switch (parsed.module) {
      case "schedule-course":
        data = await service.listCourses(wsId);
        break;
      case "study-plan":
        data = await service.listStudyTasks(wsId);
        break;
      case "daily-agenda":
        data = await service.listAgendaItems(wsId);
        break;
    }

    const pdfBytes = await service.pdf.export(
      parsed.module,
      parsed.range,
      parsed.template,
      parsed.includeCharts,
      data,
      {
        year: parsed.year,
        month: parsed.month,
      }
    );

    const pdfBuffer = Buffer.from(pdfBytes);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${parsed.module}-${parsed.range}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 通知
// ============================================================


app.post("/api/notify/schedule", async (req, res, next) => {
  try {
    const body = z.object({ eventId: z.string(), remindAt: z.string() }).parse(req.body);
    await service.notify.schedule(body.eventId, body.remindAt, "in-app");
    res.json({ data: { scheduled: true } });
  } catch (e) {
    next(e);
  }
});

app.post("/api/notify/cancel", async (req, res, next) => {
  try {
    const body = z.object({ eventId: z.string() }).parse(req.body);
    await service.notify.cancel(body.eventId, "in-app");
    res.json({ data: { canceled: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 错误处理
// ============================================================

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.message } });
  }
  const err = error as Error;
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
});

// ============================================================
// 启动
// ============================================================

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});

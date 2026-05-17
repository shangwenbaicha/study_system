
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { DbStudySystemService } from "./db-service.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));

const service = new DbStudySystemService();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

// ============================================================
// JWT 中间件
// ============================================================

interface JwtPayload {
  userId: string;
  workspaceId?: string;
}

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  // 公开路径跳过认证（注意：/api/auth/me 需要认证）
  const publicPaths = [
    "/api/auth/register", "/api/auth/login",
    "/api/health", "/api/i18n/",
    "/api/wordbooks/built-in", "/api/posts"
  ];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).userId = decoded.userId;
    (req as any).workspaceId = decoded.workspaceId || "default";
    next();
  } catch {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Invalid or expired token" } });
  }
}

app.use(authenticateToken);

// 开发阶段兼容旧版 x-workspace-id header
function getWorkspaceId(req: express.Request): string {
  const wsId = req.headers["x-workspace-id"] as string;
  if (wsId) return wsId;
  return (req as any).workspaceId || "default";
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
// 用户 & 认证（升级版 JWT）
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

    // bcrypt 哈希
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await service.createUser(email, passwordHash, displayName);

    // 自动创建默认工作区
    const workspace = await service.createWorkspace(`${displayName}'s Workspace`, user.id);

    // JWT token
    const token = jwt.sign(
      { userId: user.id, workspaceId: workspace.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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

    // bcrypt 验证
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }

    const workspaces = await service.getUserWorkspaces(user.id);
    const token = jwt.sign(
      { userId: user.id, workspaceId: workspaces[0]?.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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

// 获取当前用户信息
app.get("/api/auth/me", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const user = await service.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    res.json({ data: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 管理员 API（用户管理）
// ============================================================

// 管理员中间件
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = (req as any).userId;
  service.findUserById(userId).then(user => {
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    }
    next();
  }).catch(next);
}

// 获取所有用户列表（管理员）
app.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    const users = await service.listAllUsers();
    res.json({ data: users.map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
      wordBookCount: u.wordBooks?.length || 0,
      postCount: u.posts?.length || 0,
    })) });
  } catch (e) {
    next(e);
  }
});

// 更新用户角色（封号/解封/设为管理员）
app.put("/api/admin/users/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({ role: z.enum(["user", "admin", "banned"]) });
    const { role } = schema.parse(req.body);
    const user = await service.updateUserRole(req.params.id, role);
    res.json({ data: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
  } catch (e) {
    next(e);
  }
});

// 删除用户（封号替代方案）
app.delete("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    await service.deleteUser(req.params.id);
    res.json({ data: { deleted: true } });
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
      { year: parsed.year, month: parsed.month }
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
// ================ 新增模块 API =============================
// ============================================================

// ============================================================
// 背单词模块 API
// ============================================================

// 获取内置词库列表
app.get("/api/wordbooks/built-in", async (_req, res, next) => {
  try {
    const wordbooks = await service.listBuiltInWordBooks();
    res.json({ data: wordbooks });
  } catch (e) {
    next(e);
  }
});

// 安装内置词库到用户
app.post("/api/wordbooks/:id/install", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const wordbook = await service.installBuiltInWordBook(req.params.id, userId);
    res.status(201).json({ data: wordbook });
  } catch (e) {
    next(e);
  }
});

// 词书 CRUD
app.get("/api/wordbooks", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const wordbooks = await service.listWordBooks(userId);
    res.json({ data: wordbooks });
  } catch (e) {
    next(e);
  }
});

app.post("/api/wordbooks", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({
      name: z.string(),
      language: z.enum(["japanese", "english", "other"])
    });
    const parsed = schema.parse(req.body);
    const wordbook = await service.createWordBook(parsed, userId);
    res.status(201).json({ data: wordbook });
  } catch (e) {
    next(e);
  }
});

app.get("/api/wordbooks/:id", async (req, res, next) => {
  try {
    const wordbook = await service.getWordBook(req.params.id);
    if (!wordbook) return res.status(404).json({ error: { code: "NOT_FOUND", message: "WordBook not found" } });
    res.json({ data: wordbook });
  } catch (e) {
    next(e);
  }
});

app.put("/api/wordbooks/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      language: z.enum(["japanese", "english", "other"]).optional()
    });
    const parsed = schema.parse(req.body);
    const wordbook = await service.updateWordBook(req.params.id, parsed);
    res.json({ data: wordbook });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/wordbooks/:id", async (req, res, next) => {
  try {
    await service.deleteWordBook(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 词书内单词管理
app.get("/api/wordbooks/:id/words", async (req, res, next) => {
  try {
    const words = await service.listWords(req.params.id);
    res.json({ data: words });
  } catch (e) {
    next(e);
  }
});

app.post("/api/wordbooks/:id/words", async (req, res, next) => {
  try {
    const schema = z.object({
      word: z.string(),
      reading: z.string().optional(),
      meaning: z.string(),
      partOfSpeech: z.string().optional(),
      exampleSentence: z.string().optional(),
      exampleTranslation: z.string().optional(),
      audioUrl: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const word = await service.createWord(req.params.id, parsed);
    res.status(201).json({ data: word });
  } catch (e) {
    next(e);
  }
});

app.put("/api/words/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      word: z.string().optional(),
      reading: z.string().nullable().optional(),
      meaning: z.string().optional(),
      partOfSpeech: z.string().nullable().optional(),
      exampleSentence: z.string().nullable().optional(),
      exampleTranslation: z.string().nullable().optional(),
      audioUrl: z.string().nullable().optional()
    });
    const parsed = schema.parse(req.body);
    const word = await service.updateWord(req.params.id, parsed);
    res.json({ data: word });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/words/:id", async (req, res, next) => {
  try {
    await service.deleteWord(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 批量导入单词
app.post("/api/wordbooks/:id/words/import", async (req, res, next) => {
  try {
    const schema = z.object({
      words: z.array(z.object({
        word: z.string(),
        reading: z.string().optional(),
        meaning: z.string(),
        partOfSpeech: z.string().optional(),
        exampleSentence: z.string().optional(),
        exampleTranslation: z.string().optional()
      }))
    });
    const parsed = schema.parse(req.body);
    const result = await service.importWords(req.params.id, parsed.words);
    res.status(201).json({ data: result });
  } catch (e) {
    next(e);
  }
});

// 学习复习
app.get("/api/study/review-today", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const words = await service.getTodayReviewWords(userId);
    res.json({ data: words });
  } catch (e) {
    next(e);
  }
});

app.post("/api/study/review/:wordId", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({
      score: z.number().int().min(0).max(5) // SM-2 评分 0-5
    });
    const { score } = schema.parse(req.body);
    const result = await service.submitReview(userId, req.params.wordId, score);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

app.get("/api/study/stats", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const stats = await service.getStudyStats(userId);
    res.json({ data: stats });
  } catch (e) {
    next(e);
  }
});

app.post("/api/study/checkin", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const checkin = await service.createCheckIn(userId);
    res.json({ data: checkin });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 语法学习 API
// ============================================================

app.get("/api/grammar-points", async (req, res, next) => {
  try {
    const query = z.object({
      level: z.string().optional(),
      language: z.string().optional(),
      category: z.string().optional()
    }).parse(req.query);
    const points = await service.listGrammarPoints(query);
    res.json({ data: points });
  } catch (e) {
    next(e);
  }
});

app.post("/api/grammar-points", async (req, res, next) => {
  try {
    const schema = z.object({
      language: z.string(),
      title: z.string(),
      level: z.string(),
      explanation: z.string(),
      category: z.string()
    });
    const parsed = schema.parse(req.body);
    const point = await service.createGrammarPoint(parsed);
    res.status(201).json({ data: point });
  } catch (e) {
    next(e);
  }
});

app.get("/api/grammar-points/:id", async (req, res, next) => {
  try {
    const point = await service.getGrammarPoint(req.params.id);
    if (!point) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Grammar point not found" } });
    res.json({ data: point });
  } catch (e) {
    next(e);
  }
});

app.put("/api/grammar-points/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional(),
      level: z.string().optional(),
      explanation: z.string().optional(),
      category: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const point = await service.updateGrammarPoint(req.params.id, parsed);
    res.json({ data: point });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/grammar-points/:id", async (req, res, next) => {
  try {
    await service.deleteGrammarPoint(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 语法例句
app.get("/api/grammar-points/:id/examples", async (req, res, next) => {
  try {
    const examples = await service.listGrammarExamples(req.params.id);
    res.json({ data: examples });
  } catch (e) {
    next(e);
  }
});

app.post("/api/grammar-points/:id/examples", async (req, res, next) => {
  try {
    const schema = z.object({
      sentence: z.string(),
      reading: z.string().optional(),
      translation: z.string(),
      audioUrl: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const example = await service.createGrammarExample(req.params.id, parsed);
    res.status(201).json({ data: example });
  } catch (e) {
    next(e);
  }
});

// 语法自测
app.get("/api/grammar-points/:id/quiz", async (req, res, next) => {
  try {
    const quizzes = await service.listGrammarQuizzes(req.params.id);
    res.json({ data: quizzes });
  } catch (e) {
    next(e);
  }
});

app.post("/api/grammar-quiz/:id/submit", async (req, res, next) => {
  try {
    const schema = z.object({ answer: z.string() });
    const { answer } = schema.parse(req.body);
    const result = await service.submitGrammarQuiz(req.params.id, answer);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 模拟真题 API
// ============================================================

app.get("/api/exams", async (req, res, next) => {
  try {
    const query = z.object({
      level: z.string().optional(),
      language: z.string().optional()
    }).parse(req.query);
    const exams = await service.listExams(query);
    res.json({ data: exams });
  } catch (e) {
    next(e);
  }
});

app.post("/api/exams", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string(),
      language: z.string(),
      level: z.string(),
      timeLimit: z.number().int().min(1)
    });
    const parsed = schema.parse(req.body);
    const exam = await service.createExam(parsed);
    res.status(201).json({ data: exam });
  } catch (e) {
    next(e);
  }
});

app.get("/api/exams/:id", async (req, res, next) => {
  try {
    const exam = await service.getExam(req.params.id);
    if (!exam) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Exam not found" } });
    res.json({ data: exam });
  } catch (e) {
    next(e);
  }
});

app.put("/api/exams/:id", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional(),
      level: z.string().optional(),
      timeLimit: z.number().int().min(1).optional()
    });
    const parsed = schema.parse(req.body);
    const exam = await service.updateExam(req.params.id, parsed);
    res.json({ data: exam });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/exams/:id", async (req, res, next) => {
  try {
    await service.deleteExam(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 创建题目
app.post("/api/exams/:id/questions", async (req, res, next) => {
  try {
    const schema = z.object({
      section: z.string(),
      questionNum: z.number().int(),
      question: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.string(),
      explanation: z.string().optional(),
      points: z.number().int().optional()
    });
    const parsed = schema.parse(req.body);
    const question = await service.createExamQuestion(req.params.id, parsed);
    res.status(201).json({ data: question });
  } catch (e) {
    next(e);
  }
});

// 开始考试
app.post("/api/exams/:id/start", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const attempt = await service.startExamAttempt(req.params.id, userId);
    res.status(201).json({ data: attempt });
  } catch (e) {
    next(e);
  }
});

// 提交考试
app.post("/api/exam-attempts/:id/submit", async (req, res, next) => {
  try {
    const schema = z.object({
      answers: z.array(z.object({
        questionId: z.string(),
        selectedAnswer: z.string()
      }))
    });
    const { answers } = schema.parse(req.body);
    const result = await service.submitExamAttempt(req.params.id, answers);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// 考试记录
app.get("/api/exam-attempts", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const attempts = await service.listExamAttempts(userId);
    res.json({ data: attempts });
  } catch (e) {
    next(e);
  }
});

// 错题本
app.get("/api/mistakes", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const mistakes = await service.listMistakes(userId);
    res.json({ data: mistakes });
  } catch (e) {
    next(e);
  }
});

app.post("/api/mistakes/:id/review", async (req, res, next) => {
  try {
    await service.reviewMistake(req.params.id);
    res.json({ data: { reviewed: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 视频学习 API
// ============================================================

app.get("/api/videos", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const videos = await service.listVideos(userId);
    res.json({ data: videos });
  } catch (e) {
    next(e);
  }
});

app.post("/api/videos", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({
      title: z.string(),
      url: z.string(),
      sourceType: z.enum(["youtube", "upload", "embedded"]),
      language: z.string(),
      duration: z.number().optional(),
      thumbnail: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const video = await service.createVideo({ ...parsed, userId });
    res.status(201).json({ data: video });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/videos/:id", async (req, res, next) => {
  try {
    await service.deleteVideo(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 视频笔记
app.get("/api/videos/:id/notes", async (req, res, next) => {
  try {
    const notes = await service.listVideoNotes(req.params.id);
    res.json({ data: notes });
  } catch (e) {
    next(e);
  }
});

app.post("/api/videos/:id/notes", async (req, res, next) => {
  try {
    const schema = z.object({
      timestamp: z.number(),
      content: z.string()
    });
    const parsed = schema.parse(req.body);
    const note = await service.addVideoNote(req.params.id, parsed);
    res.status(201).json({ data: note });
  } catch (e) {
    next(e);
  }
});

// 视频进度
app.post("/api/videos/:id/progress", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({
      progress: z.number().min(0).max(1),
      position: z.number()
    });
    const { progress, position } = schema.parse(req.body);
    const result = await service.updateVideoProgress(req.params.id, userId, progress, position);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 社群 API
// ============================================================

app.get("/api/posts", async (req, res, next) => {
  try {
    const query = z.object({
      language: z.string().optional(),
      tag: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional()
    }).parse(req.query);
    const result = await service.listPosts({
      language: query.language,
      tag: query.tag,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined
    });
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

app.post("/api/posts", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
      language: z.enum(["zh", "ja", "en"]).optional()
    });
    const parsed = schema.parse(req.body);
    const post = await service.createPost({ ...parsed, userId });
    res.status(201).json({ data: post });
  } catch (e) {
    next(e);
  }
});

app.get("/api/posts/:id", async (req, res, next) => {
  try {
    const post = await service.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Post not found" } });
    res.json({ data: post });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/posts/:id", async (req, res, next) => {
  try {
    await service.deletePost(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

// 评论
app.post("/api/posts/:id/comments", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const schema = z.object({ content: z.string() });
    const { content } = schema.parse(req.body);
    const comment = await service.createComment(req.params.id, userId, content);
    res.status(201).json({ data: comment });
  } catch (e) {
    next(e);
  }
});

// 点赞/取消点赞
app.post("/api/posts/:id/like", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const result = await service.togglePostLike(req.params.id, userId);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 翻译 API
// ============================================================

app.post("/api/translate", async (req, res, next) => {
  try {
    const schema = z.object({
      text: z.string(),
      sourceLang: z.string(),
      targetLang: z.string()
    });
    const { text, sourceLang, targetLang } = schema.parse(req.body);
    const result = await service.translate(text, sourceLang, targetLang);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 文件上传 API
// ============================================================

import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// 确保上传目录存在
const uploadDirs = ["videos", "audio", "pdfs", "images", "avatars"];
for (const dir of uploadDirs) {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = (req.query.type as string) || "images";
    const dir = path.join(UPLOAD_DIR, type);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${crypto.randomUUID()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10) // 默认 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "video/mp4", "video/webm",
      "audio/mpeg", "audio/wav", "audio/ogg",
      "application/pdf"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

app.post("/api/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: "NO_FILE", message: "No file uploaded" } });
    }
    const fileUrl = `/uploads/${req.query.type || "images"}/${req.file.filename}`;
    res.status(201).json({
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 邮件服务 API
// ============================================================

import nodemailer from "nodemailer";

function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // SMTP 未配置时静默降级
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// 发送验证邮件
app.post("/api/auth/send-verification", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const user = await service.findUserById(userId);
    if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });

    const transporter = getMailTransporter();
    if (!transporter) {
      // SMTP 未配置，模拟发送（开发环境）
      console.log(`[Mail] Verification email would be sent to ${user.email}`);
      return res.json({ data: { sent: true, mode: "simulated" } });
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    // 实际项目中应存储验证码到数据库
    await transporter.sendMail({
      from: process.env.MAIL_FROM || "noreply@xxxlangstudy.com",
      to: user.email,
      subject: "Verify your email - 邮箱验证",
      text: `Your verification code is: ${code}`
    });

    res.json({ data: { sent: true, mode: "email" } });
  } catch (e) {
    next(e);
  }
});

// 发送重置密码邮件
app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);

    const user = await service.findUserByEmail(email);
    if (!user) {
      // 不暴露用户是否存在
      return res.json({ data: { sent: true } });
    }

    const transporter = getMailTransporter();
    if (!transporter) {
      console.log(`[Mail] Password reset email would be sent to ${email}`);
      return res.json({ data: { sent: true, mode: "simulated" } });
    }

    const resetToken = jwt.sign({ userId: user.id, purpose: "reset" }, JWT_SECRET, { expiresIn: "1h" });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || "noreply@xxxlangstudy.com",
      to: email,
      subject: "Reset your password - 密码重置",
      text: `Reset token: ${resetToken}`
    });

    res.json({ data: { sent: true, mode: "email" } });
  } catch (e) {
    next(e);
  }
});

// 重置密码
app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(6)
    });
    const { token, newPassword } = schema.parse(req.body);

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
    if (decoded.purpose !== "reset") {
      return res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Invalid reset token" } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // 更新密码（需要 db-service 新增 updatePassword 方法）
    // 这里直接使用 prisma
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { passwordHash }
    });

    res.json({ data: { reset: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 错误处理中间件
// ============================================================


app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Error]", err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.issues
      }
    });
  }


  if (err.code === "P2002") {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Resource already exists"
      }
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found"
      }
    });
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message
    }
  });
});

// ============================================================
// 启动服务器
// ============================================================

const PORT = parseInt(process.env.PORT || "3001", 10);

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] Health check: http://localhost:${PORT}/api/health`);
});

export default app;

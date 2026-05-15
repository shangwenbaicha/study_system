export const moduleRoutes = [
  { path: "/course", module: "schedule-course", pages: ["week", "course-edit", "semester", "analysis", "export"] },
  { path: "/study", module: "study-plan", pages: ["overview", "daily-task", "subject", "charts", "report", "template"] },
  { path: "/agenda", module: "daily-agenda", pages: ["calendar", "agenda-edit", "todo-merge", "analysis", "archive"] }
] as const;

export const globalRoutes = [
  "/global/pdf",
  "/global/charts",
  "/global/calendar",
  "/global/analytics",
  "/global/backup",
  "/global/theme",
  "/global/templates",
  "/global/reminders"
] as const;

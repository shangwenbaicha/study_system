// ============================================================
// 基础类型
// ============================================================

export type ModuleName = "schedule-course" | "study-plan" | "daily-agenda";
export type Priority = "low" | "medium" | "high";
export type Role = "owner" | "editor" | "viewer";
export type TaskStatus = "todo" | "doing" | "done";
export type AgendaStatus = "todo" | "done";
export type AgendaCategory = "work" | "study" | "health" | "social" | "other";
export type Timezone = "Asia/Shanghai" | "Asia/Tokyo";

// ============================================================
// 日历事件（统一渲染用）
// ============================================================

export interface CalendarEvent {
  sourceModule: ModuleName;
  title: string;
  startAt: string;
  endAt: string;
  tag?: string;
  priority?: Priority;
  reminderAt?: string;
  metaRefId: string;
  color?: string;
}

// ============================================================
// 模块 1：课程表（教师日历版）
// ============================================================

export interface CourseItem {
  id: string;
  workspaceId: string;
  courseName: string;
  teacher: string;
  startAt: string;
  endAt: string;
  timezone: Timezone;
  color: string;
  note?: string;
}

export interface CourseCreateInput {
  courseName: string;
  teacher: string;
  startAt: string;
  endAt: string;
  timezone: Timezone;
  color: string;
  note?: string;
}

export interface CourseUpdateInput {
  courseName?: string;
  teacher?: string;
  startAt?: string;
  endAt?: string;
  timezone?: Timezone;
  color?: string;
  note?: string | null;
}

// ============================================================
// 学期配置
// ============================================================

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  workspaceId: string;
}

// ============================================================
// 模块 2：学习计划
// ============================================================

export interface Subject {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  isWeak: boolean;
}

export interface StudyTask {
  id: string;
  workspaceId: string;
  subjectId?: string;
  subject: string;
  targetCycle: string;
  plannedMinutes: number;
  taskDetail: string;
  status: TaskStatus;
  startDate: string;
  dueDate?: string;
  priority: Priority;
  relatedNote?: string;
  reviewCycleDays?: number;
  pomodoroCount: number;
  checkInDates: string[];
}

export interface StudyTaskCreateInput {
  subjectId?: string;
  subject: string;
  targetCycle: string;
  plannedMinutes: number;
  taskDetail: string;
  status?: TaskStatus;
  startDate: string;
  dueDate?: string;
  priority: Priority;
  relatedNote?: string;
  reviewCycleDays?: number;
}

export interface StudyTaskUpdateInput {
  subjectId?: string | null;
  subject?: string;
  targetCycle?: string;
  plannedMinutes?: number;
  taskDetail?: string;
  status?: TaskStatus;
  startDate?: string;
  dueDate?: string | null;
  priority?: Priority;
  relatedNote?: string | null;
  reviewCycleDays?: number | null;
  pomodoroCount?: number;
  checkInDates?: string[];
}

// ============================================================
// 模块 3：日程安排
// ============================================================

export interface AgendaItem {
  id: string;
  workspaceId: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  category: AgendaCategory;
  tags: string[];
  recurrenceRule?: string;
  reminderAt?: string;
  priority: Priority;
  note?: string;
  status: AgendaStatus;
  archivedAt?: string;
}

export interface AgendaCreateInput {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  category?: AgendaCategory;
  tags?: string[];
  recurrenceRule?: string;
  reminderAt?: string;
  priority: Priority;
  note?: string;
}

export interface AgendaUpdateInput {
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string | null;
  category?: AgendaCategory;
  tags?: string[];
  recurrenceRule?: string | null;
  reminderAt?: string | null;
  priority?: Priority;
  note?: string | null;
  status?: AgendaStatus;
}

// ============================================================
// 用户 & 工作区
// ============================================================

export interface WorkspaceMember {
  userId: string;
  role: Role;
  resourceScopes: ModuleName[];
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

// ============================================================
// 分析结果类型
// ============================================================

export interface CourseAnalytics {
  totalCourses: number;
  totalHoursPerWeek: number;
  subjectHourBreakdown: Array<{ subject: string; hours: number }>;
  freePeriods: Array<{ weekday: number; periods: number[] }>;
}

export interface StudyAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageDailyMinutes: number;
  streakDays: number;
  weakSubjects: string[];
}

export interface AgendaAnalytics {
  totalItems: number;
  busyDays: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  freeDays: number;
}

// ============================================================
// 备份类型
// ============================================================

export interface BackupPayload {
  version: string;
  exportedAt: string;
  scope: ModuleName | "all";
  encrypted: boolean;
  data: {
    courses?: CourseItem[];
    subjects?: Subject[];
    studyTasks?: StudyTask[];
    agendaItems?: AgendaItem[];
    semesters?: Semester[];
  };
}

// ============================================================
// ================ 新增模块类型 =============================
// ============================================================

// ============================================================
// 模块 4：背单词（艾宾浩斯记忆）
// ============================================================

export interface WordBook {
  id: string;
  userId: string;
  name: string;
  language: "japanese" | "english" | "other";
  wordCount: number;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Word {
  id: string;
  wordBookId: string;
  word: string;
  reading?: string;
  meaning: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  audioUrl?: string;
  createdAt: string;
}

export interface WordReview {
  id: string;
  wordId: string;
  userId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewAt: string;
  status: "learning" | "reviewing" | "mastered";
}

export interface StudyCheckIn {
  id: string;
  userId: string;
  date: string;
  createdAt: string;
}

export interface StudyStats {
  totalWords: number;
  learnedWords: number;
  reviewingWords: number;
  masteredWords: number;
  todayReviewCount: number;
  streakDays: number;
  totalCheckIns: number;
}

// ============================================================
// 模块 5：语法学习
// ============================================================

export interface GrammarPoint {
  id: string;
  language: string;
  title: string;
  level: string;
  explanation: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  examples?: GrammarExample[];
  quizzes?: GrammarQuiz[];
}

export interface GrammarExample {
  id: string;
  grammarPointId: string;
  sentence: string;
  reading?: string;
  translation: string;
  audioUrl?: string;
}

export interface GrammarQuiz {
  id: string;
  grammarPointId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GrammarQuizResult {
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
}

// ============================================================
// 模块 6：模拟真题
// ============================================================

export interface Exam {
  id: string;
  title: string;
  language: string;
  level: string;
  timeLimit: number;
  createdAt: string;
  updatedAt: string;
  questions?: ExamQuestion[];
}

export interface ExamQuestion {
  id: string;
  examId: string;
  section: string;
  questionNum: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  points: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  score?: number;
  totalPoints?: number;
  answers: ExamAnswer[];
}

export interface ExamAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export interface MistakeItem {
  id: string;
  userId: string;
  questionId: string;
  examId?: string;
  wrongAnswer: string;
  correctAnswer: string;
  reviewed: boolean;
  reviewedAt?: string;
  createdAt: string;
}

// ============================================================
// 模块 7：视频学习
// ============================================================

export interface VideoResource {
  id: string;
  userId: string;
  title: string;
  url: string;
  sourceType: "youtube" | "upload" | "embedded";
  language: string;
  duration?: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  notes?: VideoNote[];
}

export interface VideoNote {
  id: string;
  videoId: string;
  timestamp: number;
  content: string;
  createdAt: string;
}

export interface VideoProgress {
  id: string;
  videoId: string;
  userId: string;
  progress: number;
  lastPosition: number;
  completed: boolean;
  updatedAt: string;
}

// ============================================================
// 模块 8：社群
// ============================================================

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  language: "zh" | "ja" | "en";
  likes: number;
  views: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string };
  comments?: Comment[];
  liked?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { id: string; displayName: string };
}

export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

// ============================================================
// 翻译
// ============================================================

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

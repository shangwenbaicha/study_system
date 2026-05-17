// ============================================================
// 新增模块 API Client（背单词、语法、真题、视频、社群、翻译）
// ============================================================

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...options?.headers as Record<string, string> },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// ============================================================
// 认证 API
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  workspaceId?: string;
  workspaces?: Array<{ id: string; name: string }>;
}

export const authApi = {
  register: (data: { email: string; password: string; displayName: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request<AuthUser>("/api/auth/me"),
};

// ============================================================
// 背单词 API
// ============================================================

export interface WordBookDTO {
  id: string;
  userId: string;
  name: string;
  language: "japanese" | "english" | "other";
  wordCount: number;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WordDTO {
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

export interface WordReviewDTO {
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

export interface StudyStatsDTO {
  totalWords: number;
  learnedWords: number;
  reviewingWords: number;
  masteredWords: number;
  todayReviewCount: number;
  streakDays: number;
  totalCheckIns: number;
}

export interface StudyCheckInDTO {
  id: string;
  userId: string;
  date: string;
  createdAt: string;
}

export const wordbookApi = {
  // 内置词库
  listBuiltIn: () => request<WordBookDTO[]>("/api/wordbooks/built-in"),
  installBuiltIn: (id: string) => request<WordBookDTO>(`/api/wordbooks/${id}/install`, { method: "POST" }),
  // 用户词书
  list: () => request<WordBookDTO[]>("/api/wordbooks"),
  get: (id: string) => request<WordBookDTO>(`/api/wordbooks/${id}`),
  create: (data: { name: string; language: string }) =>
    request<WordBookDTO>("/api/wordbooks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; language?: string }) =>
    request<WordBookDTO>(`/api/wordbooks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/wordbooks/${id}`, { method: "DELETE" }),
  // 单词
  listWords: (wordBookId: string) => request<WordDTO[]>(`/api/wordbooks/${wordBookId}/words`),
  createWord: (wordBookId: string, data: { word: string; reading?: string; meaning: string; partOfSpeech?: string; exampleSentence?: string; exampleTranslation?: string }) =>
    request<WordDTO>(`/api/wordbooks/${wordBookId}/words`, { method: "POST", body: JSON.stringify(data) }),
  updateWord: (id: string, data: Partial<WordDTO>) =>
    request<WordDTO>(`/api/words/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteWord: (id: string) =>
    request<{ deleted: boolean }>(`/api/words/${id}`, { method: "DELETE" }),
  importWords: (wordBookId: string, words: Array<{ word: string; reading?: string; meaning: string }>) =>
    request<{ imported: number }>(`/api/wordbooks/${wordBookId}/words/import`, { method: "POST", body: JSON.stringify({ words }) }),
  // 复习
  getTodayReview: () => request<WordDTO[]>("/api/study/review-today"),
  submitReview: (wordId: string, score: number) =>
    request<WordReviewDTO>(`/api/study/review/${wordId}`, { method: "POST", body: JSON.stringify({ score }) }),
  getStats: () => request<StudyStatsDTO>("/api/study/stats"),
  checkIn: () => request<StudyCheckInDTO>("/api/study/checkin", { method: "POST" }),
};

// ============================================================
// 语法学习 API
// ============================================================

export interface GrammarPointDTO {
  id: string;
  language: string;
  title: string;
  level: string;
  explanation: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  examples?: GrammarExampleDTO[];
  quizzes?: GrammarQuizDTO[];
}

export interface GrammarExampleDTO {
  id: string;
  grammarPointId: string;
  sentence: string;
  reading?: string;
  translation: string;
  audioUrl?: string;
}

export interface GrammarQuizDTO {
  id: string;
  grammarPointId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GrammarQuizResultDTO {
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
}

export const grammarApi = {
  list: (query?: { level?: string; language?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (query?.level) params.set("level", query.level);
    if (query?.language) params.set("language", query.language);
    if (query?.category) params.set("category", query.category);
    const qs = params.toString();
    return request<GrammarPointDTO[]>(`/api/grammar-points${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<GrammarPointDTO>(`/api/grammar-points/${id}`),
  create: (data: { language: string; title: string; level: string; explanation: string; category: string }) =>
    request<GrammarPointDTO>("/api/grammar-points", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; level?: string; explanation?: string; category?: string }) =>
    request<GrammarPointDTO>(`/api/grammar-points/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ deleted: boolean }>(`/api/grammar-points/${id}`, { method: "DELETE" }),
  listExamples: (id: string) => request<GrammarExampleDTO[]>(`/api/grammar-points/${id}/examples`),
  createExample: (id: string, data: { sentence: string; reading?: string; translation: string }) =>
    request<GrammarExampleDTO>(`/api/grammar-points/${id}/examples`, { method: "POST", body: JSON.stringify(data) }),
  listQuizzes: (id: string) => request<GrammarQuizDTO[]>(`/api/grammar-points/${id}/quiz`),
  submitQuiz: (quizId: string, answer: string) =>
    request<GrammarQuizResultDTO>(`/api/grammar-quiz/${quizId}/submit`, { method: "POST", body: JSON.stringify({ answer }) }),
};

// ============================================================
// 模拟真题 API
// ============================================================

export interface ExamDTO {
  id: string;
  title: string;
  language: string;
  level: string;
  timeLimit: number;
  createdAt: string;
  updatedAt: string;
  questions?: ExamQuestionDTO[];
}

export interface ExamQuestionDTO {
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

export interface ExamAttemptDTO {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  score?: number;
  totalPoints?: number;
  answers: Array<{ questionId: string; selectedAnswer: string; isCorrect: boolean }>;
}

export interface MistakeItemDTO {
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

export const examApi = {
  list: (query?: { level?: string; language?: string }) => {
    const params = new URLSearchParams();
    if (query?.level) params.set("level", query.level);
    if (query?.language) params.set("language", query.language);
    const qs = params.toString();
    return request<ExamDTO[]>(`/api/exams${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<ExamDTO>(`/api/exams/${id}`),
  create: (data: { title: string; language: string; level: string; timeLimit: number }) =>
    request<ExamDTO>("/api/exams", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; level?: string; timeLimit?: number }) =>
    request<ExamDTO>(`/api/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ deleted: boolean }>(`/api/exams/${id}`, { method: "DELETE" }),
  createQuestion: (examId: string, data: { section: string; questionNum: number; question: string; options: string[]; correctAnswer: string; explanation?: string; points?: number }) =>
    request<ExamQuestionDTO>(`/api/exams/${examId}/questions`, { method: "POST", body: JSON.stringify(data) }),
  start: (examId: string) => request<ExamAttemptDTO>(`/api/exams/${examId}/start`, { method: "POST" }),
  submit: (attemptId: string, answers: Array<{ questionId: string; selectedAnswer: string }>) =>
    request<ExamAttemptDTO>(`/api/exam-attempts/${attemptId}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  listAttempts: () => request<ExamAttemptDTO[]>("/api/exam-attempts"),
  listMistakes: () => request<MistakeItemDTO[]>("/api/mistakes"),
  reviewMistake: (id: string) => request<{ reviewed: boolean }>(`/api/mistakes/${id}/review`, { method: "POST" }),
};

// ============================================================
// 视频学习 API
// ============================================================

export interface VideoDTO {
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
}

export interface VideoNoteDTO {
  id: string;
  videoId: string;
  timestamp: number;
  content: string;
  createdAt: string;
}

export interface VideoProgressDTO {
  id: string;
  videoId: string;
  userId: string;
  progress: number;
  lastPosition: number;
  completed: boolean;
  updatedAt: string;
}

export const videoApi = {
  list: () => request<VideoDTO[]>("/api/videos"),
  create: (data: { title: string; url: string; sourceType: string; language: string; duration?: number; thumbnail?: string }) =>
    request<VideoDTO>("/api/videos", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ deleted: boolean }>(`/api/videos/${id}`, { method: "DELETE" }),
  listNotes: (videoId: string) => request<VideoNoteDTO[]>(`/api/videos/${videoId}/notes`),
  addNote: (videoId: string, data: { timestamp: number; content: string }) =>
    request<VideoNoteDTO>(`/api/videos/${videoId}/notes`, { method: "POST", body: JSON.stringify(data) }),
  updateProgress: (videoId: string, data: { progress: number; position: number }) =>
    request<VideoProgressDTO>(`/api/videos/${videoId}/progress`, { method: "POST", body: JSON.stringify(data) }),
};

// ============================================================
// 社群 API
// ============================================================

export interface PostDTO {
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
  comments?: CommentDTO[];
  commentCount?: number;
}

export interface CommentDTO {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { id: string; displayName: string };
}

export const communityApi = {
  listPosts: (query?: { language?: string; tag?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.language) params.set("language", query.language);
    if (query?.tag) params.set("tag", query.tag);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ posts: PostDTO[]; total: number }>(`/api/posts${qs ? `?${qs}` : ""}`);
  },
  getPost: (id: string) => request<PostDTO>(`/api/posts/${id}`),
  createPost: (data: { title: string; content: string; tags?: string[]; language?: string }) =>
    request<PostDTO>("/api/posts", { method: "POST", body: JSON.stringify(data) }),
  deletePost: (id: string) => request<{ deleted: boolean }>(`/api/posts/${id}`, { method: "DELETE" }),
  createComment: (postId: string, content: string) =>
    request<CommentDTO>(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  toggleLike: (postId: string) =>
    request<{ liked: boolean; likes: number }>(`/api/posts/${postId}/like`, { method: "POST" }),
};

// ============================================================
// 翻译 API
// ============================================================

export interface TranslationDTO {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export const translateApi = {
  translate: (text: string, sourceLang: string, targetLang: string) =>
    request<TranslationDTO>("/api/translate", {
      method: "POST",
      body: JSON.stringify({ text, sourceLang, targetLang }),
    }),
};

# 🎯 日语学习独立站 — 完整架构规划方案

> **结论：非常可行！** 项目已全部实现，可直接部署上线。

---

## 一、项目定位

日语学习独立站，面向中/日/英三语用户，提供：

| 模块 | 说明 | 状态 |
|------|------|------|
| ✅ 背单词 | 艾宾浩斯(SM-2) + 打卡 + 多语词库 | ✅ 已完整实现 |
| ✅ 语法学习 | 知识点 + 例句 + 自测 | ✅ 已完整实现 |
| ✅ 模拟真题 | 在线答题 + 自动批改 + 错题本 | ✅ 已完整实现 |
| ✅ 视频学习 | YouTube嵌入/上传 + 时间戳笔记 | ✅ 已完整实现 |
| ✅ 翻译工具 | LibreTranslate（预留DeepSeek切换） | ✅ 已完整实现 |
| ✅ 社群分享 | 帖子/评论/点赞 | ✅ 已完整实现 |
| ✅ 课程表/学习计划/日程 | 已有功能，微调即可 | ✅ 已完整实现 |
| ✅ 三语切换 | react-i18next + 子域名 | ✅ 已完整实现 |
| ✅ 邮箱注册 + JWT认证 | bcrypt + jsonwebtoken | ✅ 已完整实现 |
| ✅ 文件上传 | multer 本地存储 | ✅ 已完整实现 |
| ✅ 邮件服务 | nodemailer SMTP | ✅ 已完整实现 |
| ✅ 一键部署 | deploy.sh → ConoHa VPS | ✅ 已完整实现 |

**不涉及氪金服务**，全部功能免费使用。

---

## 二、技术栈总览

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 19 + Vite 7 + React Router 7 | 保持现有 |
| **UI** | Lucide + 自定义CSS | 保持现有 |
| **国际化** | react-i18next | 中/日/英三语JSON已就位 |
| **后端** | Express 5 + Prisma | 保持现有 |
| **数据库** | **PostgreSQL** | 保持现有配置 |
| **认证** | bcrypt + jsonwebtoken | 已完成升级 |
| **翻译** | LibreTranslate（.env预留DeepSeek开关） | 多服务商可切换 |
| **文件上传** | multer → `/uploads/` | ✅ 已实现 |
| **邮件服务** | nodemailer SMTP | ✅ 已实现 |
| **部署** | Ubuntu 22.04 + Nginx + PM2 | ✅ deploy.sh 就绪 |

### 关于翻译功能的说明

| 要点 | 说明 |
|------|------|
| 当前方案 | **LibreTranslate**（免费可自托管，代码中已实现） |
| 未来扩展 | `.env` 中预留 `TRANSLATION_PROVIDER=libretranslate\|deepseek` |
| DeepSeek备用 | 预留 `DEEPSEEK_API_KEY` + `DEEPSEEK_BASE_URL`，改环境变量即可切换 |
| 缓存机制 | TranslationCache 表缓存翻译结果7天，避免重复请求 |

### 关于数据库

**继续使用 PostgreSQL**，理由：
- Prisma schema 已配置 PostgreSQL
- 社群板块需要全文搜索（PostgreSQL 内置 `tsvector` 支持）
- ConoHa 可直接跑 PostgreSQL 容器

### 关于ConoHa部署

| 项目 | 方案 |
|------|------|
| VPS规格 | 2GB RAM / 3核 / 100GB SSD |
| 系统 | Ubuntu 22.04 |
| 进程管理 | PM2（自动重启） |
| 反向代理 | Nginx |
| 证书 | Let's Encrypt SSL |
| 域名 | `xxxlangstudy.com`（.env+ 配置模板用占位符） |

---

## 三、架构原则（严禁违反 ❌）

```
✅ 前后端严格分离
  → 前端只做页面展示/交互，不包含任何业务逻辑
  → 前端不直连数据库
  → 不硬编码数据库信息、域名、IP 在代码中
  → 所有数据通过 /api/ 接口获取

✅ RESTful API 统一前缀 /api/
  → 所有读写操作、背单词进度、真题答题、计划保存全部通过接口完成

✅ 环境变量抽离
  → .env + .env.example，不硬编码

✅ 功能模块化
  → 用户/单词/语法/真题/视频/翻译/社群/计划，模块低耦合

✅ 可直接部署 Ubuntu 22.04 + Nginx
```

---

## 四、路由规划（全站结构）

```
# 三语子域名方案（部署后生效）
xxxlangstudy.com          → 中文版（主域名）
ja.xxxlangstudy.com       → 日本語版
en.xxxlangstudy.com       → English版

# 页面路由（所有语言共用）
/                          → Landing Page（未登录） / Dashboard（已登录）

# 学习区域（需登录）
/vocabulary                → 背单词
/grammar                   → 语法学习
/exams                     → 模拟真题
/videos                    → 视频学习
/translate                 → 翻译工具
/community                 → 社群广场

# 已有模块
/course                    → 课程表
/study                     → 学习计划
/agenda                    → 日程安排
/calendar                  → 日历总览
/analytics                 → 数据分析
/settings                  → 设置

# 认证
/auth                      → 登录/注册
```

**三语切换逻辑：** 通过子域名实现，前端根据 `window.location.hostname` 自动切换 i18n 语言。

---

## 五、数据库模型总览

### 5.1 已有模型（保持不变）
```
User / Course / Semester / Subject / StudyTask / AgendaItem
Workspace / WorkspaceMember
```

### 5.2 新增模型（全部已实现）

```prisma
// === 背单词 ===
model WordBook { ... }      // 词书（内置/用户创建）
model Word { ... }          // 单词
model WordReview { ... }    // SM-2 复习记录
model StudyCheckIn { ... }  // 打卡记录

// === 语法学习 ===
model GrammarPoint { ... }  // 语法点
model GrammarExample { ... }// 例句
model GrammarQuiz { ... }   // 自测题

// === 模拟真题 ===
model Exam { ... }          // 试卷
model ExamQuestion { ... }  // 题目
model ExamAttempt { ... }   // 答题记录
model MistakeItem { ... }   // 错题本

// === 视频学习 ===
model VideoResource { ... } // 视频资源
model VideoNote { ... }     // 时间戳笔记
model VideoProgress { ... } // 观看进度

// === 社群 ===
model Post { ... }          // 帖子
model Comment { ... }       // 评论
model PostLike { ... }      // 点赞

// === 翻译缓存 ===
model TranslationCache { ... } // 翻译结果缓存

// === 审计 ===
model SyncLog { ... }       // 同步日志
model AuditLog { ... }      // 审计日志
```

---

## 六、API 接口完整清单

### 6.1 已有接口（保持不变）
```
认证:     POST /api/auth/register|login|me
课程:     CRUD /api/courses
学期:     CRUD /api/semesters
科目:     CRUD /api/subjects
学习任务:  CRUD /api/study-tasks
日程:     CRUD /api/agenda-items
日历:     GET  /api/calendar/events
分析:     GET  /api/analytics/*
备份:     POST /api/backup/*
导出:     POST /api/export/pdf
通知:     POST /api/notify/schedule|cancel
```

### 6.2 新增接口（全部已实现）

#### 🔤 背单词（11个）
```
GET        /api/wordbooks/built-in              # 内置词库列表
POST       /api/wordbooks/:id/install           # 安装内置词库
GET/POST   /api/wordbooks                       # 词书列表/创建
GET/PUT/DEL /api/wordbooks/:id                  # 词书详情/更新/删除
GET/POST   /api/wordbooks/:id/words             # 单词列表/添加
PUT/DEL    /api/words/:id                       # 单词更新/删除
POST       /api/wordbooks/:id/words/import      # 批量导入
GET        /api/study/review-today              # 今日待复习
POST       /api/study/review/:wordId            # 提交复习（SM-2评分）
GET        /api/study/stats                     # 学习统计
POST       /api/study/checkin                   # 打卡签到
```

#### 📝 语法学习（6个）
```
GET/POST   /api/grammar-points                  # 列表/创建
GET/PUT/DEL /api/grammar-points/:id             # 详情/更新/删除
GET/POST   /api/grammar-points/:id/examples     # 例句列表/添加
GET        /api/grammar-points/:id/quiz         # 获取练习题
POST       /api/grammar-quiz/:id/submit         # 提交答案
```

#### 📄 模拟真题（8个）
```
GET/POST   /api/exams                           # 试卷列表/创建
GET/PUT/DEL /api/exams/:id                      # 试卷详情/更新/删除
POST       /api/exams/:id/questions             # 添加题目
POST       /api/exams/:id/start                 # 开始考试
POST       /api/exam-attempts/:id/submit        # 交卷
GET        /api/exam-attempts                   # 考试记录
GET        /api/mistakes                        # 错题本
POST       /api/mistakes/:id/review             # 标记已复习
```

#### 🎬 视频学习（5个）
```
GET/POST   /api/videos                          # 视频列表/添加
DEL        /api/videos/:id                      # 删除视频
GET/POST   /api/videos/:id/notes                # 笔记列表/添加
POST       /api/videos/:id/progress             # 更新进度
```

#### 🌐 翻译（1个）
```
POST       /api/translate                       # 翻译文本
```

#### 💬 社群（5个）
```
GET/POST   /api/posts                           # 帖子列表/发布
GET/DEL    /api/posts/:id                       # 帖子详情/删除
POST       /api/posts/:id/comments              # 评论
POST       /api/posts/:id/like                  # 点赞/取消
```

#### 📁 文件上传（1个）
```
POST       /api/upload                          # 通用文件上传（图片/视频/音频/PDF）
```

#### 📧 邮件服务（3个）
```
POST       /api/auth/send-verification          # 发送验证邮件
POST       /api/auth/forgot-password            # 发送重置密码邮件
POST       /api/auth/reset-password             # 重置密码
```

---

## 七、实施进度

### Phase 0 — 基础设施 ✅ 已完成
- [x] JWT 认证升级（bcrypt + jsonwebtoken）
- [x] i18n react-i18next 框架集成
- [x] 三语路由架构（子域名方案）
- [x] Prisma Schema 全部模型（420行）
- [x] domain types 全部类型（493行）
- [x] db-service.ts 全部CRUD方法（2020行）
- [x] server.ts 全部API路由（1430行）
- [x] 前端 i18n 三语JSON文件（zh/ja/en）
- [x] API Client 封装（new-client.ts 392行）
- [x] 前端页面：LandingPage / AuthPage / DashboardPage / WordBookPage
- [x] 文件上传（multer）
- [x] 邮件服务（nodemailer）
- [x] 翻译多服务商切换（LibreTranslate / DeepSeek）

### Phase 1 — 背单词 ✅ 已完成
- [x] 词书 CRUD（内置/用户创建）
- [x] 单词 CRUD + 批量导入
- [x] SM-2 艾宾浩斯算法
- [x] 今日复习 + 评分
- [x] 学习统计 + 打卡

### Phase 2 — 语法学习 ✅ 已完成
- [x] 语法点 CRUD（按JLPT级别分类）
- [x] 例句管理
- [x] 自测题 + 自动批改

### Phase 3 — 模拟真题 ✅ 已完成
- [x] 试卷 CRUD
- [x] 题目管理
- [x] 在线答题 + 自动批改
- [x] 错题本

### Phase 4 — 视频 + 翻译 ✅ 已完成
- [x] 视频资源 CRUD
- [x] 时间戳笔记
- [x] 观看进度追踪
- [x] 翻译 API（多服务商切换）

### Phase 5 — 社群 + 部署 ✅ 已完成
- [x] 帖子/评论/点赞
- [x] deploy.sh 一键部署脚本
- [x] Nginx 三语子域名配置
- [x] PM2 进程管理
- [x] SSL 证书自动获取

---

## 八、环境变量配置（.env）

```env
# === 数据库 ===
DATABASE_URL=postgresql://postgres:password@localhost:5432/study_system

# === JWT 认证 ===
JWT_SECRET=your-jwt-secret-here

# === 翻译服务（当前 LibreTranslate，可切换） ===
TRANSLATION_PROVIDER=libretranslate    # libretranslate | deepseek | dummy
# DeepSeek 备用（切换时只需改 PROVIDER + 填 Key）
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

# === 文件上传 ===
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760    # 10MB

# === SMTP 邮件服务 ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=noreply@xxxlangstudy.com

# === 前端 ===
VITE_API_BASE_URL=http://localhost:3000

# === 部署 ===
NODE_ENV=development
CORS_ORIGIN=*
PORT=3000
```

---

## 九、词库来源方案

| 语言 | 方案 |
|------|------|
| 日语 | ① JLPT N5-N1 词汇表开源数据 ② 用户CSV/Excel导入 |
| 英语 | ① 四六级/托福/雅思开源词库 ② 用户导入 |
| 小语种 | 用户自行导入 + 社区贡献 |

---

## 十、翻译功能详细说明

| 要点 | 方案 |
|------|------|
| 主力API | LibreTranslate（免费，代码中已实现） |
| 多服务商 | `TRANSLATION_PROVIDER` 环境变量控制，不改代码 |
| 缓存 | TranslationCache 表缓存7天 |
| 降级 | API失败时返回原文 |
| DeepSeek | `.env` 已预留配置，随时切换 |

---

## 十一、部署方案

### 项目结构
```
study_system/
├── deploy.sh               # Ubuntu一键部署（推荐）
├── .env.example            # 环境变量模板
├── services/api/           # 后端 API 服务
├── apps/web/               # 前端 React 应用
├── prisma/                 # 数据库 Schema
└── packages/               # 共享类型/工具
```

### Ubuntu 一键部署（ConoHa VPS）

```bash
# 1. 推送到 GitHub
git add . && git commit -m "日语学习独立站"
git push origin main

# 2. SSH 到 ConoHa VPS
ssh root@你的服务器IP

# 3. 下载并执行部署脚本
DOMAIN=你的域名 bash -c "$(curl -fsSL https://raw.githubusercontent.com/shangwenbaicha/study_system/main/deploy.sh)"
```

部署脚本自动完成：
- ✅ 系统更新 + 基础工具
- ✅ Node.js 20 + PM2
- ✅ PostgreSQL 16 + 数据库创建
- ✅ 项目克隆 + 依赖安装
- ✅ Prisma 迁移
- ✅ 前端构建
- ✅ Nginx 三语子域名配置
- ✅ SSL 证书（Let's Encrypt）
- ✅ 防火墙配置
- ✅ PM2 进程守护

---

## 十二、域名规划

```
子域名方案（部署后生效）：
  xxxlangstudy.com          → 中文版（主域名）
  ja.xxxlangstudy.com       → 日本語版
  en.xxxlangstudy.com       → English版
```

DNS 配置：
```
A记录:
  @         → 服务器IP
  ja        → 服务器IP
  en        → 服务器IP
  www       → 服务器IP
```

---

## 十三、项目文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 420 | 数据库模型定义 |
| `packages/domain/src/types.ts` | 493 | TypeScript 类型定义 |
| `services/api/src/db-service.ts` | 2020 | 数据库服务（含SM-2算法） |
| `services/api/src/server.ts` | 1430 | API 路由（含文件上传+邮件） |
| `apps/web/src/api/new-client.ts` | 392 | 前端 API 客户端 |
| `apps/web/src/i18n/index.ts` | 30 | i18n 初始化 |
| `apps/web/src/i18n/locales/zh.json` | — | 中文翻译 |
| `apps/web/src/i18n/locales/ja.json` | — | 日语翻译 |
| `apps/web/src/i18n/locales/en.json` | — | 英语翻译 |
| `apps/web/src/App.tsx` | 118 | 路由配置 |
| `apps/web/src/pages/LandingPage.tsx` | — | 首页 |
| `apps/web/src/pages/AuthPage.tsx` | — | 登录/注册 |
| `apps/web/src/pages/DashboardPage.tsx` | — | 仪表盘 |
| `apps/web/src/pages/wordbook/WordBookPage.tsx` | — | 背单词 |
| `deploy.sh` | 260 | 一键部署脚本 |
| `.env.example` | — | 环境变量模板 |

---

## 十四、需要你准备的内容

1. 去 **ConoHa** 购买 VPS（推荐 2GB / 3核 / 100GB SSD）
2. 注册域名 `xxxlangstudy.com`
3. 配置 DNS A 记录指向 VPS IP
4. （可选）注册 DeepSeek API，当前用 LibreTranslate 不需要
5. （可选）配置 SMTP 邮箱密钥，用于发送验证/重置密码邮件

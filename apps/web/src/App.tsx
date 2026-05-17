import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import "./i18n"; // 初始化 i18n

// 公开页面
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";

// 登录后页面
import DashboardPage from "./pages/DashboardPage";
import WordBookPage from "./pages/wordbook/WordBookPage";
import GrammarPage from "./pages/grammar/GrammarPage";
import ExamPage from "./pages/exam/ExamPage";
import VideoPage from "./pages/video/VideoPage";
import TranslatePage from "./pages/translate/TranslatePage";
import CommunityPage from "./pages/community/CommunityPage";
import ProfilePage from "./pages/profile/ProfilePage";
import CoursePage from "./pages/course/CoursePage";
import StudyPage from "./pages/study/StudyPage";
import AgendaPage from "./pages/agenda/AgendaPage";
import CalendarPage from "./pages/global/CalendarPage";
import AnalyticsPage from "./pages/global/AnalyticsPage";
import BackupPage from "./pages/global/BackupPage";
import SettingsPage from "./pages/global/SettingsPage";
import ToastContainer from "./components/Toast";

// 简单的 Auth Guard
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="page-loading">Loading...</div>}>
      <Routes>
        {/* 公开路由 */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* 登录后路由 */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/wordbook"
          element={
            <RequireAuth>
              <WordBookPage />
            </RequireAuth>
          }
        />
        <Route
          path="/course"
          element={
            <RequireAuth>
              <CoursePage />
            </RequireAuth>
          }
        />
        <Route
          path="/study"
          element={
            <RequireAuth>
              <StudyPage />
            </RequireAuth>
          }
        />
        <Route
          path="/agenda"
          element={
            <RequireAuth>
              <AgendaPage />
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAuth>
              <AnalyticsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/backup"
          element={
            <RequireAuth>
              <BackupPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/grammar"
          element={
            <RequireAuth>
              <GrammarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/exam"
          element={
            <RequireAuth>
              <ExamPage />
            </RequireAuth>
          }
        />
        <Route
          path="/video"
          element={
            <RequireAuth>
              <VideoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/translate"
          element={
            <RequireAuth>
              <TranslatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/community"
          element={
            <RequireAuth>
              <CommunityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </Suspense>
  );
}

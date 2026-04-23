
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserSession, ActivitySchedule } from './types';
import { db } from './services/db.service';
import { MinistryService } from './services/ministry.service';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import EnrollmentPage from './pages/EnrollmentPage';
import FaceScanPage from './pages/FaceScanPage';
import QRScanPage from './pages/QRScanPage';
import StudentsPage from './pages/StudentsPage';
import AttendanceLogsPage from './pages/AttendanceLogsPage';
import ClassroomPage from './pages/ClassroomPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SqlEditorPage from './pages/SqlEditorPage';
import PointsLedgerPage from './pages/PointsLedgerPage';
import StudentPortalPage from './pages/StudentPortalPage';
import AssignmentsPage from './pages/AssignmentsPage';
import TeacherFairnessPage from './pages/TeacherFairnessPage';
import FollowUpPage from './pages/FollowUpPage';
import CinemaPage from './pages/CinemaPage';
import ControlCenterPage from './pages/ControlCenterPage';
import FacebookPage from './pages/FacebookPage';
import FaithPathwayPage from './pages/FaithPathwayPage';
import TeachersBoardPage from './pages/TeachersBoardPage';
import DailyQuestPage from './pages/DailyQuestPage';
import SideQuestPage from './pages/SideQuestPage';
import AskAIPage from './pages/AskAIPage';
import { canAccessAdminWorkspace, hasAskAIWorkspaceAccess, isRadUser } from './utils/permissions';

const SESSION_KEY = 'km_session';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

// Sunday service window: 9:00 AM - 12:00 PM. No auto-logout during this window
// so teachers/parents stay logged in through the whole service even if idle.
const isSundayServiceWindow = (now: Date = new Date()): boolean => {
  if (now.getDay() !== 0) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 9 * 60 && minutes < 12 * 60;
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activity, setActivity] = useState<ActivitySchedule | null>(null);

  useEffect(() => {
    MinistryService.getCurrentActivity().then(setActivity);
    // During Sunday 9am–12pm service window, restore the session on refresh
    // so the user stays logged in through the entire service.
    if (isSundayServiceWindow()) {
      const stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
          return;
        } catch {
          // fall through to cleared state
        }
      }
    }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;

    let logoutTimer: ReturnType<typeof setTimeout>;
    let windowChecker: ReturnType<typeof setInterval>;

    const resetTimer = () => {
      clearTimeout(logoutTimer);
      // Skip auto-logout during Sunday 9am–12pm service window
      if (isSundayServiceWindow()) return;
      logoutTimer = setTimeout(() => {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer);
    });

    resetTimer();

    // Re-evaluate every minute so we correctly arm/disarm the timer
    // when the clock crosses the 9am or 12pm boundary.
    windowChecker = setInterval(resetTimer, 60 * 1000);

    return () => {
      clearTimeout(logoutTimer);
      clearInterval(windowChecker);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [user]);

  const handleLogin = (role: any, username: string, studentId?: string, isReadOnly?: boolean) => {
    const session = { role, username, studentId, isReadOnly };
    setUser(session);
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(SESSION_KEY, serialized);
    // Persist to localStorage during Sunday 9am–12pm so refreshes keep the user logged in.
    if (isSundayServiceWindow()) {
      localStorage.setItem(SESSION_KEY, serialized);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const isTeacherOrAdmin = canAccessAdminWorkspace(user);
  const isAdmin = user?.role === 'ADMIN';
  const isGuest = (user?.username ?? '').toUpperCase() === 'GUEST';

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={
          user ? (
            isGuest ? <Navigate to="/leaderboard" replace /> :
            (user.role === 'PARENTS' ? <Navigate to="/portal" replace /> : <Navigate to="/admin" replace />)
          ) : <LoginPage onLogin={handleLogin} />
        } />
        
        <Route element={<Layout user={user} onLogout={handleLogout} />}>
          <Route path="/admin" element={
            !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <AdminDashboard activity={activity} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/faith-pathway" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <FaithPathwayPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/teachers-board" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <TeachersBoardPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/ask-ai" element={
             !user ? <Navigate to="/login" replace /> : (hasAskAIWorkspaceAccess(user) ? <AskAIPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/control-center" element={
             !user ? <Navigate to="/login" replace /> : (isRadUser(user.username) ? <ControlCenterPage /> : <Navigate to="/admin" replace />)
          } />

          <Route path="/admin/students" element={
            !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <StudentsPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/assignments" element={
            !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <AssignmentsPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/logs" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <AttendanceLogsPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/points" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <PointsLedgerPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/fairness" element={
              !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <TeacherFairnessPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/follow-up" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <FollowUpPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/enrollment" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <EnrollmentPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/qr-scan" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <QRScanPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/sql" element={
             !user ? <Navigate to="/login" replace /> : (isAdmin ? <SqlEditorPage /> : <Navigate to="/admin" replace />)
          } />

          <Route path="/classrooms/:group" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <ClassroomPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/leaderboard" element={
            !user ? <Navigate to="/login" replace /> : <LeaderboardPage />
          } />

          <Route path="/kidsflix" element={
            !user ? <Navigate to="/login" replace /> : <CinemaPage />
          } />

          <Route path="/facebook" element={
            !user ? <Navigate to="/login" replace /> : <FacebookPage />
          } />

          <Route path="/portal" element={
             !user ? <Navigate to="/login" replace /> : (
               isGuest ? <Navigate to="/leaderboard" replace /> :
               (user.role === 'PARENTS' ? <StudentPortalPage user={user} /> : <Navigate to="/admin" replace />)
             )
          } />

          <Route path="/teacher/scan" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <FaceScanPage user={user!} /> : <Navigate to="/portal" replace />)
          } />

          {/* Daily Quest - Public Access */}
          <Route path="/daily-quest" element={
            <DailyQuestPage user={user || { role: 'PARENTS', username: 'Guest', studentId: 'GUEST_DEMO' }} />
          } />

          {/* Side Quest - Public Access */}
          <Route path="/side-quest" element={
            <SideQuestPage user={user || { role: 'PARENTS', username: 'Guest', studentId: 'GUEST_DEMO' }} />
          } />
        </Route>

        <Route path="*" element={<Navigate to={user ? (isGuest ? "/leaderboard" : (user.role === 'PARENTS' ? "/portal" : "/admin")) : "/login"} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;

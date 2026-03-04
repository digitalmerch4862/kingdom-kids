
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

const SESSION_KEY = 'km_session';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activity, setActivity] = useState<ActivitySchedule | null>(null);

  useEffect(() => {
    MinistryService.getCurrentActivity().then(setActivity);
    const saved = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        localStorage.removeItem(SESSION_KEY);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let logoutTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(logoutTimer);
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

    return () => {
      clearTimeout(logoutTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [user]);

  const handleLogin = (role: any, username: string, studentId?: string) => {
    const session = { role, username, studentId };
    setUser(session);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(SESSION_KEY);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';
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

          <Route path="/admin/control-center" element={
             !user ? <Navigate to="/login" replace /> : (user.username === 'RAD' ? <ControlCenterPage /> : <Navigate to="/admin" replace />)
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
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <TeacherFairnessPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/follow-up" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <FollowUpPage user={user} /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/enrollment" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <EnrollmentPage /> : <Navigate to="/portal" replace />)
          } />

          <Route path="/admin/qr-scan" element={
             !user ? <Navigate to="/login" replace /> : (isTeacherOrAdmin ? <QRScanPage username={user.username} /> : <Navigate to="/portal" replace />)
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

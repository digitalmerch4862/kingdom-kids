
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

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activity, setActivity] = useState<ActivitySchedule | null>(null);

  useEffect(() => {
    MinistryService.getCurrentActivity().then(setActivity);
    const saved = localStorage.getItem('km_session');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (role: any, username: string, studentId?: string) => {
    const session = { role, username, studentId };
    setUser(session);
    localStorage.setItem('km_session', JSON.stringify(session));
  };

  const handleLogout = () => {
    localStorage.removeItem('km_session');
    setUser(null);
  };

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isGuest = user?.username.toUpperCase() === 'GUEST';

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
        </Route>

        <Route path="*" element={<Navigate to={user ? (isGuest ? "/leaderboard" : (user.role === 'PARENTS' ? "/portal" : "/admin")) : "/login"} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;

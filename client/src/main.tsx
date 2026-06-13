import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import Admin from './pages/Admin';
import Analytics from './pages/Analytics';
import Auth from './pages/Auth';
import CodingRoom from './pages/CodingRoom';
import Dashboard from './pages/Dashboard';
import Friends from './pages/Friends';
import Groups from './pages/Groups';
import Leaderboard from './pages/Leaderboard';
import MockTests from './pages/MockTests';
import Notifications from './pages/Notifications';
import ProfileForm from './pages/ProfileForm';
import QuestionBank from './pages/QuestionBank';
import Reports from './pages/Reports';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="profile/:mode" element={<ProfileForm />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="questions/:id" element={<CodingRoom />} />
          <Route path="mock-tests" element={<MockTests />} />
          <Route path="friends" element={<Friends />} />
          <Route path="groups" element={<Groups />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { ProtectedLayout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudentHome, ProductivityLayer, MainMenu, ELearning, StudentEssentials, LearningEssentials, LearningResources } from './pages/student';
import { ELearningPortal } from './pages/student/ELearningPortal';
import { ProductivityPortal } from './pages/student/productivity/ProductivityPortal';
import { EmailIntegration } from './pages/student/EmailIntegration';
import { ScheduleManager } from './pages/student/ScheduleManager';
import { AttendanceTracker } from './pages/student/AttendanceTracker';
import { ComingSoon } from './pages/student/ComingSoon';
import { FacultyHome, FacultyDashboard, TeachingTools } from './pages/faculty';
import { FacultyEssentials } from './pages/faculty/FacultyEssentials';
import { FacultySchedule } from './pages/faculty/FacultySchedule';
import { FacultyAttendance } from './pages/faculty/FacultyAttendance';
import { FacultyEmail } from './pages/faculty/FacultyEmail';
import { FacultySuggestions } from './pages/faculty/FacultySuggestions';
import { AdminHome, AdminDashboard } from './pages/admin';
import { Marketplace } from './pages/shared/Marketplace';
import { AIStudio } from './pages/shared/AIStudio';
import { Profile } from './pages/shared/Profile';
import { TimetableUpload } from './pages/admin/TimetableUpload';

function AuthWrapper() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function ProtectedRoute({ allowedRoles, children }: { allowedRoles: string[], children: React.ReactNode }) {
  const { role } = useAuth();
  
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }
  
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <AuthWrapper />,
    children: [
      { path: '/', element: <ProductivityPortal /> },
      { path: '/schedule', element: <ScheduleManager /> },
      { path: '/student/schedule', element: <ScheduleManager /> },
      { path: '/productivity', element: <ProductivityPortal /> },
      { path: '/student/productivity', element: <ProductivityPortal /> },
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },

      // Standalone E-Learning Student Portal Routes (matching screenshots)
      { path: '/e-learning', element: <ELearningPortal initialFrame="dashboard" /> },
      { path: '/e-learning/student', element: <ELearningPortal initialFrame="dashboard" /> },
      { path: '/e-learning/student/dashboard', element: <ELearningPortal initialFrame="dashboard" /> },
      { path: '/e-learning/student/registration-status', element: <ELearningPortal initialFrame="registration-status" /> },
      { path: '/e-learning/student/course-registration', element: <ELearningPortal initialFrame="course-registration" /> },
      { path: '/e-learning/student/study-zone', element: <ELearningPortal initialFrame="study-zone" /> },
      { path: '/e-learning/student/study-zone/:courseId', element: <ELearningPortal initialFrame="study-zone" /> },
      { path: '/student/e-learning', element: <ELearningPortal initialFrame="dashboard" /> },
      
      // Student Routes
      {
        path: '/student',
        element: (
          <ProtectedRoute allowedRoles={['student']}>
            <ProtectedLayout allowedRoles={['student']} />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <StudentHome /> },
          { path: 'main-menu', element: <MainMenu /> },
          { path: 'essentials', element: <StudentEssentials /> },
          { path: 'attendance', element: <AttendanceTracker /> },
          { path: 'email', element: <EmailIntegration /> },
          { path: 'suggestions', element: <ComingSoon title="Smart Suggestions" type="ai" /> },
          { path: 'marketplace', element: <Marketplace /> },
          { path: 'profile', element: <Profile /> },
          { path: 'communication', element: <ComingSoon title="Communication Infra" /> },
          { path: 'opportunity-hub', element: <ComingSoon title="Opportunity Hub" /> },
          
          { path: 'e-learning/essentials', element: <LearningEssentials /> },
          { path: 'e-learning/resources', element: <LearningResources /> },
          { path: 'e-learning/communication', element: <ComingSoon title="Communication Infra" /> },
          { path: 'e-learning/course-control', element: <ComingSoon title="Course Control" /> },
          { path: 'e-learning/my-learning', element: <ComingSoon title="My Learning" /> },
          { path: 'e-learning/records', element: <ComingSoon title="Academic Records" /> },
          { path: 'e-learning/suggestions', element: <ComingSoon title="Learning Suggestions" type="ai" /> },
          
          { path: 'ai-studio', element: <AIStudio /> },
        ],
      },
      
      // Faculty Routes
      {
        path: '/faculty',
        element: (
          <ProtectedRoute allowedRoles={['faculty']}>
            <ProtectedLayout allowedRoles={['faculty']} />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <FacultyHome /> },
          { path: 'main-menu', element: <FacultyDashboard /> },
          { path: 'productivity', element: <ComingSoon title="Productivity Layer" /> },
          { path: 'ai-studio', element: <AIStudio /> },
          { path: 'e-learning', element: <ComingSoon title="E-Learning" /> },
          { path: 'e-learning/essentials', element: <ComingSoon title="Teaching Essentials" /> },
          { path: 'e-learning/resources', element: <ComingSoon title="Faculty Resources" /> },
          { path: 'e-learning/communication', element: <ComingSoon title="Communication Infra" /> },
          { path: 'communication', element: <ComingSoon title="Communication Infra" /> },
          { path: 'marketplace', element: <Marketplace /> },
          { path: 'profile', element: <Profile /> },
          { path: 'opportunity-hub', element: <ComingSoon title="Opportunity Hub" /> },
          { path: 'essentials', element: <FacultyEssentials /> },
          { path: 'schedule', element: <FacultySchedule /> },
          { path: 'attendance', element: <FacultyAttendance /> },
          { path: 'email', element: <FacultyEmail /> },
          { path: 'suggestions', element: <FacultySuggestions /> },
        ],
      },
      
      // Admin Routes
      {
        path: '/admin',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout allowedRoles={['admin']} />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AdminHome /> },
          { path: 'main-menu', element: <AdminDashboard /> },
          { path: 'productivity', element: <ComingSoon title="Productivity Layer" /> },
          { path: 'ai-studio', element: <AIStudio /> },
          { path: 'communication', element: <ComingSoon title="Communication Infra" /> },
          { path: 'marketplace', element: <Marketplace /> },
          { path: 'profile', element: <Profile /> },
          { path: 'timetable-upload', element: <TimetableUpload /> },
          { path: 'opportunity-hub', element: <ComingSoon title="Opportunity Hub" /> },
          { path: 'system', element: <ComingSoon title="Smart Admin System" /> },
        ],
      },
      
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

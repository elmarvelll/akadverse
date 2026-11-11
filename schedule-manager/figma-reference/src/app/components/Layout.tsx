import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, User, ArrowLeft, LogOut, Zap, BookOpen, Bot, Home, LayoutDashboard, Briefcase, MessageSquare, GraduationCap, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

export function ProtectedLayout({ allowedRoles }: { allowedRoles: string[] }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!role || !allowedRoles.includes(role)) {
    // If not authorized, redirect handled elsewhere
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isHome = 
    location.pathname === '/student' || 
    location.pathname === '/faculty' || 
    location.pathname === '/admin';

  const isFaculty = role === 'faculty';
  const isAdmin = role === 'admin';

  // Specific styles based on role
  const isStudent = role === 'student';
  const headerBg = isStudent ? 'bg-white/80 backdrop-blur-md border-b border-slate-200/50' : 'bg-white border-b border-slate-200';
  const pageBg = isStudent ? 'bg-[#F8FAFC]' : 'bg-slate-50';

  // Base navigation based on role
  const getNavItems = () => {
    return [
      { icon: Zap, path: `/${role}/productivity`, tooltip: 'Productivity Layer', anim: { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] } },
      ...(isAdmin ? [] : [{ icon: BookOpen, path: `/${role}/e-learning`, tooltip: 'E-Learning', anim: { scale: [1, 1.1, 1], y: [0, -2, 0] } }]),
      { icon: Bot, path: `/${role}/ai-studio`, tooltip: 'AI Studio', anim: { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } },
      { icon: Home, path: `/${role}`, tooltip: 'Home Workspace', anim: { scale: [1, 1.15, 1], y: [0, -3, 0] } }
    ];
  };

  const navItems = getNavItems();

  // Dynamic Sidebar logic
  const isELearning = location.pathname.startsWith(`/${role}/e-learning`);
  
  const mainMenuSidebar = [
    { name: `${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`, icon: LayoutDashboard, path: `/${role}/main-menu` },
    ...(isAdmin ?
      [{ name: 'Smart Admin System', icon: Briefcase, path: '/admin/system' }] :
      isFaculty ?
      [{ name: 'Faculty Essentials', icon: Briefcase, path: '/faculty/essentials' }] :
      []
    )
  ];

  const eLearningSidebar = [
    { name: isFaculty ? 'Faculty E-Learning Dashboard' : 'E-Learning Dashboard', icon: LayoutDashboard, path: `/${role}/e-learning` },
    { name: 'Communication Infra.', icon: MessageSquare, path: `/${role}/e-learning/communication` },
    { name: isFaculty ? 'Teaching Essentials' : 'Learning Essentials', icon: GraduationCap, path: `/${role}/e-learning/essentials` },
    { name: isFaculty ? 'Faculty Resources' : 'Learning Resources', icon: Video, path: `/${role}/e-learning/resources` }
  ];

  const sidebarItems = isELearning ? eLearningSidebar : mainMenuSidebar;

  const hideSidebar = 
    location.pathname === `/${role}` || 
    location.pathname === `/${role}/` || 
    location.pathname === `/${role}/productivity` || 
    location.pathname === `/${role}/ai-studio`;

  return (
    <div className={`min-h-screen font-sans text-slate-900 ${pageBg} flex flex-col`}>
      <header className={`sticky top-0 z-50 w-full ${headerBg}`}>
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8 w-1/4">
            <div className="flex items-center text-blue-600 font-semibold text-lg tracking-tight cursor-pointer" onClick={() => navigate(`/${role}`)}>
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 mr-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              AkadVerse
            </div>
          </div>

          <div className="flex-1 flex justify-center items-center space-x-8">
            {navItems.map((item, i) => {
              const isActive = location.pathname === item.path || (item.path === `/${role}` && location.pathname === `/${role}/`);
              return (
                <motion.button
                  key={i}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate(item.path)}
                  className="relative group p-2 flex flex-col items-center justify-center transition-colors"
                  title={item.tooltip}
                >
                  <motion.div
                    variants={{
                      hover: { scale: 1.05, backgroundColor: 'rgba(241, 245, 249, 1)', transition: { duration: 0.2 } },
                      tap: { scale: 0.92, transition: { duration: 0.12 } }
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-full ${isActive ? 'text-indigo-600' : 'text-[#9CA3AF] group-hover:text-slate-700'}`}
                  >
                    <motion.div variants={{ hover: item.anim }}>
                      <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </motion.div>
                  </motion.div>
                  {isActive && (
                    <motion.div layoutId="activeDot" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center justify-end space-x-4 text-slate-500 w-1/4">
            <button className="p-2 rounded-full hover:bg-slate-100 transition-colors relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium hidden sm:block text-slate-700 capitalize">
                {role} Profile
              </span>
              <button 
                onClick={() => navigate(`/${role}/profile`)}
                className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                title="View Profile"
              >
                <User className="h-5 w-5" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-1"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        {!hideSidebar && (
          <motion.aside 
            animate={{ width: isSidebarOpen ? 256 : 88 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex-shrink-0 hidden md:flex flex-col py-8 border-r border-slate-200/60 sticky top-16 h-[calc(100vh-4rem)] relative"
          >
            <div className={`px-6 pb-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0, display: 'none' }}
                    animate={{ opacity: 1, display: 'block' }}
                    exit={{ opacity: 0, display: 'none' }}
                    className="text-xs font-bold text-slate-400 uppercase tracking-wider"
                  >
                    Menu
                  </motion.span>
                )}
              </AnimatePresence>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shadow-sm border border-transparent hover:border-slate-200"
              >
                {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="space-y-2 px-4">
              {sidebarItems.map((item, idx) => {
                const isActive = location.pathname === item.path;
                return (
                  <motion.button
                    key={idx}
                    whileHover={{ x: isSidebarOpen ? 4 : 0, backgroundColor: 'rgba(248, 250, 252, 1)' }}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center ${isSidebarOpen ? 'px-4' : 'justify-center'} py-3 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-white shadow-sm border border-slate-200/60 text-indigo-600 font-medium' 
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                    title={!isSidebarOpen ? item.name : undefined}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'} ${isSidebarOpen ? 'mr-3' : ''}`} />
                    <AnimatePresence>
                      {isSidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="whitespace-nowrap overflow-hidden text-left text-sm"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.aside>
        )}

        <main className="flex-1 px-6 py-8 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
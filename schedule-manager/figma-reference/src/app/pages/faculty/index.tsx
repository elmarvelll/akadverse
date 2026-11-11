import { motion } from 'motion/react';
import { Zap, Home, BookOpen, Bot, Menu, Users, Calendar, FileText, Activity, Megaphone, UserCheck, Mail, Lightbulb, Clock, ArrowRight, GraduationCap, MapPin, TrendingUp, MessageSquare, TriangleAlert, ShoppingCart, Compass } from 'lucide-react';
import { useNavigate } from 'react-router';

const Card = ({ title, description, icon: Icon, onClick, color, delay = 0 }: any) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay, ease: 'easeOut' }}
    onClick={onClick}
    className="group bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] rounded-[20px] p-7 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col items-start"
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-sm ${color}`}>
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500 leading-relaxed text-sm font-medium">{description}</p>
    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-[0.07] transition-opacity duration-200 pointer-events-none">
      <Icon className="h-28 w-28 -mt-8 -mr-8" />
    </div>
  </motion.div>
);

export function FacultyHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Good morning, Faculty</h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">Select a workspace to manage your teaching experience.</p>
      </motion.div>

      {/* Top Row — AI Studio (hero) | Main Menu | Productivity Layer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0, ease: 'easeOut' }}
          onClick={() => navigate('/faculty/ai-studio')}
          className="group relative bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[20px] p-8 cursor-pointer overflow-hidden flex flex-col items-start shadow-lg hover:shadow-[0_20px_50px_rgb(16,185,129,0.3)] transition-all duration-300 min-h-[200px]"
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/30 blur-2xl" />
          </div>
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 border border-white/30">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <h3 className="relative z-10 text-2xl font-bold text-white mb-3 tracking-tight">AI Studio</h3>
          <p className="relative z-10 text-emerald-100 leading-relaxed text-sm font-medium">AI-powered assistant for grading, course planning, lesson creation, and teaching intelligence.</p>
          <div className="relative z-10 mt-auto pt-6 flex items-center gap-2 text-xs font-semibold text-emerald-200 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            AkadVerse AI
          </div>
          <div className="absolute bottom-0 right-0 p-6 opacity-10 pointer-events-none">
            <Bot className="h-32 w-32" />
          </div>
        </motion.div>

        <Card title="Main Menu" description="Access your faculty dashboard, tools, and teaching essentials." icon={Menu} onClick={() => navigate('/faculty/main-menu')} color="bg-cyan-50 text-cyan-600" delay={0.08} />
        <Card title="Productivity Layer" description="Documents, Drive, Forms, Sheets, and Gemini Chat for faculty workflows." icon={Zap} onClick={() => navigate('/faculty/productivity')} color="bg-purple-50 text-purple-600" delay={0.12} />
      </div>

      {/* Middle Row — Communication | E-Learning | Marketplace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Communication Infrastructure" description="Messaging, announcements, and faculty-student communication channels." icon={MessageSquare} onClick={() => navigate('/faculty/communication')} color="bg-slate-100 text-slate-600" delay={0.16} />
        <Card title="E-Learning" description="Manage courses, upload materials, and track student academic progress." icon={BookOpen} onClick={() => navigate('/faculty/e-learning')} color="bg-emerald-50 text-emerald-600" delay={0.20} />
        <Card title="Marketplace" description="Explore and share academic resources, materials, and publications." icon={ShoppingCart} onClick={() => navigate('/faculty/marketplace')} color="bg-amber-50 text-amber-600" delay={0.24} />
      </div>

      {/* Bottom Row — Opportunity Hub (full width) */}
      <motion.div
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.28, ease: 'easeOut' }}
        onClick={() => navigate('/faculty/opportunity-hub')}
        className="group bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] rounded-[20px] p-8 cursor-pointer transition-all duration-200 overflow-hidden relative"
      >
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Opportunity Hub</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-3xl">
              Discover grants, fellowships, research collaborations, conference opportunities, academic partnerships, and career programs from universities, organizations, and institutions worldwide.
            </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-200 pointer-events-none">
          <Compass className="h-40 w-40 -mt-10 -mr-10" />
        </div>
      </motion.div>
    </div>
  );
}

export function FacultyDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Faculty Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Your daily teaching overview and insights.</p>
        </div>
      </div>

      {/* 1. Lecturer Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Courses', value: '3', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Students', value: '184', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Classes Today', value: '2', icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Attendance Avg', value: '88%', icon: UserCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Main Content) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 2. Today's Classes */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Today's Classes</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { code: 'CSC 211', title: 'Data Structures', time: '09:00 – 10:30', room: 'Engineering Hall 302' },
                { code: 'EEE 214', title: 'Circuit Analysis', time: '13:00 – 14:30', room: 'Room 204' },
              ].map((cls, i) => (
                <div key={i} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md mb-2 inline-block">{cls.code}</span>
                    <h3 className="text-lg font-bold text-slate-800">{cls.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {cls.time}</div>
                      <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {cls.room}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => navigate('/faculty/attendance')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">Record Attendance</button>
                    <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">Course Materials</button>
                    <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">Announcement</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Course Overview */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Course Overview</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { code: 'CSC 211', title: 'Data Structures', students: 82, attendance: '91%', next: 'Tomorrow 09:00' },
                { code: 'EEE 214', title: 'Circuit Analysis', students: 64, attendance: '85%', next: 'Today 13:00' },
                { code: 'CSC 305', title: 'Algorithms', students: 38, attendance: '88%', next: 'Thursday 10:00' },
              ].map((course, i) => (
                <div key={i} className="p-5 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md cursor-pointer transition-all bg-white group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{course.code}</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-4">{course.title}</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs font-medium mb-0.5">Students</p>
                      <p className="font-semibold text-slate-700">{course.students}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium mb-0.5">Attendance</p>
                      <p className="font-semibold text-slate-700">{course.attendance}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs font-medium mb-0.5">Next Lecture</p>
                      <p className="font-semibold text-slate-700">{course.next}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-8">
          
          {/* 4. Student Alerts */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <TriangleAlert className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Student Alerts</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Low Attendance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Daniel Adeyemi</span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">68%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Grace Okafor</span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">71%</span>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Struggling Academically</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">John Mensah</span>
                    <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">GPA 1.9</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Mary Bello</span>
                    <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">GPA 2.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Recent Student Activity & 6. Announcements */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Activity & Updates</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-snug">12 new assignment submissions received for CSC 211.</p>
                  <p className="text-xs text-slate-400 mt-1">1 hour ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-snug">3 students asked questions about Circuit Analysis lecture.</p>
                  <p className="text-xs text-slate-400 mt-1">3 hours ago</p>
                </div>
              </div>
              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Announcements</h3>
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 mb-2">
                  <p className="text-sm font-medium text-amber-800">Assignment 2 deadline extended to Sunday.</p>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                  <p className="text-sm font-medium text-blue-800">Extra tutorial session scheduled for Friday.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Quick Access to Faculty Essentials */}
          <div className="bg-slate-900 rounded-[24px] p-6 shadow-md text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Zap className="w-32 h-32 -mt-8 -mr-8" />
            </div>
            <h2 className="text-lg font-bold mb-4 relative z-10">Faculty Essentials Shortcuts</h2>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {[
                { name: 'Schedule', icon: Calendar, path: '/faculty/schedule' },
                { name: 'Attendance', icon: UserCheck, path: '/faculty/attendance' },
                { name: 'Email', icon: Mail, path: '/faculty/email' },
                { name: 'Suggestions', icon: Lightbulb, path: '/faculty/suggestions' },
              ].map((shortcut, i) => (
                <button 
                  key={i}
                  onClick={() => navigate(shortcut.path)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-slate-100"
                >
                  <shortcut.icon className="w-5 h-5 text-indigo-300" />
                  <span className="text-xs font-medium">{shortcut.name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export function TeachingTools() {
  return (
    <div className="space-y-8">
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-800">Teaching Tools</h1>
        <p className="text-slate-500 mt-1">Resources for faculty preparation and course management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 bg-white p-6 rounded-lg flex items-start gap-4 hover:border-blue-400 transition-colors cursor-pointer">
          <Zap className="h-8 w-8 text-blue-600 shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-1">AI Teaching Assistant</h3>
            <p className="text-sm text-slate-600">Draft syllabi, generate quiz questions, and analyze student performance patterns automatically.</p>
          </div>
        </div>
        <div className="border border-slate-200 bg-white p-6 rounded-lg flex items-start gap-4 hover:border-blue-400 transition-colors cursor-pointer">
          <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-1">Document Collaboration</h3>
            <p className="text-sm text-slate-600">Share rubrics, faculty notes, and departmental documents securely.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
import {
  Home, Bot, Zap, Menu, Users, Building, ShoppingCart, BarChart, TriangleAlert,
  GraduationCap, BookOpen, Clock, Activity, ClipboardList, TrendingDown, TrendingUp,
  Search, FileText, MessageSquare, Video, Bell, ChevronRight, UserCheck, Compass
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';

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

export function AdminHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Good morning, Admin</h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">Select an administrative workspace to continue.</p>
      </motion.div>

      {/* Top Row — AI Studio (hero) | Main Menu | Productivity Layer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0, ease: 'easeOut' }}
          onClick={() => navigate('/admin/ai-studio')}
          className="group relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-[20px] p-8 cursor-pointer overflow-hidden flex flex-col items-start shadow-lg hover:shadow-[0_20px_50px_rgb(245,158,11,0.3)] transition-all duration-300 min-h-[200px]"
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/30 blur-2xl" />
          </div>
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 border border-white/30">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <h3 className="relative z-10 text-2xl font-bold text-white mb-3 tracking-tight">AI Studio</h3>
          <p className="relative z-10 text-amber-100 leading-relaxed text-sm font-medium">Specialized admin AI agents for institutional analytics, reporting, and academic intelligence.</p>
          <div className="relative z-10 mt-auto pt-6 flex items-center gap-2 text-xs font-semibold text-amber-200 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            AkadVerse AI
          </div>
          <div className="absolute bottom-0 right-0 p-6 opacity-10 pointer-events-none">
            <Bot className="h-32 w-32" />
          </div>
        </motion.div>

        <Card title="Main Menu" description="Access the admin dashboard, university analytics, and smart admin system." icon={Menu} onClick={() => navigate('/admin/main-menu')} color="bg-cyan-50 text-cyan-600" delay={0.08} />
        <Card title="Productivity Layer" description="Documents, forms, and workflow tools for administrative operations." icon={Zap} onClick={() => navigate('/admin/productivity')} color="bg-purple-50 text-purple-600" delay={0.12} />
      </div>

      {/* Middle Row — Communication | Timetable Management | Marketplace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Communication Infrastructure" description="Institutional messaging, announcements, and broadcast channels." icon={MessageSquare} onClick={() => navigate('/admin/communication')} color="bg-slate-100 text-slate-600" delay={0.16} />
        <Card title="Timetable Management" description="Upload and manage academic schedules, exam timetables, and semester plans." icon={Clock} onClick={() => navigate('/admin/timetable-upload')} color="bg-emerald-50 text-emerald-600" delay={0.20} />
        <Card title="Marketplace" description="Manage and monitor the academic resources marketplace and student exchanges." icon={ShoppingCart} onClick={() => navigate('/admin/marketplace')} color="bg-amber-50 text-amber-600" delay={0.24} />
      </div>

      {/* Bottom Row — Opportunity Hub (full width) */}
      <motion.div
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.28, ease: 'easeOut' }}
        onClick={() => navigate('/admin/opportunity-hub')}
        className="group bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] rounded-[20px] p-8 cursor-pointer transition-all duration-200 overflow-hidden relative"
      >
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Opportunity Hub</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-3xl">
              Connect your institution with universities, companies, and organizations offering internships, scholarships, research programs, and academic partnerships to support student and faculty growth.
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

const StatCard = ({ label, value, icon: Icon, color, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="bg-white/70 backdrop-blur-xl border border-white/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group"
  >
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="relative z-10">
      <h4 className="text-slate-500 text-sm font-medium mb-1">{label}</h4>
      <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
    </div>
    <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ${color.split(' ')[0]}`} />
  </motion.div>
);

export function AdminDashboard() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">University Operations Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Complete overview of institutional metrics and platform activity.</p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-semibold">System Operational</span>
        </div>
      </div>

      {/* 1. University Overview Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard delay={0.1} label="Total Students" value="10,245" icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard delay={0.15} label="Total Lecturers" value="612" icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
        <StatCard delay={0.2} label="Active Courses" value="1,320" icon={BookOpen} color="bg-purple-50 text-purple-600" />
        <StatCard delay={0.25} label="Classes Today" value="284" icon={Clock} color="bg-amber-50 text-amber-600" />
        <StatCard delay={0.3} label="Attendance Rate" value="88%" icon={Activity} color="bg-emerald-50 text-emerald-600" />
        <StatCard delay={0.35} label="Pending Requests" value="17" icon={ClipboardList} color="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Analytics & Students */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. Attendance Analytics */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Department Attendance Analytics
            </h3>
            
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-800">Attendance Warning</h4>
                <p className="text-sm text-rose-600 mt-1">EEE 212 – Circuit Theory attendance dropped below 70% this week.</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { dept: 'Computer Science', rate: 89, color: 'bg-emerald-500' },
                { dept: 'Electrical Engineering', rate: 84, color: 'bg-blue-500' },
                { dept: 'Accounting', rate: 92, color: 'bg-emerald-500' },
                { dept: 'Architecture', rate: 81, color: 'bg-amber-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700 w-40">{item.dept}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${item.rate}%` }} transition={{ delay: 0.6 + (i * 0.1), duration: 0.8 }}
                      className={`h-full ${item.color} rounded-full`}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-12 text-right">{item.rate}%</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* 3. Student Management Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Student Directory
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search students..." 
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="p-4">Student Name</th>
                    <th className="p-4">Matric No.</th>
                    <th className="p-4">Programme</th>
                    <th className="p-4">Level</th>
                    <th className="p-4">GPA</th>
                    <th className="p-4">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="p-4 font-medium text-slate-800">Daniel Adeyemi</td>
                    <td className="p-4 text-slate-600 text-sm">22CG028451</td>
                    <td className="p-4 text-slate-600 text-sm">Computer Engineering</td>
                    <td className="p-4 text-slate-600 text-sm">200</td>
                    <td className="p-4 font-semibold text-blue-600 text-sm">4.21</td>
                    <td className="p-4 text-sm font-medium text-emerald-600">87%</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="p-4 font-medium text-slate-800">Sarah Olatunji</td>
                    <td className="p-4 text-slate-600 text-sm">21MD015233</td>
                    <td className="p-4 text-slate-600 text-sm">Medicine</td>
                    <td className="p-4 text-slate-600 text-sm">300</td>
                    <td className="p-4 font-semibold text-blue-600 text-sm">4.85</td>
                    <td className="p-4 text-sm font-medium text-emerald-600">96%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* 4. Lecturer & 5. Course Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                Lecturer Overview
              </h3>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">DA</div>
                  <div>
                    <h4 className="font-semibold text-slate-800">Dr. Adewale</h4>
                    <p className="text-xs text-slate-500">Computer Science</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Courses</p>
                  <p className="text-sm text-slate-700">CSC 211 – Data Structures</p>
                  <p className="text-sm text-slate-700">CSC 214 – Comp. Architecture</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                Active Courses
              </h3>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer border-l-4 border-l-amber-500">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-800">CSC 211</h4>
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded font-semibold">3 Units</span>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-3">Data Structures</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Dr. Adewale • Computer Science</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

        {/* Right Column: Alerts, Platform Activity, Attendance Monitoring */}
        <div className="space-y-6">
          
          {/* 8. System Alerts */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="bg-slate-900 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500/20 rounded-full blur-2xl" />
            
            <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 relative z-10">
              <Bell className="w-5 h-5 text-amber-400" />
              System Alerts
            </h3>
            
            <div className="space-y-3 relative z-10">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <div className="mt-0.5"><TriangleAlert className="w-4 h-4 text-amber-400" /></div>
                  <p className="text-sm font-medium text-slate-100 leading-snug">120 students are below the required attendance level.</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <div className="mt-0.5"><Clock className="w-4 h-4 text-blue-400" /></div>
                  <p className="text-sm font-medium text-slate-100 leading-snug">Course registration closes in 48 hours.</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <div className="mt-0.5"><Zap className="w-4 h-4 text-emerald-400" /></div>
                  <p className="text-sm font-medium text-slate-100 leading-snug">System update scheduled tonight at 02:00 AM.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 7. Platform Activity */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Platform Activity
            </h3>
            <p className="text-xs text-slate-500 mb-5">Today's AkadVerse engagement</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><MessageSquare className="w-4 h-4" /></div>
                  <span className="text-sm font-medium text-slate-700">Gemini Sessions</span>
                </div>
                <span className="font-bold text-slate-800">2,140</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><FileText className="w-4 h-4" /></div>
                  <span className="text-sm font-medium text-slate-700">Documents Created</span>
                </div>
                <span className="font-bold text-slate-800">892</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Video className="w-4 h-4" /></div>
                  <span className="text-sm font-medium text-slate-700">Learning Videos</span>
                </div>
                <span className="font-bold text-slate-800">1,430</span>
              </div>
            </div>
          </motion.div>

          {/* 6. Attendance Monitoring Summary */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500" />
              Attendance Watchlist
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 rounded-2xl p-4 text-center border border-rose-100">
                <p className="text-3xl font-bold text-rose-600 mb-1">112</p>
                <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Students <br/>&lt; 75%</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                <p className="text-3xl font-bold text-amber-600 mb-1">9</p>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Courses with<br/>Issues</p>
              </div>
            </div>
            
            <button className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2">
              View Full Reports <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
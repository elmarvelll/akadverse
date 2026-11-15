import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Zap, Menu, BookOpen, Bot, FileText, Folder, Home, ShoppingCart, Briefcase, GraduationCap, Video, Calendar, SquareCheck, Mail, Lightbulb, Youtube, Play, X, Clock, FileSpreadsheet, LayoutList, MessageSquare, BarChart, Building2, Users, Rocket, Award, Compass, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const WorkspaceCard = ({ title, icon: Icon, meta1, meta2, bgClass, iconClass, onClick, delay = 0, progress }: any) => (
  <motion.div
    whileHover={{ y: -3 }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay, ease: 'easeOut' }}
    onClick={onClick}
    className={`group relative rounded-2xl p-5 cursor-pointer transition-all duration-200 overflow-hidden hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] ${bgClass}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
    </div>
    <h3 className="font-semibold text-slate-800 text-[15px] leading-tight mb-1">{title}</h3>
    {meta1 && <p className="text-xs font-medium text-slate-600 mb-0.5">{meta1}</p>}
    {meta2 && <p className="text-xs text-slate-400">{meta2}</p>}
    {progress !== undefined && (
      <div className="mt-3 w-full h-1.5 bg-black/[0.07] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, delay: delay + 0.5, ease: 'easeOut' }}
          className="h-full bg-emerald-500/60 rounded-full"
        />
      </div>
    )}
  </motion.div>
);

const orgTypes = [
  { icon: GraduationCap, label: 'Universities', color: 'text-blue-600 bg-blue-50' },
  { icon: Building2, label: 'Companies', color: 'text-slate-700 bg-slate-100' },
  { icon: Users, label: 'Organizations', color: 'text-purple-600 bg-purple-50' },
  { icon: Rocket, label: 'Startups', color: 'text-rose-600 bg-rose-50' },
  { icon: Award, label: 'Scholarships', color: 'text-amber-600 bg-amber-50' },
];

function AnimatedOrgLogo() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % orgTypes.length), 2200);
    return () => clearInterval(t);
  }, []);
  const { icon: Icon, color, label } = orgTypes[idx];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-14 h-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`absolute inset-0 rounded-2xl flex items-center justify-center border border-white/60 shadow-sm ${color}`}
          >
            <Icon className="w-7 h-7" />
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-xs font-medium text-slate-400 whitespace-nowrap"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function StudentHome() {
  const navigate = useNavigate();

  const recentActivity = [
    { text: 'Completed "Binary Search Trees" module in Data Structures', time: '1h ago', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50' },
    { text: 'AI Studio helped draft your Physics Lab report introduction', time: '3h ago', icon: Bot, color: 'text-pink-600 bg-pink-50' },
    { text: 'Uploaded Assignment 2 for CSC 301', time: 'Yesterday', icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { text: 'Saved 3 items to Marketplace wishlist', time: 'Yesterday', icon: ShoppingCart, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Subtle ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-0 w-[700px] h-[500px] bg-blue-300/[0.035] rounded-full blur-[140px] -translate-x-1/3 -translate-y-1/4" />
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-violet-300/[0.04] rounded-full blur-[120px] translate-x-1/4 -translate-y-1/3" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[350px] bg-indigo-300/[0.025] rounded-full blur-[100px] translate-y-1/3" />
      </div>

      {/* 1. Personalized greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Good morning, Awesome 👋</h1>
        <p className="text-slate-500 mt-2 text-base font-medium">Here's what's happening across your academic journey today.</p>
      </motion.div>

      {/* 2. Continue Learning + Today at a Glance */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Continue Learning — 3 cols */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Continue Learning</p>
          </div>

          <div className="mb-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Data Structures</h3>
                <p className="text-sm text-slate-500 mt-0.5">CSC 301 · Prof. Chen · Week 7 of 14</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">Active</span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                <span>Course progress</span>
                <span className="font-bold text-slate-700">65%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '65%' }}
                  transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
            <motion.button
              whileHover="hover"
              onClick={() => navigate('/student/e-learning')}
              className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Continue learning
              <motion.span variants={{ hover: { x: 3 } }} transition={{ duration: 0.15 }}>
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </motion.button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Also in progress</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Calculus II', code: 'MAT 202', progress: 40, color: 'bg-blue-500' },
                { name: 'World Literature', code: 'ENG 105', progress: 85, color: 'bg-rose-500' },
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 cursor-pointer transition-colors">
                  <p className="text-xs font-semibold text-slate-700 mb-2">{c.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">{c.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Today at a Glance — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today</p>
            <span className="ml-auto text-xs font-medium text-slate-400">Thu, Sep 3</span>
          </div>

          <div className="mb-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Classes</p>
            <div className="space-y-2">
              {[
                { course: 'Calculus II', time: '09:00', loc: 'Room 302', bar: 'bg-blue-500' },
                { course: 'Data Structures', time: '14:00', loc: 'Online', bar: 'bg-emerald-500' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className={`w-1 h-8 rounded-full ${c.bar} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.course}</p>
                    <p className="text-xs text-slate-400">{c.loc}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg shrink-0">{c.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Due Today</p>
            <div className="space-y-2">
              {[
                { task: 'Submit Lab Report', course: 'Physics II', urgency: 'high' },
                { task: 'Read Chapter 4–5', course: 'Calculus II', urgency: 'medium' },
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${t.urgency === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.task}</p>
                    <p className="text-xs text-slate-400">{t.course}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Your Workspaces — compact color-coded cards */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your Workspaces</p>
          <div className="flex-1 h-px bg-slate-200/70" />
        </div>

        {/* Top row: AI Studio | Main Menu | Productivity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* AI Studio — slightly more prominent, pink/lilac tint */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.16, ease: 'easeOut' }}
            onClick={() => navigate('/student/ai-studio')}
            className="group relative bg-gradient-to-br from-pink-50 to-violet-50/80 border border-pink-100/80 rounded-2xl p-5 cursor-pointer hover:shadow-[0_8px_24px_rgb(0,0,0,0.07)] transition-all duration-200 overflow-hidden"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
                <Bot className="w-[18px] h-[18px]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Active</span>
              </div>
            </div>
            <h3 className="font-semibold text-slate-800 text-[15px] leading-tight mb-1">AI Studio</h3>
            <p className="text-xs font-medium text-slate-600 mb-0.5">3 sessions today</p>
            <p className="text-xs text-slate-400">Last: Summarize my research paper</p>
          </motion.div>

          <WorkspaceCard title="Main Menu" icon={Menu} meta1="Today: 3 classes" meta2="2 tasks due" bgClass="bg-violet-50/70 border border-violet-100" iconClass="bg-violet-100 text-violet-600" onClick={() => navigate('/student/main-menu')} delay={0.20} />
          <WorkspaceCard title="Productivity Layer" icon={Zap} meta1="3 documents" meta2="2 tasks pending" bgClass="bg-blue-50/70 border border-blue-100" iconClass="bg-blue-100 text-blue-600" onClick={() => navigate('/student/productivity')} delay={0.24} />
        </div>

        {/* Middle row: Communication | E-Learning | Marketplace */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <WorkspaceCard title="Communication" icon={MessageSquare} meta1="5 unread messages" meta2="2 new announcements" bgClass="bg-slate-50/80 border border-slate-200" iconClass="bg-slate-100 text-slate-600" onClick={() => navigate('/student/communication')} delay={0.28} />
          <WorkspaceCard title="E-Learning" icon={BookOpen} meta1="4 courses in progress" meta2="78% avg completion" bgClass="bg-emerald-50/70 border border-emerald-100" iconClass="bg-emerald-100 text-emerald-600" onClick={() => navigate('/student/e-learning')} delay={0.32} progress={78} />
          <WorkspaceCard title="Marketplace" icon={ShoppingCart} meta1="12 new listings" meta2="4 saved items" bgClass="bg-amber-50/70 border border-amber-100" iconClass="bg-amber-100 text-amber-600" onClick={() => navigate('/student/marketplace')} delay={0.36} />
        </div>

        {/* Opportunity Hub — full width */}
        <motion.div
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.40, ease: 'easeOut' }}
          onClick={() => navigate('/student/opportunity-hub')}
          className="group bg-rose-50/60 border border-rose-100 rounded-2xl p-5 cursor-pointer hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-all duration-200 overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Compass className="w-[18px] h-[18px]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-slate-800 text-[15px]">Opportunity Hub</h3>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full">8 new</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Internships, scholarships, fellowships, competitions &amp; academic programs worldwide.</p>
              </div>
            </div>
            <div className="shrink-0 sm:border-l sm:border-rose-100/80 sm:pl-5">
              <AnimatedOrgLogo />
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. Recent Activity */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent Activity</p>
          <div className="flex-1 h-px bg-slate-200/70" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.44 }}
          className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
        >
          {recentActivity.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${i < recentActivity.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <p className="flex-1 text-sm text-slate-700 font-medium">{item.text}</p>
              <span className="text-xs text-slate-400 shrink-0">{item.time}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export function ProductivityLayer() {
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const tools = [
    { title: 'Docs', icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { title: 'Drive', icon: Folder, color: 'text-amber-600 bg-amber-50' },
    { title: 'Forms', icon: LayoutList, color: 'text-purple-600 bg-purple-50' },
    { title: 'Sheets', icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Gemini Chat', icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50', primary: true }
  ];

  const videoCategories = [
    {
      title: 'Relating to your course',
      videos: [
        { id: 1, title: 'Understanding Advanced Calculus', thumb: 'https://images.unsplash.com/photo-1694878982141-cc798b98f926?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3V0dWJlJTIwdGh1bWJuYWlsJTIwc3R1ZHlpbmd8ZW58MXx8fHwxNzczMDkxMzIwfDA&ixlib=rb-4.1.0&q=80&w=1080', duration: '15:24', views: '120K views' },
        { id: 2, title: 'Physics 101: Quantum Mechanics', thumb: 'https://images.unsplash.com/photo-1768005419000-d53e45851b50?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2llbmNlJTIwc3BhY2UlMjBkb2N1bWVudGFyeSUyMHRodW1ibmFpbHxlbnwxfHx8fDE3NzMwOTEzMjR8MA&ixlib=rb-4.1.0&q=80&w=1080', duration: '45:10', views: '85K views' },
        { id: 3, title: 'Data Structures in Python', thumb: 'https://images.unsplash.com/photo-1655199798109-08ff7497e748?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3V0dWJlJTIwdGh1bWJuYWlsJTIwcHJvZ3JhbW1pbmd8ZW58MXx8fHwxNzczMDkxMzE2fDA&ixlib=rb-4.1.0&q=80&w=1080', duration: '22:30', views: '200K views' }
      ]
    },
    {
      title: 'Career & Future Options',
      videos: [
        { id: 4, title: 'A Day in the Life of a Software Engineer', thumb: 'https://images.unsplash.com/photo-1762330472769-cb8e6c8324d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJlZXIlMjBqb2IlMjBhZHZpY2UlMjB0aHVtYm5haWx8ZW58MXx8fHwxNzczMDkxMzI4fDA&ixlib=rb-4.1.0&q=80&w=1080', duration: '18:05', views: '500K views' },
        { id: 5, title: 'How to Build a Startup', thumb: 'https://images.unsplash.com/photo-1655199798109-08ff7497e748?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3V0dWJlJTIwdGh1bWJuYWlsJTIwcHJvZ3JhbW1pbmd8ZW58MXx8fHwxNzczMDkxMzE2fDA&ixlib=rb-4.1.0&q=80&w=1080', duration: '32:15', views: '1M views' },
        { id: 6, title: 'Top 10 High-Paying Jobs 2026', thumb: 'https://images.unsplash.com/photo-1694878982141-cc798b98f926?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3V0dWJlJTIwdGh1bWJuYWlsJTIwc3R1ZHlpbmd8ZW58MXx8fHwxNzczMDkxMzIwfDA&ixlib=rb-4.1.0&q=80&w=1080', duration: '12:40', views: '300K views' }
      ]
    }
  ];

  return (
    <div className="space-y-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Essentials</h1>
        <p className="text-slate-500 mt-2">Tools for research, writing, and organization.</p>
      </motion.div>

      {/* Tools Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tools.map((tool, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -6, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.96 }}
            className={`cursor-pointer rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all bg-white border ${
              tool.primary ? 'border-indigo-200 shadow-md ring-1 ring-indigo-500/10' : 'border-slate-200/60 shadow-sm hover:border-slate-300'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${tool.color}`}>
              <tool.icon className="w-6 h-6" />
            </div>
            <h3 className={`font-medium ${tool.primary ? 'text-indigo-900' : 'text-slate-700'}`}>{tool.title}</h3>
          </motion.div>
        ))}
      </div>

      {/* YouTube Hub (Netflix-style) */}
      <div className="bg-slate-900 rounded-3xl p-8 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Youtube className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Youtube className="w-8 h-8 text-red-500" />
            <h2 className="text-2xl font-bold text-white tracking-tight">AkadVerse <span className="text-slate-400 font-normal">Hub</span></h2>
          </div>

          <div className="space-y-8">
            {videoCategories.map((category, idx) => (
              <div key={idx}>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">{category.title}</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                  {category.videos.map((video) => (
                    <motion.div
                      key={video.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setSelectedVideo(video)}
                      className="min-w-[280px] w-[280px] sm:min-w-[320px] sm:w-[320px] flex-shrink-0 cursor-pointer snap-start group"
                    >
                      <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-slate-800 border border-slate-700">
                        <img src={video.thumb} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <Play className="w-6 h-6 text-white ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs font-medium rounded-md">
                          {video.duration}
                        </div>
                      </div>
                      <h4 className="text-white font-medium line-clamp-1 group-hover:text-red-400 transition-colors">{video.title}</h4>
                      <p className="text-slate-400 text-sm mt-1">{video.views} • Recommended</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4 sm:p-6"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-black w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video bg-slate-900 relative">
                <img src={selectedVideo.thumb} className="w-full h-full object-cover opacity-50" alt="Video cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-red-600/90 flex items-center justify-center cursor-pointer hover:bg-red-500 hover:scale-110 transition-all duration-200">
                    <Play className="w-10 h-10 text-white ml-2" />
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 bg-slate-800">
                <h2 className="text-2xl font-bold text-white mb-2">{selectedVideo.title}</h2>
                <div className="flex items-center gap-4 text-slate-400 text-sm mb-4">
                  <span>{selectedVideo.views}</span>
                  <span>•</span>
                  <span>{selectedVideo.duration}</span>
                  <span>•</span>
                  <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">HD</span>
                </div>
                <p className="text-slate-300 leading-relaxed max-w-3xl">
                  This video provides an in-depth look into the core concepts of {selectedVideo.title.toLowerCase()}. 
                  Perfect for students looking to supplement their academic learning with high-quality visual content.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MainMenu() {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Student Dashboard</h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Here's a quick glance at your academic day.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="font-medium text-slate-700">Fall Semester 2026</span>
          <span className="text-slate-300 mx-2">|</span>
          <span className="text-slate-500">Week 7</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Schedule / Timetable */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800">Today's Schedule</h3>
              </div>
              <button onClick={() => navigate('/student/schedule')} className="text-sm font-medium text-blue-600 hover:text-blue-700">View Full</button>
            </div>
            
            <div className="space-y-4">
              {[
                { time: '09:00 - 10:30', course: 'Calculus II', prof: 'Prof. Johnson', loc: 'Room 302', type: 'Lecture' },
                { time: '11:00 - 12:30', course: 'Physics 101', prof: 'Dr. R. Smith', loc: 'Science Lab A', type: 'Lab' },
                { time: '14:00 - 15:30', course: 'Data Structures', prof: 'Prof. Chen', loc: 'Online (Zoom)', type: 'Seminar' },
              ].map((cls, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4 mb-2 sm:mb-0">
                    <div className="w-1.5 h-12 bg-blue-500 rounded-full flex-shrink-0"></div>
                    <div>
                      <h4 className="font-semibold text-slate-800">{cls.course}</h4>
                      <p className="text-sm text-slate-500">{cls.prof}</p>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col justify-between sm:items-end ml-5 sm:ml-0">
                    <span className="text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">{cls.time}</span>
                    <span className="text-xs font-medium text-slate-500 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> {cls.loc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Recent Emails & Messages */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800">Recent Messages</h3>
              </div>
              <button onClick={() => navigate('/student/email')} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Open Inbox</button>
            </div>

            <div className="space-y-1">
              {[
                { sender: 'Dr. Smith', subject: 'Assignment Feedback: Physics Lab', time: '2h ago', unread: true },
                { sender: 'Registrar Office', subject: 'Important: Spring 2027 Registration', time: '5h ago', unread: true },
                { sender: 'Prof. Chen', subject: 'Data Structures - Lecture Notes Posted', time: 'Yesterday', unread: false },
                { sender: 'AkadVerse Support', subject: 'System Maintenance Notice', time: 'Oct 12', unread: false },
              ].map((msg, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${msg.unread ? 'bg-indigo-50/40 hover:bg-indigo-50/80' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600">
                        {msg.sender.charAt(0)}
                      </div>
                      {msg.unread && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div>
                      <p className={`text-sm ${msg.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{msg.sender}</p>
                      <p className={`text-sm truncate max-w-[200px] sm:max-w-[300px] ${msg.unread ? 'font-medium text-slate-800' : 'text-slate-500'}`}>{msg.subject}</p>
                    </div>
                  </div>
                  <span className={`text-xs ${msg.unread ? 'font-semibold text-indigo-600' : 'text-slate-400'}`}>{msg.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Student Essentials — 2×2 grid */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">Student Essentials</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Schedule Manager', desc: 'View and manage your class timetable', icon: Calendar, color: 'text-blue-600 bg-blue-50', route: '/student/schedule' },
                { title: 'Attendance', desc: 'Track your course attendance records', icon: SquareCheck, color: 'text-emerald-600 bg-emerald-50', route: '/student/attendance' },
                { title: 'Email Integration', desc: 'Connect your institutional email', icon: Mail, color: 'text-purple-600 bg-purple-50', route: '/student/email' },
                { title: 'Suggestions', desc: 'Smart academic recommendations', icon: Lightbulb, color: 'text-amber-600 bg-amber-50', route: '/student/suggestions' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -3, boxShadow: '0 8px 24px rgb(0,0,0,0.07)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(item.route)}
                  className="group flex flex-col gap-3 p-5 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/40 hover:bg-white cursor-pointer transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Sidebar Content */}
        <div className="space-y-6">
          
          {/* Section 3: Reminders / Quick Updates */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <SquareCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">Reminders</h3>
            </div>
            
            <div className="space-y-4">
              {[
                { title: 'Submit Lab Report', course: 'Physics II', due: 'Tomorrow 23:59', priority: 'High', color: 'text-red-600 bg-red-50 border-red-100' },
                { title: 'Midterm Registration', course: 'Administration', due: 'Friday 17:00', priority: 'High', color: 'text-red-600 bg-red-50 border-red-100' },
                { title: 'Peer Review Draft', course: 'Literature', due: 'Oct 15, 12:00', priority: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-100' },
                { title: 'Read Chapter 4-5', course: 'Calculus II', due: 'Oct 18', priority: 'Low', color: 'text-blue-600 bg-blue-50 border-blue-100' },
              ].map((rem, idx) => (
                <div key={idx} className="flex gap-3 items-start border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="w-5 h-5 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0 cursor-pointer hover:border-emerald-500 transition-colors"></div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{rem.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{rem.course} • Due {rem.due}</p>
                    <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${rem.color}`}>
                      {rem.priority} Priority
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Quick Links */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/60">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Shortcuts</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Docs', icon: FileText, color: 'text-blue-600 bg-blue-50' },
                { name: 'Forms', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
                { name: 'Learn.', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50' },
                { name: 'Essent.', icon: Briefcase, color: 'text-rose-600 bg-rose-50' },
              ].map((link, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${link.color}`}>
                    <link.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{link.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Section 5: Academic Progress Overview */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[24px] p-6 shadow-md text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <BarChart className="w-24 h-24 -mt-4 -mr-4" />
            </div>
            <h3 className="text-sm font-medium text-slate-300 mb-1">Current GPA</h3>
            <div className="text-3xl font-bold mb-4">3.84 <span className="text-sm font-medium text-emerald-400">↑ 0.12</span></div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Credits Completed</span>
                  <span className="font-semibold">84 / 120</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-700 flex justify-between text-xs">
                <span className="text-slate-400">Active Courses</span>
                <span className="font-semibold">4 Courses</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

export function ELearning() {
  const courses = [
    { title: 'Data Structures', code: 'CSC 301', progress: 65, color: 'bg-indigo-500' },
    { title: 'Calculus II', code: 'MAT 202', progress: 40, color: 'bg-emerald-500' },
    { title: 'World Literature', code: 'ENG 105', progress: 85, color: 'bg-rose-500' }
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Learning Essentials</h1>
        <p className="text-slate-500 mt-2">Manage your active courses, assignments, and study materials.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((course, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 cursor-pointer flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${course.color}`}>
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                {course.code}
              </span>
            </div>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-1">{course.title}</h3>
            <p className="text-slate-500 text-sm mb-6 flex-grow">Recent: Graphs and Trees Assessment</p>
            
            <div className="mt-auto">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Progress</span>
                <span className="font-semibold text-slate-900">{course.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${course.color}`} 
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Recent Modules
          </h3>
          <div className="space-y-3">
            {[
              { title: 'Chapter 4: Derivatives', time: '2 hours ago', icon: Video },
              { title: 'Week 3 Reading Materials', time: 'Yesterday', icon: FileText },
              { title: 'Binary Search Trees Quiz', time: 'Oct 12', icon: SquareCheck }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800">{item.title}</h4>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-indigo-600">
            <Bot className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">AI Study Planner</h3>
          <p className="text-slate-600 text-sm mb-6 max-w-sm">
            Generate a custom study schedule based on your upcoming exams and current progress.
          </p>
          <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm">
            Generate Plan
          </button>
        </div>
      </div>
    </div>
  );
}

const SlowMeshBackground = () => (
  <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-30">
    <motion.div
      animate={{
        x: ['0%', '10%', '-5%', '0%'],
        y: ['0%', '-10%', '5%', '0%'],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[80px]"
    />
    <motion.div
      animate={{
        x: ['0%', '-10%', '10%', '0%'],
        y: ['0%', '5%', '-10%', '0%'],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-400/20 blur-[100px]"
    />
  </div>
);

export function StudentEssentials() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.4, 
        ease: 'easeOut',
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
  };

  const essentials = [
    {
      title: 'Schedule Manager',
      description: 'Manage your classes and daily academic schedule.',
      icon: Calendar,
      color: 'from-blue-500/10 to-indigo-500/10 text-blue-600',
      iconAnimation: { rotate: [-10, 10, -10, 0], transition: { duration: 0.3 } },
      route: '/student/schedule'
    },
    {
      title: 'Attendance',
      description: 'Track your attendance across all courses.',
      icon: SquareCheck,
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600',
      iconAnimation: { scale: [1, 1.25, 1], transition: { duration: 0.25 } },
      route: '/student/attendance'
    },
    {
      title: 'Email Integration',
      description: 'Connect your school email to receive academic updates.',
      icon: Mail,
      color: 'from-purple-500/10 to-fuchsia-500/10 text-purple-600',
      iconAnimation: { y: [-4, 4, -4, 0], scale: [1, 1.1, 1], transition: { duration: 0.3 } },
      route: '/student/email'
    },
    {
      title: 'Suggestions',
      description: 'Receive smart academic tips and recommendations.',
      icon: Lightbulb,
      color: 'from-amber-500/10 to-orange-500/10 text-amber-600',
      iconAnimation: { opacity: [1, 0.6, 1], scale: [1, 1.15, 1], transition: { duration: 0.4 } },
      route: '/student/suggestions'
    }
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 relative py-4"
    >
      <SlowMeshBackground />
      
      <div className="mb-10 relative z-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Essentials</h1>
        <p className="text-slate-500 mt-2 text-lg">Quick tools to manage your academic life.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {essentials.map((item, i) => (
          <motion.div
            key={i}
            variants={cardVariants}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97, transition: { duration: 0.12 } }}
            onClick={() => {
              setTimeout(() => navigate(item.route), 120);
            }}
            className="group relative bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:border-slate-300/80 rounded-[20px] p-8 cursor-pointer transition-all duration-200 overflow-hidden flex flex-col h-full"
          >
            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${item.color.split(' ').slice(0, 2).join(' ')}`} />
            
            <div className="relative z-10 flex flex-col h-full">
              <motion.div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm bg-white border border-slate-100 ${item.color.split(' ')[2]}`}
                whileHover={item.iconAnimation}
              >
                <item.icon className="h-7 w-7" />
              </motion.div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium flex-grow">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function LearningEssentials() {
  const navigate = useNavigate();

  const essentials = [
    {
      title: 'Course Control',
      description: 'Manage enrollments and course settings.',
      icon: Calendar,
      color: 'from-blue-500/10 to-indigo-500/10 text-blue-600',
      route: '/student/e-learning/course-control'
    },
    {
      title: 'My Learning',
      description: 'Access student courses, modules, and assignments.',
      icon: BookOpen,
      color: 'from-fuchsia-500/10 to-purple-500/10 text-fuchsia-600',
      route: '/student/e-learning/my-learning'
    },
    {
      title: 'Academic Records',
      description: 'Transcripts, grades, and historical performance.',
      icon: FileText,
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600',
      route: '/student/e-learning/records'
    },
    {
      title: 'Suggestions',
      description: 'AI-driven learning path recommendations.',
      icon: Lightbulb,
      color: 'from-amber-500/10 to-orange-500/10 text-amber-600',
      route: '/student/e-learning/suggestions'
    }
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Learning Essentials</h1>
        <p className="text-slate-500 mt-2">Manage your academic courses and records.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {essentials.map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={() => navigate(item.route)}
            className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 cursor-pointer group flex flex-col h-full transition-all"
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm mb-4 ${item.color}`}>
              <item.icon className="w-7 h-7 bg-white/50 backdrop-blur-sm rounded-xl p-1" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function LearningResources() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Learning Resources</h1>
        <p className="text-slate-500 mt-2">Library of lecture materials, PDFs, and recorded videos.</p>
      </motion.div>

      <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm max-w-3xl mx-auto mt-12">
        <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-700">Resource Library</h3>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Explore course materials, past lectures, and supplementary reading carefully curated by your professors.
        </p>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  User, Mail, Phone, MapPin, Calendar, Shield, Key, 
  GraduationCap, Briefcase, Award, CheckCircle, Pencil, Camera, Eye, EyeOff,
  BookOpen, Clock, BarChart as BarChartIcon, List, FileText, Users, Monitor, AlertCircle,
  Activity, Settings, ChevronRight, Zap, Target, Server, ShieldCheck, Lock,
  Download, Bell, XCircle, ChevronDown
} from 'lucide-react';

export function Profile() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'settings'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const profileData = {
    name: role === 'student' ? 'Alex Student' : role === 'faculty' ? 'Dr. Sarah Faculty' : 'Dr. Robert Admin',
    email: `${role}@akadverse.edu`,
    phone: '+1 (555) 123-4567',
    location: 'Campus Housing, Room 402',
    department: role === 'faculty' ? 'Computer Science' : role === 'student' ? 'Engineering' : 'Dean of Academic Affairs',
    roleLabel: role === 'student' ? '300 Level Student' : role === 'faculty' ? 'Associate Professor' : 'School Administrator',
    id: role === 'student' ? 'STU-2023-8942' : role === 'faculty' ? 'FAC-2018-1124' : 'ADM-001',
    status: 'Active'
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Cover Image */}
      <div className="h-64 w-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
        <button className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors border border-white/20 shadow-sm">
          <Camera className="w-4 h-4" />
          Change Cover
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative -mt-24 sm:-mt-32 sm:flex sm:items-end sm:space-x-5 pb-8"
        >
          <div className="relative group">
            <div className="h-32 w-32 sm:h-48 sm:w-48 rounded-full ring-4 ring-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-xl relative transition-transform duration-300 group-hover:scale-105">
              <User className="h-16 w-16 sm:h-24 sm:w-24 text-slate-400" />
              {/* Avatar Edit Overlay */}
              <div 
                className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
                onClick={() => setShowEditModal(true)}
              >
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
          
          <div className="mt-6 sm:flex-1 sm:min-w-0 sm:flex sm:items-center sm:justify-end sm:space-x-6 sm:pb-1">
            <div className="sm:hidden 2xl:block mt-6 min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-slate-900 truncate">{profileData.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-slate-400" />
                  {profileData.roleLabel} • {profileData.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {profileData.status}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  {profileData.department}
                </span>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col justify-stretch space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
              <button 
                onClick={() => setShowEditModal(true)}
                className="inline-flex justify-center items-center px-6 py-2.5 border border-slate-200 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white/70 backdrop-blur-xl hover:bg-slate-50 focus:outline-none transition-all hover:-translate-y-0.5"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Profile
              </button>
            </div>
          </div>
        </motion.div>
        
        <div className="hidden sm:block 2xl:hidden mt-6 min-w-0 flex-1 pb-8">
          <h1 className="text-3xl font-bold text-slate-900 truncate">{profileData.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-400" />
              {profileData.roleLabel} • {profileData.id}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
              {profileData.status}
            </span>
            <span className="text-sm font-medium text-slate-500">
              {profileData.department}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-2 relative">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8 relative">
              {['overview', 'activity', 'settings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`
                    whitespace-nowrap py-4 px-1 font-medium text-sm capitalize transition-all relative
                    ${activeTab === tab 
                      ? 'text-slate-900' 
                      : 'text-slate-500 hover:text-slate-700'
                    }
                  `}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"
                      initial={false}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area (3-Zone Layout) */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          
          {/* Left Panel: Summary Card */}
          <div className="lg:col-span-4 space-y-6">
            <AnimatePresence mode="wait">
              {role === 'student' && <StudentSummaryCard key="student-summary" />}
              {role === 'faculty' && <FacultySummaryCard key="faculty-summary" />}
              {role === 'admin' && <AdminSummaryCard key="admin-summary" />}
            </AnimatePresence>
          </div>

          {/* Right Panel: Detailed Sections */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {role === 'student' && <StudentOverview />}
                  {role === 'faculty' && <FacultyOverview />}
                  {role === 'admin' && <AdminOverview />}
                </motion.div>
              )}
              
              {activeTab === 'activity' && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {role === 'student' && <StudentActivity />}
                  {role === 'faculty' && <FacultyActivity />}
                  {role === 'admin' && <AdminActivity />}
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <SharedSettings profileData={profileData} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Simple Edit Modal Overlay (Mock) */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-4">Edit Profile</h2>
              <p className="text-slate-500 text-sm mb-6">Update your personal details and preferences.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" defaultValue={profileData.name} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input type="text" defaultValue={profileData.phone} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// STUDENT COMPONENTS
// ==========================================

function StudentSummaryCard() {
  const [showGPA, setShowGPA] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110 duration-500" />
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
        <Activity className="w-4 h-4 text-indigo-500" /> Snapshot
      </h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cumulative GPA</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900 transition-all duration-200">
                {showGPA ? '3.84' : '••••'}
              </span>
              <button 
                onClick={() => setShowGPA(!showGPA)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                {showGPA ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
            <span className="text-2xl font-bold text-emerald-600">92%</span>
            <span className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Attendance</span>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
            <span className="text-2xl font-bold text-blue-600">24</span>
            <span className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Courses Done</span>
          </div>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3 hover:-translate-y-1 transition-transform">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">4 Pending Tasks</p>
            <p className="text-xs text-amber-700/80">Assignments & Quizzes</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StudentOverview() {
  return (
    <>
      {/* Section A — Academic Overview */}
      <motion.section variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} initial="hidden" animate="visible" className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" /> Academic Overview
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Current Courses</h3>
            {['Software Engineering', 'Database Systems', 'Linear Algebra'].map((course, idx) => (
              <div key={idx} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center hover:shadow-md transition-shadow bg-white">
                <span className="font-semibold text-slate-800 text-sm">{course}</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">A-</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Upcoming Classes</h3>
            {[
              { time: '10:00 AM', name: 'Software Eng. Lab', room: 'Lab 3' },
              { time: '01:00 PM', name: 'Database Systems', room: 'Hall B' }
            ].map((cls, idx) => (
              <div key={idx} className="p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow" style={{ backgroundColor: '#B9BEC3', color: '#1a1f24' }}>
                <div className="flex flex-col items-center justify-center px-3 py-1 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                  <span className="text-sm font-black">{cls.time.split(' ')[0]}</span>
                  <span className="text-[10px] font-bold uppercase">{cls.time.split(' ')[1]}</span>
                </div>
                <div>
                  <p className="font-bold text-sm">{cls.name}</p>
                  <p className="text-xs font-semibold opacity-80">{cls.room}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Section B — Attendance Summary */}
      <motion.section variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" /> Attendance Summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Attendance</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900">92%</span>
              <span className="text-sm font-medium text-emerald-600 mb-1">Excellent</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-4 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: '92%' }} className="bg-emerald-500 h-full rounded-full" />
            </div>
          </div>
          <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Missed Classes</p>
            <span className="text-3xl font-black text-slate-900">3</span>
            <p className="text-sm font-medium text-slate-500 mt-2">Within safe limit</p>
          </div>
          <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chapel Status</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-semibold text-sm border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
              Cleared
            </div>
          </div>
        </div>
      </motion.section>
    </>
  );
}

function StudentActivity() {
  return (
    <>
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" /> Recent Activity
        </h2>
        <div className="space-y-4">
          {[
            { title: 'Submitted Assignment: Linear Algebra', time: '2 hours ago', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
            { title: 'Used AI Studio for Research', time: 'Yesterday', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
            { title: 'Purchased UI Kit from Marketplace', time: '3 days ago', icon: Target, color: 'text-rose-500', bg: 'bg-rose-50' }
          ].map((act, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
              <div className={`p-3 rounded-xl ${act.bg} ${act.color}`}>
                <act.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{act.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{act.time}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          ))}
        </div>
      </motion.section>
      
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Target className="w-5 h-5 text-rose-500" /> Skills & Marketplace
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 border border-slate-100 rounded-2xl bg-white text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-3">
              <Award className="w-6 h-6" />
            </div>
            <p className="text-2xl font-black text-slate-900">4</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Skills Offered</p>
          </div>
          <div className="p-5 border border-slate-100 rounded-2xl bg-white text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 mx-auto bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-3">
              <List className="w-6 h-6" />
            </div>
            <p className="text-2xl font-black text-slate-900">2</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Listings Created</p>
          </div>
          <div className="p-5 border border-slate-100 rounded-2xl bg-white text-center hover:shadow-md transition-shadow">
            <div className="w-12 h-12 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-2xl font-black text-slate-900">7</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Total Purchases</p>
          </div>
        </div>
      </motion.section>
    </>
  );
}

// ==========================================
// FACULTY COMPONENTS
// ==========================================

function FacultySummaryCard() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-3xl p-6 relative overflow-hidden group"
    >
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-slate-600" /> Snapshot
      </h3>
      <div className="space-y-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Courses Teaching</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">4</p>
          </div>
          <BookOpen className="w-8 h-8 text-indigo-100" />
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Students</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">128</p>
          </div>
          <Users className="w-8 h-8 text-blue-100" />
        </div>
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Attendance Compliance</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">100%</p>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-200" />
        </div>
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Pending Grading</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">12 Tasks</p>
          </div>
          <Clock className="w-8 h-8 text-amber-200" />
        </div>
      </div>
    </motion.div>
  );
}

function FacultyOverview() {
  return (
    <>
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" /> Teaching Overview
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Courses Assigned</h3>
            {[
              { id: 'CSC301', name: 'Software Engineering' },
              { id: 'CSC305', name: 'Database Systems' },
              { id: 'CSC402', name: 'Artificial Intelligence' }
            ].map((course, idx) => (
              <div key={idx} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white hover:shadow-md transition-shadow">
                <div>
                  <span className="font-bold text-slate-900 block">{course.id}</span>
                  <span className="text-sm font-medium text-slate-500">{course.name}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Schedule Summary</h3>
            {[
              { time: '10:00 AM', name: 'CSC301 Lecture', type: 'Class' },
              { time: '02:00 PM', name: 'Department Meeting', type: 'Meeting' }
            ].map((event, idx) => (
              <div key={idx} className="p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow" style={{ backgroundColor: '#B9BEC3', color: '#1a1f24' }}>
                <div className="px-3 py-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10 font-black text-sm text-center min-w-[80px]">
                  {event.time}
                </div>
                <div>
                  <p className="font-bold text-sm">{event.name}</p>
                  <p className="text-xs font-semibold opacity-80 uppercase">{event.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" /> Attendance Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 border border-slate-100 rounded-2xl bg-white text-center">
            <p className="text-3xl font-black text-slate-900 mb-1">12</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Classes Handled</p>
          </div>
          <div className="p-5 border border-slate-100 rounded-2xl bg-white text-center">
            <p className="text-3xl font-black text-slate-900 mb-1">12</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Uploads</p>
          </div>
          <div className="p-5 border border-emerald-100 rounded-2xl bg-emerald-50 text-center">
            <p className="text-3xl font-black text-emerald-600 mb-1">100%</p>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Compliance</p>
          </div>
        </div>
      </motion.section>
    </>
  );
}

function FacultyActivity() {
  return (
    <>
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" /> Academic Activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Assignments Created', val: '8' },
            { label: 'Tests Uploaded', val: '3' },
            { label: 'Results Processed', val: '1' }
          ].map((stat, i) => (
            <div key={i} className="p-5 border border-slate-100 rounded-2xl bg-white">
              <span className="block text-2xl font-black text-slate-900 mb-2">{stat.val}</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>
      </motion.section>
      
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-500" /> AI Usage
        </h2>
        <div className="space-y-4">
          <div className="p-4 border border-slate-100 rounded-2xl bg-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">AI Quiz Generator</p>
                <p className="text-xs text-slate-500">Used 5 times this week</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Tool</span>
          </div>
          <div className="p-4 border border-slate-100 rounded-2xl bg-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Generated Syllabus (CSC402)</p>
                <p className="text-xs text-slate-500">Created 2 days ago</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Material</span>
          </div>
        </div>
      </motion.section>
    </>
  );
}

// ==========================================
// ADMIN COMPONENTS
// ==========================================

function AdminSummaryCard() {
  const [stats] = useState({ students: 3850, faculty: 412, courses: 145 });

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-3xl p-6 relative overflow-hidden group"
    >
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
        <Server className="w-4 h-4 text-slate-600" /> Admin Overview
      </h3>
      <div className="space-y-4">
        
        {/* Highlighted Pending Approvals */}
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 shadow-md flex justify-between items-center hover:-translate-y-1 transition-transform relative overflow-hidden group/alert cursor-pointer">
          <div className="absolute inset-0 bg-rose-100/50 opacity-0 group-hover/alert:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Pending Approvals</p>
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-black text-rose-600">24</motion.p>
          </div>
          <AlertCircle className="w-10 h-10 text-rose-200 relative z-10" />
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Students</p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold text-slate-900 mt-1">{stats.students.toLocaleString()}</motion.p>
          </div>
          <Users className="w-8 h-8 text-blue-100" />
        </div>
        
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Faculty</p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold text-slate-900 mt-1">{stats.faculty}</motion.p>
          </div>
          <Briefcase className="w-8 h-8 text-indigo-100" />
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:-translate-y-1 transition-transform">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Courses</p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold text-slate-900 mt-1">{stats.courses}</motion.p>
          </div>
          <BookOpen className="w-8 h-8 text-emerald-100" />
        </div>
      </div>
    </motion.div>
  );
}

function AdminOverview() {
  const attendanceData = [
    { name: 'Mon', value: 95 }, { name: 'Tue', value: 92 }, { name: 'Wed', value: 88 },
    { name: 'Thu', value: 94 }, { name: 'Fri', value: 85 }
  ];
  
  const deptData = [
    { name: 'ENG', gpa: 3.4 }, { name: 'CSC', gpa: 3.6 }, { name: 'BUS', gpa: 3.2 }, { name: 'ART', gpa: 3.5 }
  ];

  return (
    <>
      {/* Section A — Academic Overview */}
      <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <BarChartIcon className="w-5 h-5 text-indigo-500" /> Academic Overview
        </h2>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 border border-slate-100 rounded-2xl bg-white flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Average GPA</span>
            <span className="text-3xl font-black text-indigo-600">3.42</span>
          </div>
          <div className="p-4 border border-slate-100 rounded-2xl bg-white flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Courses Running</span>
            <span className="text-3xl font-black text-blue-600">145</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Attendance Trends */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Attendance Trends (This Week)</h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Department Performance */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Department Performance (GPA)</h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="gpa" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section B & C — Management Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-500" /> Student Management
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Students at Academic Risk', count: 42, critical: true },
              { label: 'Low Attendance (< 75%)', count: 86, critical: false },
              { label: 'Pending Fee Clearances', count: 124, critical: false }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-white hover:border-slate-200 cursor-pointer transition-colors group">
                <span className={`text-sm font-medium ${item.critical ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${item.critical ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                    {item.count}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Faculty Management
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Missing Attendance Uploads', count: 12, critical: true },
              { label: 'Pending Grading Submissions', count: 28, critical: false },
              { label: 'Overall Attendance Compliance', text: '94%', critical: false }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-white hover:border-slate-200 cursor-pointer transition-colors group">
                <span className={`text-sm font-medium ${item.critical ? 'text-amber-600 font-bold' : 'text-slate-700'}`}>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${item.critical ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                    {item.count || item.text}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </>
  );
}

function AdminActivity() {
  return (
    <>
      {/* Section D — Approvals & Actions (Highlight) */}
      <motion.section className="bg-white/80 backdrop-blur-xl border border-rose-200/60 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-bl-full -z-10 opacity-50" />
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-rose-600" /> Pending Approvals & Actions
        </h2>
        
        <div className="space-y-4">
          {[
            { type: 'Course Request', title: 'CSC 405 - Advanced ML', user: 'Dr. Sarah Faculty', date: '2 hours ago' },
            { type: 'Override Request', title: 'Capacity Override: ENG 201', user: 'Prof. James Smith', date: '5 hours ago' },
            { type: 'Event Approval', title: 'Hackathon 2024 Auditorium Use', user: 'CS Student Society', date: 'Yesterday' }
          ].map((req, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 border border-rose-100 bg-white/80 backdrop-blur-sm rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{req.type}</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">{req.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Requested by {req.user} • {req.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-10 sm:ml-0">
                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors focus:ring-2 focus:ring-slate-200 flex-1 sm:flex-none text-center">
                  Reject
                </button>
                <button className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-sm focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 flex-1 sm:flex-none text-center relative overflow-hidden group/btn">
                  <span className="relative z-10">Approve</span>
                  <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform rounded-xl" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section E & F — Reports & Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reports */}
        <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-500" /> Reports & Insights
          </h2>
          <div className="space-y-3">
            {[
              { name: 'End of Semester Summary', desc: 'Grades, attendance, overview' },
              { name: 'Faculty Performance Matrix', desc: 'Reviews, compliance stats' },
              { name: 'At-Risk Students List', desc: 'Filtered by department' }
            ].map((report, i) => (
              <button key={i} className="w-full flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all text-left group">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{report.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{report.desc}</p>
                </div>
                <div className="p-2 bg-white rounded-lg text-indigo-500 group-hover:bg-indigo-50 transition-colors">
                  <Download className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Announcements */}
        <motion.section className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col">
          <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" /> Announcements
          </h2>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-4">
              <textarea 
                className="w-full h-full bg-transparent resize-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                placeholder="Draft a new announcement for students or faculty..."
              />
            </div>
            <div className="flex items-center justify-between">
              <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1">
                Target: All Users <ChevronDown className="w-3 h-3" />
              </button>
              <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
                Post Update
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </>
  );
}

// ==========================================
// SHARED SETTINGS
// ==========================================

function SharedSettings({ profileData }: { profileData: any }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm max-w-3xl">
      <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
        <Settings className="w-6 h-6 text-slate-400" /> Account Settings
      </h2>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Notifications</h3>
          <div className="space-y-4">
            {['Email Alerts', 'SMS Notifications', 'Push Notifications'].map((setting, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{setting}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Receive updates via {setting.split(' ')[0].toLowerCase()}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={idx !== 1} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Security</h3>
          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-colors font-medium text-sm text-slate-700 flex justify-between items-center">
              Change Password
              <span className="text-xs bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-bold">Last changed 3 mos ago</span>
            </button>
            <button className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-colors font-medium text-sm text-slate-700 flex justify-between items-center">
              Two-Factor Authentication (2FA)
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">Enabled</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
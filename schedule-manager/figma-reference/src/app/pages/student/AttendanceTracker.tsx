import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, TriangleAlert, CircleX, Info, Calendar, TrendingUp, Clock, BookOpen, Church, ClipboardCheck, Flame, ChevronLeft, ChevronRight } from 'lucide-react';

const COURSES = [
  { code: 'CSC 211', title: 'Data Structures', held: 18, attended: 16, missed: 2, percentage: 89 },
  { code: 'MTH 213', title: 'Engineering Mathematics', held: 20, attended: 15, missed: 5, percentage: 75 },
  { code: 'GST 211', title: 'Nigerian Peoples and Culture', held: 12, attended: 12, missed: 0, percentage: 100 },
  { code: 'EEE 212', title: 'Circuit Theory', held: 15, attended: 10, missed: 5, percentage: 66 },
  { code: 'CSC 214', title: 'Computer Architecture', held: 16, attended: 15, missed: 1, percentage: 93 },
];

const RECENT_ACTIVITY = [
  { id: 1, date: 'Mar 10', course: 'CSC 211 Data Structures', status: 'Present', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { id: 2, date: 'Mar 9', course: 'MTH 213 Engineering Mathematics', status: 'Present', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { id: 3, date: 'Mar 7', course: 'EEE 212 Circuit Theory', status: 'Absent', color: 'bg-red-100 text-red-700', icon: CircleX },
  { id: 4, date: 'Mar 6', course: 'GST 211 Nigerian Peoples & Culture', status: 'Present', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { id: 5, date: 'Mar 5', course: 'EEE 212 Circuit Theory', status: 'Late', color: 'bg-amber-100 text-amber-700', icon: Clock },
];

const INSIGHTS = [
  "You have missed 3 classes this month.",
  "Your highest attendance is in Computer Architecture (93%).",
  "Attend the next 2 classes in Circuit Theory to stay above 75%."
];

// CountUp Component for animating numbers
function CountUp({ end, duration = 1 }: { end: number, duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / (duration * 1000), 1);
      
      const easeOut = 1 - Math.pow(1 - percentage, 3);
      setCount(Math.floor(end * easeOut));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <>{count}</>;
}

function StudentAffairsAttendance() {
  const [selectedCategory, setSelectedCategory] = useState<'chapel' | 'rollcall' | 'youthalive'>('chapel');
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const getStatus = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dayOfWeek = date.getDay(); 
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();

    if (selectedCategory === 'chapel') {
      // CoE -> Tuesday (2)
      if (dayOfWeek === 2) {
        if (!isPast && !isToday) return 'upcoming'; 
        const seed = currentYear * 10000 + currentMonth * 100 + day;
        const attended = (seed % 10) > 2; 
        return attended ? 'attended' : 'missed';
      }
      return 'none'; 
    }
    
    if (selectedCategory === 'rollcall') {
      if (!isPast && !isToday) return 'upcoming';
      const seed = currentYear * 10000 + currentMonth * 100 + day;
      const attended = (seed % 10) > 1; 
      return attended ? 'attended' : 'missed';
    }
    
    if (selectedCategory === 'youthalive') {
      // Fridays (5)
      if (dayOfWeek === 5) {
        if (!isPast && !isToday) return 'upcoming';
        const seed = currentYear * 10000 + currentMonth * 100 + day;
        const attended = (seed % 10) > 3; 
        return attended ? 'attended' : 'missed';
      }
      return 'none';
    }
    
    return 'none';
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); 

  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));

  const categoryDetails = {
    chapel: { name: 'Chapel Service', desc: 'Track your weekly chapel attendance' },
    rollcall: { name: 'Roll Call', desc: 'Track your daily roll call attendance' },
    youthalive: { name: 'Youth Alive', desc: 'Track your Youth Alive attendance' }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { id: 'chapel', title: 'Chapel Service', desc: 'Track your weekly chapel attendance', icon: Church, color: 'text-indigo-600', bg: 'bg-indigo-50', activeBg: 'bg-indigo-600', activeText: 'text-white' },
          { id: 'rollcall', title: 'Roll Call', desc: 'Track your daily roll call attendance', icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600', activeText: 'text-white' },
          { id: 'youthalive', title: 'Youth Alive', desc: 'Track your Youth Alive attendance', icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-600', activeText: 'text-white' }
        ].map(cat => (
          <motion.div
            key={cat.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`p-5 rounded-2xl cursor-pointer transition-all border ${selectedCategory === cat.id ? `${cat.activeBg} ${cat.activeText} border-transparent shadow-md` : 'bg-white text-slate-800 border-slate-200/60 hover:border-slate-300'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${selectedCategory === cat.id ? 'bg-white/20' : `${cat.bg} ${cat.color}`}`}>
              <cat.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-1">{cat.title}</h3>
            <p className={`text-sm ${selectedCategory === cat.id ? 'text-white/80' : 'text-slate-500'}`}>{cat.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 sm:p-8 border border-white/40 shadow-sm relative z-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-xl font-bold text-slate-800">{categoryDetails[selectedCategory].name} Calendar</h2>
          <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-full border border-slate-100">
            <button onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-bold text-slate-800 min-w-[140px] text-center">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 mb-8 px-2">
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div><span className="text-sm font-semibold text-slate-600">Attended</span></div>
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></div><span className="text-sm font-semibold text-slate-600">Missed</span></div>
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-slate-100 border border-slate-200"></div><span className="text-sm font-semibold text-slate-600">No Event</span></div>
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#B9BEC3] shadow-sm shadow-[#B9BEC3]/40"></div><span className="text-sm font-semibold text-slate-600">Upcoming</span></div>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase py-2 tracking-wider">{day}</div>
          ))}
          
          {blanks.map(b => (
            <div key={`blank-${b}`} className="aspect-square p-1 sm:p-2" />
          ))}

          {days.map(day => {
            const status = getStatus(day);
            let bgClass = '';
            let textClass = '';
            let statusText = '';
            
            switch (status) {
              case 'attended':
                bgClass = 'bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-200';
                textClass = 'text-white';
                statusText = 'Attended';
                break;
              case 'missed':
                bgClass = 'bg-rose-500 hover:bg-rose-600 shadow-sm shadow-rose-200';
                textClass = 'text-white';
                statusText = 'Missed';
                break;
              case 'upcoming':
                bgClass = 'bg-[#B9BEC3] hover:brightness-95 shadow-sm shadow-[#B9BEC3]/40 transition-all';
                textClass = 'text-white';
                statusText = 'Upcoming';
                break;
              case 'none':
              default:
                bgClass = 'bg-slate-50/50 border border-slate-100/50 text-slate-400';
                textClass = 'text-slate-400';
                statusText = 'No Event Scheduled';
                break;
            }

            return (
              <div key={day} className="aspect-square relative group">
                <div className={`w-full h-full rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-200 cursor-default ${bgClass} ${textClass}`}>
                  {day}
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-200 pointer-events-none z-50 w-max bg-slate-900 text-white text-xs p-3.5 rounded-xl shadow-xl">
                  <p className="font-bold mb-1.5 text-slate-200 text-sm">{monthNames[currentMonth]} {day}, {currentYear}</p>
                  <p className="font-semibold text-slate-400">{categoryDetails[selectedCategory].name}</p>
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-700">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-bold ${status === 'attended' ? 'text-emerald-400' : status === 'missed' ? 'text-rose-400' : status === 'upcoming' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {statusText}
                    </span>
                  </div>
                  {/* Triangle pointer */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AttendanceTracker() {
  const [activeTab, setActiveTab] = useState<'class' | 'affairs'>('class');
  
  const overallAttendance = 86;
  const totalAttended = 68;
  const totalMissed = 13;

  const pageVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3, ease: "easeOut", staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <motion.div 
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-6 pb-12"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Attendance Portal</h1>
        <p className="text-slate-500 font-medium">Monitor your academic and student affairs attendance</p>
      </div>

      {/* Top Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setActiveTab('class')}
          className={`p-6 rounded-[24px] cursor-pointer border transition-all ${activeTab === 'class' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white/80 backdrop-blur-xl text-slate-800 border-white/60 hover:border-blue-300 shadow-sm'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'class' ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Class Attendance</h3>
              <p className={`text-sm mt-1 font-medium ${activeTab === 'class' ? 'text-blue-100' : 'text-slate-500'}`}>Track course requirements</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setActiveTab('affairs')}
          className={`p-6 rounded-[24px] cursor-pointer border transition-all ${activeTab === 'affairs' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white/80 backdrop-blur-xl text-slate-800 border-white/60 hover:border-indigo-300 shadow-sm'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'affairs' ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
              <Church className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Student Affairs</h3>
              <p className={`text-sm mt-1 font-medium ${activeTab === 'affairs' ? 'text-indigo-100' : 'text-slate-500'}`}>Chapel & Roll Call tracking</p>
            </div>
          </div>
        </motion.div>
      </div>

      {activeTab === 'affairs' ? (
        <StudentAffairsAttendance />
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Warning Alert (if any course is below 75%) */}
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm overflow-hidden"
            >
              <TriangleAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-800 font-bold text-sm">Critical Attendance Warning</h4>
                <p className="text-red-700 text-sm mt-1 font-medium">Your attendance in <strong>EEE 212 – Circuit Theory</strong> is below the required 75% threshold. Please attend upcoming classes to avoid examination ineligibility.</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Overview & Activity */}
            <div className="lg:col-span-1 space-y-6">
              {/* Overview Card */}
              <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 border border-white/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Calendar className="w-24 h-24 text-blue-600" />
                </div>
                
                <h2 className="text-lg font-bold text-slate-800 mb-6">Overview</h2>
                
                <div className="flex items-end gap-2 mb-8">
                  <span className="text-6xl font-bold text-blue-600 tracking-tight">
                    <CountUp end={overallAttendance} duration={0.8} />%
                  </span>
                  <span className="text-sm font-medium text-slate-500 mb-2">Overall</span>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-600 font-semibold">Classes Attended</span>
                    <span className="font-bold text-slate-900 text-lg">{totalAttended}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-600 font-semibold">Classes Missed</span>
                    <span className="font-bold text-slate-900 text-lg">{totalMissed}</span>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Good Standing</p>
                    <p className="text-xs text-emerald-700 font-medium mt-1">Students must maintain at least 75% attendance to remain eligible for examinations.</p>
                  </div>
                </div>
              </motion.div>

              {/* Insights Card */}
              <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 border border-white/40 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Smart Insights
                </h2>
                <div className="space-y-3">
                  {INSIGHTS.map((insight, idx) => (
                    <div key={idx} className="flex gap-3 items-start p-3 bg-blue-50/50 rounded-xl">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-sm font-medium text-slate-700">{insight}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right Column - Table & Recent */}
            <div className="lg:col-span-2 space-y-6">
              {/* Course Attendance Table */}
              <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 border border-white/40 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-6">Course Attendance</h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-sm font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-4 pl-2">Course</th>
                        <th className="pb-4 text-center">Held</th>
                        <th className="pb-4 text-center">Attended</th>
                        <th className="pb-4 text-center">Missed</th>
                        <th className="pb-4 pr-2 w-1/3 text-right">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {COURSES.map((course, idx) => (
                        <motion.tr 
                          key={course.code}
                          whileHover={{ y: -2, backgroundColor: 'rgba(248, 250, 252, 0.8)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                          className="border-b border-slate-100 last:border-0 transition-all rounded-xl relative group cursor-default"
                        >
                          <td className="py-4 pl-2 rounded-l-xl">
                            <p className="font-bold text-slate-800">{course.code}</p>
                            <p className="text-xs font-medium text-slate-500 truncate max-w-[180px]">{course.title}</p>
                          </td>
                          <td className="py-4 text-center font-bold text-slate-600">{course.held}</td>
                          <td className="py-4 text-center font-bold text-emerald-600">{course.attended}</td>
                          <td className="py-4 text-center font-bold text-red-500">{course.missed}</td>
                          <td className="py-4 pr-2 rounded-r-xl">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-full max-w-[120px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${course.percentage}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 + (idx * 0.1), ease: "easeOut" }}
                                  className={`h-full rounded-full ${course.percentage >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                />
                              </div>
                              <span className={`font-bold w-12 text-right ${course.percentage >= 75 ? 'text-slate-700' : 'text-red-600'}`}>
                                {course.percentage}%
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Recent Activity */}
              <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 border border-white/40 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-6">Recent Activity</h2>
                
                <div className="space-y-3">
                  {RECENT_ACTIVITY.map((activity, idx) => (
                    <motion.div 
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (idx * 0.1), duration: 0.3 }}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center flex-col shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{activity.date.split(' ')[0]}</span>
                          <span className="text-sm font-bold text-slate-800">{activity.date.split(' ')[1]}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{activity.course}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">Recorded by Faculty</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${activity.color}`}>
                        <activity.icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">{activity.status}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
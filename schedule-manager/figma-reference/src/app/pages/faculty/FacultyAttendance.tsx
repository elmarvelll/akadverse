import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, TriangleAlert, CheckCircle, CircleX, Clock, CloudUpload, Camera, FileText, Briefcase, Church, Flame, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';

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

function FacultyMyAttendance() {
  const [selectedCategory, setSelectedCategory] = useState<'chapel' | 'fellowship' | 'work'>('chapel');
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
      // CoE/CLDS -> Tuesday (2), CMSS/CST -> Thursday (4). Let's assume CoE logic (Tuesday) for demonstration.
      if (dayOfWeek === 2) {
        if (!isPast && !isToday) return 'upcoming'; 
        const seed = currentYear * 10000 + currentMonth * 100 + day;
        const attended = (seed % 10) > 2; 
        return attended ? 'attended' : 'missed';
      }
      return 'none'; 
    }
    
    if (selectedCategory === 'fellowship') {
      // Fridays (5)
      if (dayOfWeek === 5) {
        if (!isPast && !isToday) return 'upcoming';
        const seed = currentYear * 10000 + currentMonth * 100 + day;
        const attended = (seed % 10) > 1; 
        return attended ? 'attended' : 'missed';
      }
      return 'none';
    }

    if (selectedCategory === 'work') {
      // Weekdays (Mon-Fri)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (!isPast && !isToday) return 'upcoming';
        const seed = currentYear * 10000 + currentMonth * 100 + day;
        const attended = (seed % 10) > 0; // Very high attendance rate for work
        return attended ? 'attended' : 'missed';
      }
      // Weekends are greyed out
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
    fellowship: { name: 'Fellowship', desc: 'Track your Friday fellowship attendance' },
    work: { name: 'Work Attendance', desc: 'Track your daily work presence' }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { id: 'chapel', title: 'Chapel Service', desc: 'Track your weekly chapel attendance', icon: Church, color: 'text-indigo-600', bg: 'bg-indigo-50', activeBg: 'bg-indigo-600', activeText: 'text-white' },
          { id: 'fellowship', title: 'Fellowship', desc: 'Track your Friday fellowship attendance', icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-600', activeText: 'text-white' },
          { id: 'work', title: 'Work Attendance', desc: 'Track your daily work presence', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600', activeText: 'text-white' }
        ].map(cat => (
          <motion.div
            key={cat.id}
            whileHover={{ y: -6, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`p-6 rounded-[20px] cursor-pointer transition-all border ${selectedCategory === cat.id ? `${cat.activeBg} ${cat.activeText} border-transparent shadow-lg` : 'bg-white text-slate-800 border-slate-200/60 hover:border-slate-300 shadow-sm'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${selectedCategory === cat.id ? 'bg-white/20' : `${cat.bg} ${cat.color}`}`}>
              <cat.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-1">{cat.title}</h3>
            <p className={`text-sm ${selectedCategory === cat.id ? 'text-white/80' : 'text-slate-500'}`}>{cat.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-slate-200/60 shadow-sm relative z-0">
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
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div><span className="text-sm font-semibold text-slate-600">Present / Attended</span></div>
          <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></div><span className="text-sm font-semibold text-slate-600">Absent / Missed</span></div>
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
                statusText = selectedCategory === 'work' ? 'Present' : 'Attended';
                break;
              case 'missed':
                bgClass = 'bg-rose-500 hover:bg-rose-600 shadow-sm shadow-rose-200';
                textClass = 'text-white';
                statusText = selectedCategory === 'work' ? 'Absent' : 'Missed';
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
                statusText = selectedCategory === 'work' ? 'Weekend / Holiday' : 'No Event Scheduled';
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

export function FacultyAttendance() {
  const [activeTab, setActiveTab] = useState<'my-attendance' | 'upload'>('my-attendance');
  const [selectedCourse, setSelectedCourse] = useState('CSC 211 – Data Structures');

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Hub</h1>
        <p className="text-slate-500 mt-2 font-medium">Manage your personal attendance obligations and upload class records.</p>
      </div>

      {/* Top Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setActiveTab('my-attendance')}
          className={`p-6 rounded-[24px] cursor-pointer border transition-all ${activeTab === 'my-attendance' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-800 border-slate-200/60 hover:border-indigo-300 shadow-sm'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'my-attendance' ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-xl">My Attendance</h3>
              <p className={`text-sm mt-1 font-medium ${activeTab === 'my-attendance' ? 'text-indigo-100' : 'text-slate-500'}`}>Track your work & affairs obligations</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setActiveTab('upload')}
          className={`p-6 rounded-[24px] cursor-pointer border transition-all ${activeTab === 'upload' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200' : 'bg-white text-slate-800 border-slate-200/60 hover:border-emerald-300 shadow-sm'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'upload' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600'}`}>
              <CloudUpload className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Upload Attendance</h3>
              <p className={`text-sm mt-1 font-medium ${activeTab === 'upload' ? 'text-emerald-100' : 'text-slate-500'}`}>Submit student class attendance</p>
            </div>
          </div>
        </motion.div>
      </div>

      {activeTab === 'my-attendance' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FacultyMyAttendance />
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Select Class Session</label>
              <select 
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-lg rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-full md:w-80"
              >
                <option>CSC 211 – Data Structures</option>
                <option>EEE 214 – Circuit Analysis</option>
              </select>
              <p className="text-sm text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Class Size: 82 students
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-w-[100px]">
                <span className="text-2xl font-bold">14</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Classes Held</span>
              </div>
              <div className="bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-w-[100px]">
                <span className="text-2xl font-bold">90%</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Rate</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
            <TriangleAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">Pending Uploads</h4>
              <p className="text-sm text-amber-700 mt-1 font-medium">You have 2 recent classes without recorded attendance. Please upload the records.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button 
              whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-left flex flex-col items-center justify-center text-center gap-4 group h-64"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Photo Capture</h3>
                <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">Take a clear photo of your physical attendance sheet. Our system will automatically read and record the entries.</p>
              </div>
            </motion.button>

            <motion.button 
              whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left flex flex-col items-center justify-center text-center gap-4 group h-64"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Upload File</h3>
                <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">Upload a digital attendance file. Supported formats include Excel, CSV, and PDF documents.</p>
              </div>
            </motion.button>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
            <p className="text-sm text-slate-500 font-medium">Faculty are no longer required to manually mark student attendance individually. Please use the automated capture methods above.</p>
          </div>
        </div>
      )}
    </div>
  );
}
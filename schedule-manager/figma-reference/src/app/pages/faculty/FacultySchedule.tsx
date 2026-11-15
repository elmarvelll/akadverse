import { motion } from 'motion/react';
import { Plus, MapPin, Clock, MoreVertical, Pencil, Trash2 } from 'lucide-react';

export function FacultySchedule() {
  const schedule = [
    { code: 'CSC 211', title: 'Data Structures', day: 'Monday', time: '09:00 – 10:30', room: 'Engineering Hall 302', type: 'Lecture' },
    { code: 'EEE 214', title: 'Circuit Analysis', day: 'Wednesday', time: '13:00 – 14:30', room: 'Room 204', type: 'Lab' },
    { code: 'CSC 211', title: 'Data Structures', day: 'Thursday', time: '10:00 – 11:30', room: 'Engineering Hall 302', type: 'Tutorial' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Schedule Manager</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your weekly teaching schedule and upcoming lectures.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
          <Plus className="w-5 h-5" />
          Add Session
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-800">This Week's Schedule</h2>
          <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option>Current Week</option>
            <option>Next Week</option>
          </select>
        </div>

        <div className="space-y-4">
          {schedule.map((session, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-5">
                <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 font-bold shrink-0">
                  <span className="text-xs uppercase tracking-wider">{session.day.substring(0, 3)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">{session.code}</span>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">{session.type}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{session.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {session.day}, {session.time}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {session.room}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
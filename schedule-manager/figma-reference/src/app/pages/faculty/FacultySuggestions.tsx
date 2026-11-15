import { motion } from 'motion/react';
import { Lightbulb, TrendingDown, Users, BookOpen, CircleAlert, ArrowRight } from 'lucide-react';

export function FacultySuggestions() {
  const insights = [
    {
      category: 'Academic Performance',
      icon: TrendingDown,
      color: 'bg-rose-50 text-rose-600',
      title: 'Action Required: CSC 211 Quiz Results',
      description: '6 students in CSC 211 scored below 50% in the last quiz on Binary Trees.',
      recommendation: 'Consider scheduling a brief revision session or providing supplemental reading materials on Tree Traversal.',
      actionText: 'Message Students'
    },
    {
      category: 'Attendance Trends',
      icon: Users,
      color: 'bg-amber-50 text-amber-600',
      title: 'Attendance Drop Notice',
      description: 'Average attendance for EEE 214 dropped by 8% this week.',
      recommendation: 'Send a reminder announcement about the 75% mandatory attendance policy before the midterm.',
      actionText: 'View Attendance Record'
    },
    {
      category: 'Curriculum Optimization',
      icon: BookOpen,
      color: 'bg-indigo-50 text-indigo-600',
      title: 'Suggested Revision Topic',
      description: 'Based on recent assignment submissions, many students are struggling with "Dynamic Programming".',
      recommendation: 'Allocate 20 minutes in your next lecture to review the core concepts of memoization and tabulaton.',
      actionText: 'Add to Lesson Plan'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
          <Lightbulb className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Suggestions</h1>
          <p className="text-slate-500 mt-1 font-medium">Intelligent insights to improve teaching effectiveness and student success.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mt-8">
        {insights.map((insight, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            {/* Background decoration */}
            <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 pointer-events-none ${insight.color.split(' ')[0]}`} />
            
            <div className="flex flex-col md:flex-row gap-6 relative z-10">
              <div className="flex-shrink-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${insight.color}`}>
                  <insight.icon className="w-7 h-7" />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{insight.category}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{insight.title}</h3>
                <p className="text-slate-600 text-base mb-4 leading-relaxed">{insight.description}</p>
                
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-3 mb-6">
                  <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-1">AI Recommendation</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{insight.recommendation}</p>
                  </div>
                </div>
                
                <button className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors -ml-4">
                  {insight.actionText} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
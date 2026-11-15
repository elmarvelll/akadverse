import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Calendar, UserCheck, Mail, Lightbulb } from 'lucide-react';

const ToolCard = ({ title, description, icon: Icon, onClick, color, delay = 0 }: any) => (
  <motion.div
    whileHover={{ y: -8, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
    whileTap={{ scale: 0.96 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      duration: 0.2, 
      delay, 
      ease: 'easeOut',
      whileHover: { duration: 0.2 },
      whileTap: { duration: 0.12 }
    }}
    onClick={onClick}
    className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl p-8 cursor-pointer transition-all duration-200 flex flex-col items-start h-full group"
  >
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${color} group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="h-8 w-8" />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-3">{title}</h3>
    <p className="text-slate-500 leading-relaxed text-sm font-medium">{description}</p>
  </motion.div>
);

export function FacultyEssentials() {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'Schedule Manager',
      description: 'Manage your weekly teaching schedule, upcoming lectures, and extra classes.',
      icon: Calendar,
      path: '/faculty/schedule',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Attendance',
      description: 'Record and manage student attendance, view summaries, and get alerts.',
      icon: UserCheck,
      path: '/faculty/attendance',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Email Integration',
      description: 'Communicate with your students, entire courses, and departments.',
      icon: Mail,
      path: '/faculty/email',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Suggestions',
      description: 'Receive AI-powered insights to identify issues and improve teaching effectiveness.',
      icon: Lightbulb,
      path: '/faculty/suggestions',
      color: 'bg-amber-50 text-amber-600',
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Faculty Essentials</h1>
        <p className="text-slate-500 mt-3 text-lg font-medium max-w-2xl">
          Your teaching productivity hub. Manage schedules, record attendance, communicate with students, and receive AI-driven insights.
        </p>
      </motion.div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tools.map((tool, i) => (
          <ToolCard 
            key={i}
            title={tool.title}
            description={tool.description}
            icon={tool.icon}
            onClick={() => navigate(tool.path)}
            color={tool.color}
            delay={i * 0.1}
          />
        ))}
      </div>
    </div>
  );
}
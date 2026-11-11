import { motion } from 'motion/react';
import { Store, Bot } from 'lucide-react';

export function ComingSoon({ title, type = 'marketplace' }: { title: string, type?: 'marketplace' | 'ai' }) {
  const isAI = type === 'ai';
  const Icon = isAI ? Bot : Store;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <div className="relative mb-8">
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`w-32 h-32 rounded-3xl ${isAI ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-500'} flex items-center justify-center shadow-lg relative z-10`}
        >
          <Icon className="w-16 h-16" />
        </motion.div>
        
        {/* Animated Pet/Companion Elements */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className={`absolute -top-4 -right-4 w-8 h-8 rounded-full ${isAI ? 'bg-purple-300' : 'bg-yellow-300'} blur-md`}
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute -bottom-6 -left-6 w-12 h-12 rounded-full ${isAI ? 'bg-blue-300' : 'bg-orange-200'} blur-lg`}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
          {title} is <span className={isAI ? 'text-indigo-600' : 'text-orange-500'}>Coming Soon</span>
        </h1>
        <p className="text-slate-500 max-w-md mx-auto text-lg leading-relaxed">
          We're training our digital pets and building the infrastructure. 
          This feature will be available in the next major update!
        </p>
      </motion.div>
    </motion.div>
  );
}
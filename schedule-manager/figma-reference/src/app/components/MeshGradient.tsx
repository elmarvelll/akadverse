import { motion } from 'motion/react';

export const MeshGradient = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#fafafa]">
      {/* Animated Gradient Blobs */}
      <motion.div
        animate={{
          x: ['0%', '20%', '-10%', '0%'],
          y: ['0%', '-20%', '10%', '0%'],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
        style={{ backgroundColor: '#7B6CFF' }}
      />
      
      <motion.div
        animate={{
          x: ['0%', '-20%', '20%', '0%'],
          y: ['0%', '10%', '-20%', '0%'],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full mix-blend-multiply filter blur-[100px] opacity-60"
        style={{ backgroundColor: '#A48CFF' }}
      />

      <motion.div
        animate={{
          x: ['0%', '15%', '-15%', '0%'],
          y: ['0%', '20%', '-10%', '0%'],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-[-10%] left-[10%] w-[60%] h-[60%] rounded-full mix-blend-multiply filter blur-[100px] opacity-60"
        style={{ backgroundColor: '#BFD3FF' }}
      />

      <motion.div
        animate={{
          x: ['0%', '-10%', '15%', '0%'],
          y: ['0%', '-15%', '10%', '0%'],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 19,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
        style={{ backgroundColor: '#F2D8A7' }}
      />

      {/* Floating Center Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-sm border border-white/50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-[#4F7BFF]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
};

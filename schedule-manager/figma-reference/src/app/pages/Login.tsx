import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { KeyRound, Mail, CircleAlert } from 'lucide-react';
import { MeshGradient } from '../components/MeshGradient';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (email === 'student' && password === 'student') {
      login('student');
      navigate('/student');
    } else if (email === 'faculty' && password === 'faculty') {
      login('faculty');
      navigate('/faculty');
    } else if (email === 'admin' && password === 'admin') {
      login('admin');
      navigate('/admin');
    } else {
      setError('Invalid credentials. Use student/student, faculty/faculty, or admin/admin.');
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-[#0B0B0B] text-white overflow-hidden">
      
      {/* Left Panel - Sign In Form */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 lg:p-12 z-10 relative"
      >
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Welcome to AkadVerse</h1>
            <p className="text-zinc-400 text-sm">Sign in to access your academic workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="group">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#6AA8FF] transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#4F7BFF] focus:ring-1 focus:ring-[#4F7BFF] transition-all shadow-sm focus:shadow-[0_0_15px_rgba(79,123,255,0.15)]"
                    placeholder="Email"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="group">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#6AA8FF] transition-colors">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#4F7BFF] focus:ring-1 focus:ring-[#4F7BFF] transition-all shadow-sm focus:shadow-[0_0_15px_rgba(79,123,255,0.15)]"
                    placeholder="Password"
                  />
                </div>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl">
                <CircleAlert className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full flex justify-center py-3.5 px-4 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#4F7BFF] to-[#6AA8FF] shadow-[0_4px_14px_rgba(79,123,255,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0B0B] focus:ring-[#6AA8FF] transition-all"
            >
              Sign In
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/signup" className="text-zinc-400 text-sm hover:text-white transition-colors">
              Don't have an account? <span className="text-[#6AA8FF] font-medium hover:underline">Sign up</span>
            </Link>
          </div>

          <div className="mt-12 p-4 bg-[#141414] rounded-2xl border border-[#222]">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Demo Access</h3>
            <div className="space-y-2 text-sm text-zinc-500">
              <div className="flex justify-between">
                <span>Student</span>
                <span className="font-mono text-zinc-400">student : student</span>
              </div>
              <div className="flex justify-between">
                <span>Faculty</span>
                <span className="font-mono text-zinc-400">faculty : faculty</span>
              </div>
              <div className="flex justify-between">
                <span>Admin</span>
                <span className="font-mono text-zinc-400">admin : admin</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Animated Mesh Gradient */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="hidden lg:block lg:w-[60%] relative h-screen rounded-l-[2rem] overflow-hidden shadow-2xl z-20 bg-white"
      >
        <MeshGradient />
      </motion.div>
      
    </div>
  );
}

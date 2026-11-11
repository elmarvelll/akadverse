import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Briefcase, Shield, ChevronLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { MeshGradient } from '../components/MeshGradient';
import { useAuth } from '../context/AuthContext';

type Role = 'student' | 'faculty' | 'admin' | null;

export function Signup() {
  const [role, setRole] = useState<Role>(null);
  const [step, setStep] = useState(0); // 0 = role selection, 1+ = specific flow steps
  const navigate = useNavigate();
  const { login } = useAuth();

  // Form Data
  const [formData, setFormData] = useState({
    // Shared
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    
    // Student
    matricNumber: '',
    registrationNumber: '',
    program: '',
    yearOfStudy: '',

    // Faculty
    staffId: '',
    department: '',
    position: '',

    // Admin
    adminRole: '',
    adminId: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => {
    if (step === 1) {
      setRole(null);
      setStep(0);
    } else {
      setStep(s => s - 1);
    }
  };

  const handleSignup = () => {
    // In a real app, API call goes here
    if (role) {
      login(role);
      navigate(`/${role}`);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3, ease: 'easeInOut' } }
  };

  // Renders the progress indicator
  const renderProgress = (totalSteps: number) => (
    <div className="flex items-center space-x-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div 
          key={i} 
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-[#4F7BFF]' : 'bg-[#2A2A2A]'}`}
        />
      ))}
    </div>
  );

  // Common Input Field
  const Input = ({ label, value, field, placeholder, type = "text", ...props }: any) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => updateForm(field, e.target.value)}
        placeholder={placeholder}
        className="block w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#4F7BFF] focus:ring-1 focus:ring-[#4F7BFF] transition-all"
        {...props}
      />
    </div>
  );

  const renderRoleSelection = () => (
    <motion.div key="role-selection" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-md">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">How will you use AkadVerse?</h1>
        <p className="text-zinc-400 text-sm">Select your role to tailor your workspace.</p>
      </div>

      <div className="space-y-4">
        {[
          { id: 'student', title: 'Student', desc: 'Access AI study tools, courses, and campus resources.', icon: GraduationCap },
          { id: 'faculty', title: 'Faculty', desc: 'Manage courses, teaching tools, and student progress.', icon: Briefcase },
          { id: 'admin', title: 'Admin', desc: 'Oversee institutional systems and campus activity.', icon: Shield },
        ].map((r) => (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            key={r.id}
            onClick={() => { setRole(r.id as Role); setStep(1); }}
            className="w-full text-left p-6 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#4F7BFF] rounded-2xl flex items-start space-x-4 transition-all group"
          >
            <div className="p-3 bg-[#2A2A2A] group-hover:bg-[#4F7BFF]/20 rounded-xl text-zinc-400 group-hover:text-[#4F7BFF] transition-colors">
              <r.icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-1">{r.title}</h3>
              <p className="text-sm text-zinc-400">{r.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="mt-8 text-center">
        <Link to="/login" className="text-zinc-400 text-sm hover:text-white transition-colors">
          Already have an account? <span className="text-[#6AA8FF] font-medium hover:underline">Sign in</span>
        </Link>
      </div>
    </motion.div>
  );

  const renderStudentFlow = () => {
    const totalSteps = 8;
    const canProceed = () => {
      switch(step) {
        case 1: return formData.fullName.length > 0;
        case 2: return formData.email.length > 0;
        case 3: return formData.password.length > 0 && formData.password === formData.confirmPassword;
        case 4: return formData.matricNumber.length > 0;
        case 5: return formData.registrationNumber.length > 0;
        case 6: return formData.program.length > 0;
        case 7: return formData.yearOfStudy.length > 0;
        default: return true;
      }
    };

    return (
      <motion.div key="student-flow" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-sm">
        <button onClick={prevStep} className="flex items-center text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        {renderProgress(totalSteps)}
        
        <div className="min-h-[250px] flex flex-col justify-center">
          {step === 1 && <Input label="What's your full name?" field="fullName" value={formData.fullName} placeholder="John Doe" />}
          {step === 2 && <Input label="What's your school email?" field="email" value={formData.email} placeholder="john.doe@university.edu" />}
          {step === 3 && (
            <div className="space-y-4">
              <div className="relative">
                <Input label="Create a password" field="password" type={showPassword ? "text" : "password"} value={formData.password} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-9 text-zinc-500 hover:text-zinc-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Confirm Password" field="confirmPassword" type={showPassword ? "text" : "password"} value={formData.confirmPassword} placeholder="••••••••" />
            </div>
          )}
          {step === 4 && <Input label="What is your matric number?" field="matricNumber" value={formData.matricNumber} placeholder="CSC/2023/1045" />}
          {step === 5 && <Input label="What is your registration number?" field="registrationNumber" value={formData.registrationNumber} placeholder="REG20231245" />}
          
          {step === 6 && (
            <div className="space-y-4">
              <Input label="What program are you studying?" field="program" value={formData.program} placeholder="e.g. Computer Science" />
              <div className="flex flex-wrap gap-2 mt-4">
                {['Computer Science', 'Mechanical Engineering', 'Economics', 'Law', 'Architecture'].map(p => (
                  <button key={p} onClick={() => updateForm('program', p)} className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-full text-xs text-zinc-300 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {step === 7 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 mb-2 block">What year are you in?</label>
              <div className="grid grid-cols-2 gap-3">
                {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'].map(y => (
                  <button 
                    key={y} 
                    onClick={() => updateForm('yearOfStudy', y)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.yearOfStudy === y ? 'border-[#4F7BFF] bg-[#4F7BFF]/10 text-white' : 'border-[#2A2A2A] bg-[#1A1A1A] text-zinc-400 hover:border-[#3A3A3A]'}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-white mb-4">Review your details</h2>
              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Name</span><span className="text-white">{formData.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{formData.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Matric No.</span><span className="text-white">{formData.matricNumber}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Reg No.</span><span className="text-white">{formData.registrationNumber}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Program</span><span className="text-white">{formData.program}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Year</span><span className="text-white">{formData.yearOfStudy}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          {step < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full py-3.5 bg-[#4F7BFF] hover:bg-[#6AA8FF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-medium flex items-center justify-center transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSignup}
              className="w-full py-3.5 bg-gradient-to-r from-[#4F7BFF] to-[#6AA8FF] text-white rounded-full font-medium transition-transform hover:scale-105 active:scale-95"
            >
              Create Account
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderFacultyFlow = () => {
    const totalSteps = 7;
    const canProceed = () => {
      switch(step) {
        case 1: return formData.fullName.length > 0;
        case 2: return formData.email.length > 0;
        case 3: return formData.password.length > 0 && formData.password === formData.confirmPassword;
        case 4: return formData.staffId.length > 0;
        case 5: return formData.department.length > 0;
        case 6: return formData.position.length > 0;
        default: return true;
      }
    };

    return (
      <motion.div key="faculty-flow" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-sm">
        <button onClick={prevStep} className="flex items-center text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        {renderProgress(totalSteps)}
        
        <div className="min-h-[250px] flex flex-col justify-center">
          {step === 1 && <Input label="What's your full name?" field="fullName" value={formData.fullName} placeholder="Sarah Johnson" />}
          {step === 2 && <Input label="What's your institutional email?" field="email" value={formData.email} placeholder="s.johnson@university.edu" />}
          {step === 3 && (
            <div className="space-y-4">
              <div className="relative">
                <Input label="Create a password" field="password" type={showPassword ? "text" : "password"} value={formData.password} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-9 text-zinc-500 hover:text-zinc-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Confirm Password" field="confirmPassword" type={showPassword ? "text" : "password"} value={formData.confirmPassword} placeholder="••••••••" />
            </div>
          )}
          {step === 4 && <Input label="What is your staff ID?" field="staffId" value={formData.staffId} placeholder="STF-20481" />}
          
          {step === 5 && (
            <div className="space-y-4">
              <Input label="Which department do you belong to?" field="department" value={formData.department} placeholder="e.g. Computer Science" />
              <div className="flex flex-wrap gap-2 mt-4">
                {['Computer Science', 'Mechanical Engineering', 'Business Administration', 'Law', 'Medicine'].map(d => (
                  <button key={d} onClick={() => updateForm('department', d)} className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-full text-xs text-zinc-300 transition-colors">
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {step === 6 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 mb-2 block">What is your role?</label>
              <div className="grid grid-cols-1 gap-3">
                {['Lecturer', 'Senior Lecturer', 'Professor', 'Teaching Assistant'].map(p => (
                  <button 
                    key={p} 
                    onClick={() => updateForm('position', p)}
                    className={`p-4 rounded-xl border text-left text-sm font-medium transition-all ${formData.position === p ? 'border-[#4F7BFF] bg-[#4F7BFF]/10 text-white' : 'border-[#2A2A2A] bg-[#1A1A1A] text-zinc-400 hover:border-[#3A3A3A]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-white mb-4">Review your details</h2>
              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Name</span><span className="text-white">{formData.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{formData.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Staff ID</span><span className="text-white">{formData.staffId}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Department</span><span className="text-white">{formData.department}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Position</span><span className="text-white">{formData.position}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          {step < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full py-3.5 bg-[#4F7BFF] hover:bg-[#6AA8FF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-medium flex items-center justify-center transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSignup}
              className="w-full py-3.5 bg-gradient-to-r from-[#4F7BFF] to-[#6AA8FF] text-white rounded-full font-medium transition-transform hover:scale-105 active:scale-95"
            >
              Create Faculty Account
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderAdminFlow = () => {
    const totalSteps = 6;
    const canProceed = () => {
      switch(step) {
        case 1: return formData.fullName.length > 0;
        case 2: return formData.email.length > 0;
        case 3: return formData.password.length > 0 && formData.password === formData.confirmPassword;
        case 4: return formData.adminRole.length > 0;
        case 5: return formData.adminId.length > 0;
        default: return true;
      }
    };

    return (
      <motion.div key="admin-flow" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-sm">
        <button onClick={prevStep} className="flex items-center text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        {renderProgress(totalSteps)}
        
        <div className="min-h-[250px] flex flex-col justify-center">
          {step === 1 && <Input label="What's your full name?" field="fullName" value={formData.fullName} placeholder="Admin User" />}
          {step === 2 && <Input label="What's your administrative email?" field="email" value={formData.email} placeholder="admin@university.edu" />}
          {step === 3 && (
            <div className="space-y-4">
              <div className="relative">
                <Input label="Create a password" field="password" type={showPassword ? "text" : "password"} value={formData.password} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-9 text-zinc-500 hover:text-zinc-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Confirm Password" field="confirmPassword" type={showPassword ? "text" : "password"} value={formData.confirmPassword} placeholder="••••••••" />
            </div>
          )}
          
          {step === 4 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 mb-2 block">What administrative role do you hold?</label>
              <div className="grid grid-cols-1 gap-3">
                {['System Administrator', 'Academic Administrator', 'IT Department', 'Registrar Office'].map(r => (
                  <button 
                    key={r} 
                    onClick={() => updateForm('adminRole', r)}
                    className={`p-4 rounded-xl border text-left text-sm font-medium transition-all ${formData.adminRole === r ? 'border-[#4F7BFF] bg-[#4F7BFF]/10 text-white' : 'border-[#2A2A2A] bg-[#1A1A1A] text-zinc-400 hover:border-[#3A3A3A]'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && <Input label="Enter your admin ID" field="adminId" value={formData.adminId} placeholder="ADM-1023" />}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-white mb-4">Review your details</h2>
              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Name</span><span className="text-white">{formData.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{formData.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Role</span><span className="text-white">{formData.adminRole}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Admin ID</span><span className="text-white">{formData.adminId}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          {step < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full py-3.5 bg-[#4F7BFF] hover:bg-[#6AA8FF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-medium flex items-center justify-center transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSignup}
              className="w-full py-3.5 bg-gradient-to-r from-[#4F7BFF] to-[#6AA8FF] text-white rounded-full font-medium transition-transform hover:scale-105 active:scale-95"
            >
              Create Admin Account
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex font-sans bg-[#0B0B0B] text-white overflow-hidden">
      
      {/* Left Panel - Sign Up Form */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 lg:p-12 z-10 relative">
        <AnimatePresence mode="wait">
          {step === 0 && renderRoleSelection()}
          {role === 'student' && step > 0 && renderStudentFlow()}
          {role === 'faculty' && step > 0 && renderFacultyFlow()}
          {role === 'admin' && step > 0 && renderAdminFlow()}
        </AnimatePresence>
      </div>

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

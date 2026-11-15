import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  LayoutGrid,
  BookOpen,
  Library,
  GraduationCap,
  ChevronDown,
  LogOut,
  Sparkles,
  X,
  CheckCircle2,
  FileText,
  Send,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type PortalFrame =
  | 'dashboard'
  | 'registration-status'
  | 'course-registration'
  | 'study-zone'
  | 'records';

export interface CourseItem {
  code: string;
  title: string;
  level: string;
  units: number;
  category: 'Elective' | 'Core';
  lecturer: string | null;
  weeks?: { week: number; topic: string; summary: string }[];
}

const INITIAL_COURSES: CourseItem[] = [
  {
    code: 'EEE 311',
    title: 'Electric Circuit Theory I',
    level: '300 Level',
    units: 2,
    category: 'Elective',
    lecturer: 'Marvelous Ifezue',
    weeks: [
      {
        week: 1,
        topic: 'Network Theorems & Nodal Analysis',
        summary: 'Superposition, Thevenin, Norton equivalents, and systematic nodal equations for planar and non-planar circuits.',
      },
      {
        week: 2,
        topic: 'Sinusoidal Steady-State & Phasor Domain',
        summary: 'Complex impedance, phasor diagrams, resonance phenomena, and maximum average power transfer.',
      },
      {
        week: 3,
        topic: 'Transient Analysis of RLC Networks',
        summary: 'First- and second-order differential equations, natural and forced responses, overdamped and underdamped systems.',
      },
    ],
  },
  {
    code: 'EEE 321',
    title: 'Analogue Electronic Circuits I',
    level: '300 Level',
    units: 2,
    category: 'Elective',
    lecturer: 'Marvelous Ifezue',
    weeks: [
      {
        week: 1,
        topic: 'BJT & MOSFET Small-Signal Modelling',
        summary: 'Hybrid-pi and T-models, transconductance, biasing stability, and single-stage amplifier configurations.',
      },
      {
        week: 2,
        topic: 'Multistage & Differential Amplifiers',
        summary: 'Cascaded stages, current mirrors, active loads, and common-mode rejection ratio (CMRR) optimization.',
      },
    ],
  },
  {
    code: 'EEE 324',
    title: 'Electromagnetic Fields and Waves I',
    level: '300 Level',
    units: 2,
    category: 'Elective',
    lecturer: null,
    weeks: [
      {
        week: 1,
        topic: 'Electrostatics & Gauss’s Law in Dielectrics',
        summary: 'Coulomb force, electric flux density, boundary conditions, and Poisson/Laplace equations.',
      },
      {
        week: 2,
        topic: 'Magnetostatics & Maxwell’s Equations',
        summary: 'Biot-Savart law, Ampere’s circuital law, magnetic vector potential, and time-varying fields.',
      },
    ],
  },
  {
    code: 'EEE 326',
    title: 'Electric Circuit Theory II',
    level: '300 Level',
    units: 2,
    category: 'Elective',
    lecturer: null,
    weeks: [
      {
        week: 1,
        topic: 'Two-Port Network Parameters',
        summary: 'Impedance (Z), Admittance (Y), Hybrid (H), and Transmission (ABCD) matrices in cascaded networks.',
      },
      {
        week: 2,
        topic: 'Laplace Transform in Circuit Synthesis',
        summary: 's-domain network functions, poles and zeros, Bode plots, and passive filter realization.',
      },
    ],
  },
  {
    code: 'GET 301',
    title: 'Engineering Mathematics III',
    level: '300 Level',
    units: 3,
    category: 'Core',
    lecturer: null,
    weeks: [
      {
        week: 1,
        topic: 'Fourier Series & Integral Transforms',
        summary: 'Harmonic analysis, even/odd extensions, Parseval’s identity, and continuous Fourier spectra.',
      },
      {
        week: 2,
        topic: 'Partial Differential Equations in Engineering',
        summary: 'Wave equation, heat conduction, separation of variables, and Sturm-Liouville boundary value problems.',
      },
    ],
  },
  {
    code: 'GET 307',
    title: 'Introduction to Artificial Intelligence, Machine Learning and Convergent Technologies',
    level: '300 Level',
    units: 3,
    category: 'Core',
    lecturer: null,
    weeks: [
      {
        week: 1,
        topic: 'Foundations of Intelligent Agents & Search',
        summary: 'Uninformed and heuristic search (A*), constraint satisfaction, and probabilistic reasoning.',
      },
      {
        week: 2,
        topic: 'Supervised Learning & Neural Architectures',
        summary: 'Linear models, gradient descent, backpropagation, and convergent cyber-physical engineering systems.',
      },
    ],
  },
  {
    code: 'GET 399',
    title: 'SIWES II: Students Work Experience Scheme',
    level: '300 Level',
    units: 4,
    category: 'Core',
    lecturer: null,
    weeks: [
      {
        week: 1,
        topic: 'Industrial Logbook & Technical Reporting',
        summary: 'Documentation standards, engineering safety compliance, and supervisor evaluation milestones.',
      },
    ],
  },
];

// Soft cubic-bezier curves (Ease-Out and Ease-In-Out, strictly non-linear)
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// Ultra-soft diffuse drop shadows per Global Design System Updates (Y: 4, Blur: 20, Spread: 0, Opacity: 8%)
const SOFT_CARD_SHADOW = '0 4px 20px 0 rgba(0, 0, 0, 0.08)';
const HOVER_CARD_SHADOW = '0 12px 28px 0 rgba(15, 23, 42, 0.12)';

/**
 * Custom Sidebar Collapse / Expand Icon matching Screenshot 1, 2, 4, 5
 */
function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-[#1E293B]"
    >
      <rect
        x="2.25"
        y="2.25"
        width="15.5"
        height="15.5"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="7.25"
        y1="2.75"
        x2="7.25"
        y2="17.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {collapsed ? (
        <path
          d="M11 7.5L13.5 10L11 12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M13.5 7.5L11 10L13.5 12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Odometer Number component for Smart Animate vertical number slide
 * Old number slides up and fades out; new number slides up from below.
 */
function OdometerNumber({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      data-layer="Odometer_Counter"
      className={`inline-flex items-center justify-center relative overflow-hidden align-bottom ${className}`}
      style={{ minWidth: value >= 10 ? '1.35ch' : '0.95ch', height: '1.35em' }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="inline-block tabular-nums leading-snug"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Reusable High-Contrast Pastel Pill Badges
 */
function LevelPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-[11.5px] font-bold bg-[#F8FAFC] text-[#1E293B] border border-[#CBD5E1]/90">
      {children}
    </span>
  );
}

function CategoryPill({ category }: { category: 'Elective' | 'Core' }) {
  if (category === 'Elective') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-[11.5px] font-bold bg-[#F3E8FF] text-[#581C87] border border-[#E9D5FF]">
        Elective
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-[11.5px] font-bold bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE]">
      Core
    </span>
  );
}

export function ELearningPortal({
  initialFrame = 'study-zone',
}: {
  initialFrame?: PortalFrame;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Current active frame across the E-Learning Student Portal
  const [activeFrame, setActiveFrame] = useState<PortalFrame>(initialFrame);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Accordion states in Sidebar
  const [academicOpen, setAcademicOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);

  // Hover states for Sidebar tabs
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);

  // Course Registration interactive state
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [hoveredAvailableCode, setHoveredAvailableCode] = useState<string | null>(null);

  // Study Zone active/selected card state (EEE 311 is active by default as in Screenshot 3)
  const [activeStudyCourseCode, setActiveStudyCourseCode] = useState<string>('EEE 311');
  const [hoveredStudyCourseCode, setHoveredStudyCourseCode] = useState<string | null>(null);
  const [activeStewartCourse, setActiveStewartCourse] = useState<CourseItem | null>(null);
  const [stewartPrompt, setStewartPrompt] = useState('');
  const [stewartMessages, setStewartMessages] = useState<
    { sender: 'stewart' | 'student'; text: string }[]
  >([]);

  // Animation replay key so user can re-trigger entrance/draw animations at any time
  const [frameAnimKey, setFrameAnimKey] = useState(0);

  const selectedCourses = INITIAL_COURSES.filter((c) =>
    selectedCourseCodes.includes(c.code)
  );
  const availableCourses = INITIAL_COURSES.filter(
    (c) => !selectedCourseCodes.includes(c.code)
  );

  const selectedUnits = selectedCourses.reduce((acc, c) => acc + c.units, 0);
  const maxUnits = 24;
  const minUnits = 15;
  const remainingUnits = Math.max(0, maxUnits - selectedUnits);

  const handleSelectCourse = (code: string) => {
    if (!selectedCourseCodes.includes(code)) {
      setSelectedCourseCodes((prev) => [...prev, code]);
    }
  };

  const handleRemoveCourse = (code: string) => {
    setSelectedCourseCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleSwitchFrame = (frame: PortalFrame, autoExpandAcademic = false) => {
    setActiveFrame(frame);
    if (autoExpandAcademic) {
      setAcademicOpen(true);
    }
  };

  const handleOpenStewart = (course: CourseItem) => {
    setActiveStudyCourseCode(course.code);
    setActiveStewartCourse(course);
    setStewartMessages([
      {
        sender: 'stewart',
        text: `Hi Awesome! I'm Stewart, your AI study assistant for ${course.code} (${course.title}). Which weekly topic would you like to review or quiz yourself on today?`,
      },
    ]);
  };

  const handleSendStewartMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stewartPrompt.trim() || !activeStewartCourse) return;
    const userText = stewartPrompt.trim();
    setStewartPrompt('');
    setStewartMessages((prev) => [
      ...prev,
      { sender: 'student', text: userText },
      {
        sender: 'stewart',
        text: `Great question on ${activeStewartCourse.code}! Based on your Week 1 lecture notes, focus on setting up the fundamental conservation equations first, then simplifying the network parameters step-by-step. Would you like a worked practice problem?`,
      },
    ]);
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  // Determine which Sidebar item holds the floating blue pill (`Active_Bg`)
  const getActiveSidebarTarget = (): string => {
    if (activeFrame === 'dashboard') return 'dashboard';
    if (activeFrame === 'study-zone') return 'study-zone';
    if (activeFrame === 'records') {
      return !isSidebarCollapsed && recordsOpen ? 'records-sub' : 'records';
    }
    if (
      activeFrame === 'course-registration' ||
      activeFrame === 'registration-status'
    ) {
      if (isSidebarCollapsed || !academicOpen) {
        return 'academic-essentials';
      }
      return activeFrame;
    }
    return 'dashboard';
  };

  const activeSidebarTarget = getActiveSidebarTarget();

  // Study Zone displays the 6 courses shown in Screenshot 3
  const studyZoneCourses = INITIAL_COURSES.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans antialiased selection:bg-[#185CFF]/15 selection:text-[#185CFF]">
      {/* TOP HEADER — Matches Screenshot 4 */}
      <header
        data-layer="Header_Bar"
        className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-6 flex items-center justify-between"
      >
        {/* Left Brand & Portal Badge */}
        <div className="flex items-center">
          <button
            onClick={() => handleSwitchFrame('dashboard')}
            className="text-[15px] font-bold tracking-tight text-[#0F172A] hover:opacity-80 transition-opacity cursor-pointer"
          >
            Akadverse
          </button>
          <div className="h-4 w-px bg-slate-200 mx-3.5" />
          <span className="text-[13px] font-medium text-[#475569]">
            E-Learning
          </span>
          <span className="ml-3 px-2.5 py-0.5 rounded-full bg-[#EBF3FF] text-[#185CFF] text-[10.5px] font-bold tracking-wider uppercase">
            STUDENT
          </span>
        </div>

        {/* Center Quick Frame Switcher (Soothing weightless segmented pill for effortless prototype testing) */}
        <div className="hidden lg:flex items-center gap-1 bg-[#F1F5F9]/90 p-1 rounded-full border border-slate-200/60">
          {[
            { id: 'dashboard', label: 'Dashboard Overview' },
            { id: 'registration-status', label: 'Registration Status' },
            { id: 'course-registration', label: 'Course Registration' },
            { id: 'study-zone', label: 'Study Zone' },
          ].map((tab) => {
            const isCurrent = activeFrame === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() =>
                  handleSwitchFrame(
                    tab.id as PortalFrame,
                    tab.id === 'registration-status' ||
                      tab.id === 'course-registration'
                  )
                }
                className={`relative px-3.5 py-1 rounded-full text-[12px] font-medium transition-colors duration-300 cursor-pointer ${
                  isCurrent
                    ? 'text-[#0F172A] font-semibold'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {isCurrent && (
                  <motion.div
                    layoutId="Header_Frame_Pill"
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                    className="absolute inset-0 bg-white rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setFrameAnimKey((k) => k + 1)}
            title="Replay current frame entrance animation"
            className="ml-0.5 p-1.5 rounded-full text-[#64748B] hover:text-[#185CFF] hover:bg-white/70 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right User & Sign out */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/productivity')}
            className="px-3 py-1 rounded-full bg-[#EEF4FF] text-[#185CFF] text-[12px] font-semibold hover:bg-[#185CFF] hover:text-white transition-colors cursor-pointer"
          >
            Productivity Layer →
          </button>
          <span className="text-[13.5px] font-medium text-[#1E293B]">
            Awesome
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#334155] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 stroke-[1.75]" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* BODY LAYOUT: SIDEBAR + MAIN FRAME */}
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
        {/* SIDEBAR NAVIGATION — Matches Screenshot 1, 2, 4, 5 */}
        <motion.aside
          data-layer="Sidebar_Container"
          animate={{ width: isSidebarCollapsed ? 68 : 252 }}
          transition={{ duration: 0.4, ease: EASE_IN_OUT }}
          className="flex-shrink-0 bg-[#F8FAFC] border-r border-slate-200/50 flex flex-col pt-4 pb-6 select-none relative z-20"
        >
          {/* Collapse / Expand Button Row */}
          <div
            className={`px-4 mb-5 flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-end'
            }`}
          >
            <motion.button
              whileHover={{ backgroundColor: 'rgba(226, 232, 240, 0.6)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#1E293B] cursor-pointer"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <SidebarToggleIcon collapsed={isSidebarCollapsed} />
            </motion.button>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 space-y-1.5 flex-1">
            {/* 1. DASHBOARD */}
            <SidebarItem
              id="dashboard"
              label="Dashboard"
              icon={LayoutGrid}
              collapsed={isSidebarCollapsed}
              isActive={activeSidebarTarget === 'dashboard'}
              isHovered={hoveredNavId === 'dashboard'}
              onHoverStart={() => setHoveredNavId('dashboard')}
              onHoverEnd={() => setHoveredNavId(null)}
              onClick={() => handleSwitchFrame('dashboard')}
            />

            {/* 2. ACADEMIC ESSENTIALS (Accordion) */}
            <div>
              <SidebarItem
                id="academic-essentials"
                label="Academic Essentials"
                icon={BookOpen}
                collapsed={isSidebarCollapsed}
                hasAccordion
                isExpanded={academicOpen}
                isActive={activeSidebarTarget === 'academic-essentials'}
                isHovered={hoveredNavId === 'academic-essentials'}
                onHoverStart={() => setHoveredNavId('academic-essentials')}
                onHoverEnd={() => setHoveredNavId(null)}
                onClick={() => {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                    setAcademicOpen(true);
                  } else {
                    setAcademicOpen((prev) => !prev);
                  }
                }}
              />

              {/* Accordion Dropdown List: Y: -10 to Y: 0 over 300ms */}
              <AnimatePresence initial={false}>
                {!isSidebarCollapsed && academicOpen && (
                  <motion.div
                    data-layer="Academic_Essentials_Dropdown"
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="overflow-hidden pl-4 pr-1 pt-1 space-y-1"
                  >
                    <SidebarSubItem
                      id="course-registration"
                      label="Course Registration"
                      isActive={activeSidebarTarget === 'course-registration'}
                      isHovered={hoveredNavId === 'course-registration'}
                      onHoverStart={() =>
                        setHoveredNavId('course-registration')
                      }
                      onHoverEnd={() => setHoveredNavId(null)}
                      onClick={() => handleSwitchFrame('course-registration')}
                    />
                    <SidebarSubItem
                      id="registration-status"
                      label="Registration Status"
                      isActive={activeSidebarTarget === 'registration-status'}
                      isHovered={hoveredNavId === 'registration-status'}
                      onHoverStart={() =>
                        setHoveredNavId('registration-status')
                      }
                      onHoverEnd={() => setHoveredNavId(null)}
                      onClick={() => handleSwitchFrame('registration-status')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. STUDY ZONE */}
            <SidebarItem
              id="study-zone"
              label="Study Zone"
              icon={Library}
              collapsed={isSidebarCollapsed}
              isActive={activeSidebarTarget === 'study-zone'}
              isHovered={hoveredNavId === 'study-zone'}
              onHoverStart={() => setHoveredNavId('study-zone')}
              onHoverEnd={() => setHoveredNavId(null)}
              onClick={() => handleSwitchFrame('study-zone')}
            />

            {/* 4. RECORDS & ANALYTICS (Accordion) */}
            <div>
              <SidebarItem
                id="records"
                label="Records & Analytics"
                icon={GraduationCap}
                collapsed={isSidebarCollapsed}
                hasAccordion
                isExpanded={recordsOpen}
                isActive={activeSidebarTarget === 'records'}
                isHovered={hoveredNavId === 'records'}
                onHoverStart={() => setHoveredNavId('records')}
                onHoverEnd={() => setHoveredNavId(null)}
                onClick={() => {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                    setRecordsOpen(true);
                  } else {
                    setRecordsOpen((prev) => !prev);
                  }
                }}
              />

              <AnimatePresence initial={false}>
                {!isSidebarCollapsed && recordsOpen && (
                  <motion.div
                    data-layer="Records_Analytics_Dropdown"
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="overflow-hidden pl-4 pr-1 pt-1 space-y-1"
                  >
                    <SidebarSubItem
                      id="records-sub"
                      label="Semester Results & CGPA"
                      isActive={activeSidebarTarget === 'records-sub'}
                      isHovered={hoveredNavId === 'records-sub'}
                      onHoverStart={() => setHoveredNavId('records-sub')}
                      onHoverEnd={() => setHoveredNavId(null)}
                      onClick={() => handleSwitchFrame('records')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>
        </motion.aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 px-6 sm:px-10 py-8 max-w-[1260px]">
          <AnimatePresence mode="wait">
            {/* =========================================================
                FRAME 1: DASHBOARD OVERVIEW
               ========================================================= */}
            {activeFrame === 'dashboard' && (
              <motion.div
                key={`dashboard-${frameAnimKey}`}
                data-layer="Frame_Dashboard_Overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="mb-6">
                  <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
                    Welcome, Awesome
                  </h1>
                  <p className="text-[14.5px] text-[#475569] mt-1">
                    Your academic overview.
                  </p>
                </div>

                {/* 6 Data Cards — Staggered Cascade (50ms delay between each, 400ms Ease-Out) + Hover Lift (Y: -4px, 300ms) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    {
                      id: 'session',
                      label: 'ACADEMIC SESSION',
                      value: '2026/2027',
                      isPulse: false,
                      onClick: undefined,
                    },
                    {
                      id: 'semester',
                      label: 'SEMESTER',
                      value: 'Alpha',
                      isPulse: false,
                      onClick: undefined,
                    },
                    {
                      id: 'level',
                      label: 'LEVEL',
                      value: '300 Level',
                      isPulse: false,
                      onClick: undefined,
                    },
                    {
                      id: 'reg-status',
                      label: 'REGISTRATION STATUS',
                      value: 'Not registered yet',
                      isPulse: true,
                      onClick: () =>
                        handleSwitchFrame('course-registration', true),
                    },
                    {
                      id: 'reg-courses',
                      label: 'REGISTERED COURSES',
                      value: '0',
                      isPulse: false,
                      onClick: () =>
                        handleSwitchFrame('registration-status', true),
                    },
                    {
                      id: 'cgpa',
                      label: 'CGPA',
                      value: '—',
                      isPulse: false,
                      onClick: undefined,
                    },
                  ].map((card, index) => (
                    <motion.div
                      key={card.id}
                      data-layer="Card_Container"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.4,
                          delay: index * 0.05,
                          ease: EASE_OUT,
                        },
                      }}
                      whileHover={{
                        y: -4,
                        boxShadow: HOVER_CARD_SHADOW,
                        transition: { duration: 0.3, ease: EASE_OUT },
                      }}
                      onClick={card.onClick}
                      style={{ boxShadow: SOFT_CARD_SHADOW }}
                      className={`bg-white rounded-[16px] p-6 border border-slate-100/90 transition-colors ${
                        card.onClick ? 'cursor-pointer' : ''
                      }`}
                    >
                      <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
                        {card.label}
                      </p>
                      {card.isPulse ? (
                        <motion.p
                          data-layer="Status_Pulse_Text"
                          animate={{ opacity: [1, 0.7, 1] }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="text-[20px] font-bold text-[#0F172A] mt-2.5 tracking-tight"
                        >
                          {card.value}
                        </motion.p>
                      ) : (
                        <p className="text-[20px] font-bold text-[#0F172A] mt-2.5 tracking-tight">
                          {card.value}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Deadlines & announcements card */}
                <motion.div
                  data-layer="Card_Container"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.4, delay: 0.3, ease: EASE_OUT },
                  }}
                  whileHover={{
                    y: -4,
                    boxShadow: HOVER_CARD_SHADOW,
                    transition: { duration: 0.3, ease: EASE_OUT },
                  }}
                  style={{ boxShadow: SOFT_CARD_SHADOW }}
                  className="bg-white rounded-[16px] p-6 border border-slate-100/90"
                >
                  <h2 className="text-[14px] font-bold text-[#0F172A]">
                    Deadlines &amp; announcements
                  </h2>
                  <p className="text-[13.5px] text-[#64748B] mt-2 leading-relaxed">
                    Academic deadlines are DAPU-controlled (AGENTS.md §27) and
                    results/registration already check them — a dedicated
                    deadlines/announcements widget here is still a later phase.
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* =========================================================
                FRAME 2: REGISTRATION STATUS
               ========================================================= */}
            {activeFrame === 'registration-status' && (
              <motion.div
                key={`registration-status-${frameAnimKey}`}
                data-layer="Frame_Registration_Status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="space-y-6"
              >
                <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
                  Registration Status
                </h1>

                <motion.div
                  data-layer="Card_Container"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  style={{ boxShadow: SOFT_CARD_SHADOW }}
                  className="bg-white rounded-[16px] p-7 border border-slate-100/90"
                >
                  {/* Session Header */}
                  <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#334155]">
                    2026/2027 · ALPHA
                  </p>

                  {/* Pending Badge with Soft Infinite Shimmer (every 4-5 seconds) */}
                  <div className="mt-3">
                    <div
                      data-layer="Pending_Approval_Badge"
                      className="relative inline-flex items-center px-4 py-1.5 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#78350F] text-[13.5px] font-bold overflow-hidden"
                    >
                      <span className="relative z-10">
                        Pending Level Advisor approval
                      </span>
                      <motion.span
                        data-layer="Pending_Badge_Shimmer"
                        initial={{ x: '-140%' }}
                        animate={{ x: '240%' }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          repeatDelay: 3.1,
                          ease: 'easeInOut',
                        }}
                        className="pointer-events-none absolute inset-y-0 w-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                      />
                    </div>
                  </div>

                  {/* Timeline Stepper with SVG Path Draw Animation on Registered Checkmark */}
                  <div
                    data-layer="Timeline_Stepper"
                    className="flex flex-wrap items-center gap-2.5 mt-4"
                  >
                    {/* Registered Pill */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D] text-[12px] font-bold">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="shrink-0"
                      >
                        <motion.path
                          data-layer="Registered_Checkmark_Path"
                          d="M3.2 8.3L6.4 11.5L12.8 4.5"
                          stroke="#15803D"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: 0.55,
                            delay: 0.15,
                            ease: EASE_OUT,
                          }}
                        />
                      </svg>
                      <span>Registered</span>
                    </span>

                    {/* Level Advisor Pill */}
                    <span className="inline-flex items-center px-3 py-1 rounded-[8px] bg-white border border-[#CBD5E1] text-[#1E293B] text-[12px] font-bold">
                      Level Advisor
                    </span>

                    {/* HOD Pill */}
                    <span className="inline-flex items-center px-3 py-1 rounded-[8px] bg-white border border-[#CBD5E1] text-[#1E293B] text-[12px] font-bold">
                      HOD
                    </span>
                  </div>

                  {/* Summary & Muted Secondary Timestamp */}
                  <div className="mt-5 space-y-1">
                    <p className="text-[13.5px] font-medium text-[#0F172A]">
                      7 courses on this registration.
                    </p>
                    <p className="text-[13px] text-[#64748B]">
                      Registered 10/29/2026.
                    </p>
                  </div>

                  {/* Course List — Scroll-triggered fade-in & slide-up (Y: 20px -> 0px) + Row Hover (#F3F4F6 over 200ms) */}
                  <div
                    data-layer="Registration_Course_List"
                    className="mt-6 divide-y divide-slate-100 border-t border-slate-100"
                  >
                    {INITIAL_COURSES.map((course, index) => (
                      <motion.div
                        key={course.code}
                        data-layer="Course_Row"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.25 }}
                        transition={{
                          duration: 0.4,
                          delay: index * 0.06,
                          ease: EASE_OUT,
                        }}
                        whileHover={{
                          backgroundColor: '#F3F4F6',
                          transition: { duration: 0.2, ease: EASE_OUT },
                        }}
                        className="py-3.5 px-3 -mx-3 rounded-[10px] flex flex-wrap items-center gap-2 transition-colors"
                      >
                        <span className="text-[13.5px] font-bold text-[#0F172A]">
                          {course.code}
                        </span>
                        <span className="text-[13.5px] font-medium text-[#1E293B] mr-1">
                          — {course.title}
                        </span>
                        <LevelPill>{course.level}</LevelPill>
                        <LevelPill>{course.units} Units</LevelPill>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* =========================================================
                FRAME 3: COURSE REGISTRATION
               ========================================================= */}
            {activeFrame === 'course-registration' && (
              <motion.div
                key={`course-registration-${frameAnimKey}`}
                data-layer="Frame_Course_Registration"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="space-y-6"
              >
                {/* Page Title */}
                <div>
                  <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
                    Course Registration
                  </h1>
                  <p className="text-[14px] text-[#64748B] mt-0.5">
                    2026/2027 · Alpha
                  </p>
                </div>

                {/* Breathing Pale Green Countdown Container (Loops every 2 seconds, static timer numbers) */}
                <motion.div
                  data-layer="Countdown_Container"
                  animate={{
                    boxShadow: [
                      '0 4px 20px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(134, 239, 172, 0.55), inset 0 0 14px 0 rgba(74, 222, 128, 0.04)',
                      '0 6px 24px 0 rgba(22, 163, 74, 0.09), inset 0 0 0 1.5px rgba(34, 197, 94, 0.95), inset 0 0 28px 0 rgba(74, 222, 128, 0.18)',
                      '0 4px 20px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(134, 239, 172, 0.55), inset 0 0 14px 0 rgba(74, 222, 128, 0.04)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="bg-[#F0FDF4] rounded-[16px] p-6"
                >
                  <p className="text-[13.5px] font-bold text-[#064E3B]">
                    Registration closes in
                  </p>
                  <p className="text-[24px] sm:text-[26px] font-bold text-[#052E16] tracking-tight mt-1.5">
                    1 Days 0 Hours 45 Minutes 33 Seconds
                  </p>
                  <p className="text-[12.5px] text-[#166534]/85 mt-1.5">
                    Opens Oct 11, 2026, 3:01 PM · Closes Oct 30, 2026, 3:01 PM
                  </p>
                </motion.div>

                {/* Selected Courses Card */}
                <motion.div
                  layout
                  data-layer="Selected_Courses_Container"
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  style={{ boxShadow: SOFT_CARD_SHADOW }}
                  className="bg-white rounded-[16px] p-6 border border-slate-100/90"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[14.5px] font-bold text-[#0F172A] flex items-center gap-1">
                        <span>Selected Courses (</span>
                        <OdometerNumber value={selectedCourses.length} />
                        <span>)</span>
                      </h2>
                      <p className="text-[13px] text-[#64748B] mt-1">
                        Selecting a course does not register it. Review your
                        selection, then press Register Courses.
                      </p>
                    </div>

                    {selectedCourses.length > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        onClick={() =>
                          handleSwitchFrame('registration-status', true)
                        }
                        className="px-4 py-2 rounded-[10px] bg-[#185CFF] text-white text-[13px] font-semibold shadow-[0_4px_14px_rgba(24,92,255,0.25)] hover:bg-[#144EE0] transition-colors cursor-pointer"
                      >
                        Register Courses
                      </motion.button>
                    )}
                  </div>

                  {/* Selected Course Rows (Smart Animate target) */}
                  <div className="my-4">
                    <AnimatePresence initial={false}>
                      {selectedCourses.length === 0 ? (
                        <motion.p
                          key="empty-selected"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                          className="text-[13.5px] text-[#64748B] py-1"
                        >
                          No courses selected yet.
                        </motion.p>
                      ) : (
                        <motion.div
                          key="selected-list"
                          className="divide-y divide-slate-100 border-t border-b border-slate-100"
                        >
                          {selectedCourses.map((course) => (
                            <motion.div
                              layout
                              layoutId={`reg-course-row-${course.code}`}
                              key={course.code}
                              data-layer={`Course_Row_${course.code}`}
                              initial={{ opacity: 0, y: 18 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -18 }}
                              transition={{ duration: 0.42, ease: EASE_OUT }}
                              className="py-3.5 px-3 -mx-3 rounded-[10px] flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13.5px] font-bold text-[#0F172A]">
                                  {course.code}
                                </span>
                                <span className="text-[13.5px] font-medium text-[#1E293B] mr-1">
                                  — {course.title}
                                </span>
                                <LevelPill>{course.level}</LevelPill>
                                <LevelPill>{course.units} Units</LevelPill>
                                <CategoryPill category={course.category} />
                              </div>

                              <button
                                onClick={() => handleRemoveCourse(course.code)}
                                className="px-3 py-1 rounded-full text-[12.5px] font-bold text-[#64748B] hover:text-[#DC2626] hover:bg-red-50/80 transition-colors duration-300 shrink-0 cursor-pointer"
                              >
                                Remove
                              </button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Unit Counter with Odometer Effect */}
                  <div
                    data-layer="Unit_Counter_Bar"
                    className="text-[13.5px] font-bold text-[#0F172A] flex flex-wrap items-center gap-x-1.5"
                  >
                    <span>Selected:</span>
                    <OdometerNumber
                      value={selectedUnits}
                      className="text-[#185CFF]"
                    />
                    <span>units · Maximum: 24 · Remaining:</span>
                    <OdometerNumber value={remainingUnits} />
                    <span>· Minimum: {minUnits}</span>
                  </div>
                </motion.div>

                {/* Available Courses Card */}
                <motion.div
                  layout
                  data-layer="Available_Courses_Container"
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  style={{ boxShadow: SOFT_CARD_SHADOW }}
                  className="bg-white rounded-[16px] p-6 border border-slate-100/90"
                >
                  <h2 className="text-[14.5px] font-bold text-[#0F172A] mb-3 flex items-center gap-1">
                    <span>Available Courses — 300 Level (</span>
                    <OdometerNumber value={availableCourses.length} />
                    <span>)</span>
                  </h2>

                  {availableCourses.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="py-6 text-center text-[13.5px] text-[#64748B]"
                    >
                      All available 300 Level courses have been selected above.
                    </motion.div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      <AnimatePresence initial={false}>
                        {availableCourses.map((course) => {
                          const isRowHovered =
                            hoveredAvailableCode === course.code;
                          return (
                            <motion.div
                              layout
                              layoutId={`reg-course-row-${course.code}`}
                              key={course.code}
                              data-layer={`Course_Row_${course.code}`}
                              initial={{ opacity: 0, y: -16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ duration: 0.42, ease: EASE_OUT }}
                              onMouseEnter={() =>
                                setHoveredAvailableCode(course.code)
                              }
                              onMouseLeave={() => setHoveredAvailableCode(null)}
                              onClick={() => handleSelectCourse(course.code)}
                              className="py-4 px-3 -mx-3 rounded-[10px] flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors duration-300"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13.5px] font-bold text-[#0F172A]">
                                  {course.code}
                                </span>
                                <span className="text-[13.5px] font-medium text-[#1E293B] mr-1">
                                  — {course.title}
                                </span>
                                <LevelPill>{course.level}</LevelPill>
                                <LevelPill>{course.units} Units</LevelPill>
                                <CategoryPill category={course.category} />
                              </div>

                              {/* Select Action with Faint Blue Hover Pill Fade-In */}
                              <div className="relative inline-flex items-center justify-center px-3.5 py-1.5 shrink-0">
                                <motion.div
                                  data-layer="Select_Hover_Pill"
                                  initial={false}
                                  animate={{
                                    opacity: isRowHovered ? 1 : 0,
                                    scale: isRowHovered ? 1 : 0.94,
                                  }}
                                  transition={{
                                    duration: 0.3,
                                    ease: EASE_OUT,
                                  }}
                                  className="absolute inset-0 rounded-full bg-[#EFF6FF] border border-[#BFDBFE]/60"
                                />
                                <span className="relative z-10 text-[13px] font-bold text-[#185CFF]">
                                  Select
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* =========================================================
                FRAME 4: STUDY ZONE
               ========================================================= */}
            {activeFrame === 'study-zone' && (
              <motion.div
                key={`study-zone-${frameAnimKey}`}
                data-layer="Frame_Study_Zone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="space-y-6"
              >
                {/* Header with Stewart AI Study Assistant subtle gradient highlight */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[14px] bg-[#EEF4FF] text-[#185CFF] flex items-center justify-center shrink-0 mt-0.5 shadow-[0_2px_10px_rgba(24,92,255,0.08)]">
                    <Library className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] leading-tight">
                      Welcome to Study Zone
                    </h1>
                    <p className="text-[14.5px] text-[#475569] mt-1 leading-relaxed">
                      What would you like to study? Pick a course to read its
                      weekly materials{' '}
                      <span
                        data-layer="Stewart_Header_Highlight"
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r from-[#EEF4FF] via-[#F3E8FF]/80 to-[#EEF4FF] border border-[#DBEAFE]/80"
                      >
                        <span className="bg-gradient-to-r from-[#185CFF] via-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent font-semibold">
                          with Stewart, your AI study assistant.
                        </span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Section Subheader */}
                <div className="pt-2">
                  <h2 className="text-[14px] font-bold text-[#0F172A]">
                    Your courses · 2026/2027 · Alpha
                  </h2>
                </div>

                {/* 6 Course Cards — Staggered 50ms Entry + Hover/Active Variant (Lift Y: -4px, Shadow Deepens, Blue Border Fades In, Arrow Shifts X: 4px) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {studyZoneCourses.map((course, index) => {
                    const isActive = activeStudyCourseCode === course.code;
                    const isHovered = hoveredStudyCourseCode === course.code;
                    const isHighlighted = isActive || isHovered;

                    return (
                      <motion.div
                        key={course.code}
                        data-layer="Card_Container"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.4,
                            delay: index * 0.05,
                            ease: EASE_OUT,
                          },
                        }}
                        whileHover={{
                          y: -4,
                          boxShadow: HOVER_CARD_SHADOW,
                          transition: { duration: 0.3, ease: EASE_OUT },
                        }}
                        onMouseEnter={() =>
                          setHoveredStudyCourseCode(course.code)
                        }
                        onMouseLeave={() => setHoveredStudyCourseCode(null)}
                        onClick={() => setActiveStudyCourseCode(course.code)}
                        style={{ boxShadow: SOFT_CARD_SHADOW }}
                        className="relative bg-white rounded-[16px] p-6 flex flex-col justify-between cursor-pointer min-h-[225px]"
                      >
                        {/* Smoothly Fading Active/Hover Blue Border */}
                        <motion.div
                          data-layer="Card_Active_Border"
                          initial={false}
                          animate={{
                            borderColor: isHighlighted
                              ? 'rgba(59, 130, 246, 0.75)'
                              : 'rgba(226, 232, 240, 0.75)',
                          }}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                          className="pointer-events-none absolute inset-0 rounded-[16px] border-[1.5px]"
                        />

                        <div>
                          {/* Course Code */}
                          <p className="text-[13px] font-bold text-[#185CFF] tracking-wide">
                            {course.code}
                          </p>

                          {/* Course Title (Bold, high-contrast) */}
                          <h3 className="text-[17px] font-bold text-[#0F172A] mt-1.5 leading-snug">
                            {course.title}
                          </h3>

                          {/* Pills: Level, Units, Category */}
                          <div className="flex flex-wrap items-center gap-2 mt-3.5">
                            <LevelPill>{course.level}</LevelPill>
                            <LevelPill>{course.units} Units</LevelPill>
                            <CategoryPill category={course.category} />
                          </div>

                          {/* Lecturer Hierarchy: Assigned = darker readable text; Unassigned = muted gray */}
                          <p
                            className={`text-[13.5px] mt-4 ${
                              course.lecturer
                                ? 'text-[#1E293B] font-medium'
                                : 'text-[#94A3B8] font-normal'
                            }`}
                          >
                            Lecturer:{' '}
                            {course.lecturer
                              ? course.lecturer
                              : 'Not yet assigned'}
                          </p>
                        </div>

                        {/* Start studying → CTA with X: 0 to X: 4px arrow motion */}
                        <div className="mt-5 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStewart(course);
                            }}
                            className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#185CFF] cursor-pointer"
                          >
                            <span>Start studying</span>
                            <motion.span
                              data-layer="Start_Studying_Arrow"
                              initial={false}
                              animate={{ x: isHighlighted ? 4 : 0 }}
                              transition={{ duration: 0.3, ease: EASE_OUT }}
                              className="inline-flex items-center"
                            >
                              →
                            </motion.span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* =========================================================
                FRAME 5: RECORDS & ANALYTICS
               ========================================================= */}
            {activeFrame === 'records' && (
              <motion.div
                key={`records-${frameAnimKey}`}
                data-layer="Frame_Records_Analytics"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
                    Records &amp; Analytics
                  </h1>
                  <p className="text-[14px] text-[#64748B] mt-1">
                    2026/2027 · Alpha Semester Academic Standing
                  </p>
                </div>

                <div
                  style={{ boxShadow: SOFT_CARD_SHADOW }}
                  className="bg-white rounded-[16px] p-7 border border-slate-100/90"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-[#185CFF]" />
                    <h2 className="text-[16px] font-bold text-[#0F172A]">
                      Official Results &amp; Transcripts
                    </h2>
                  </div>
                  <p className="text-[13.5px] text-[#64748B] leading-relaxed">
                    Semester results for 2026/2027 Alpha will be published here
                    upon Senate approval and DAPU release. You can review your
                    registered courses in{' '}
                    <button
                      onClick={() =>
                        handleSwitchFrame('registration-status', true)
                      }
                      className="text-[#185CFF] font-semibold hover:underline cursor-pointer"
                    >
                      Registration Status
                    </button>{' '}
                    or continue reviewing weekly materials in{' '}
                    <button
                      onClick={() => handleSwitchFrame('study-zone')}
                      className="text-[#185CFF] font-semibold hover:underline cursor-pointer"
                    >
                      Study Zone
                    </button>
                    .
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* STEWART AI STUDY ASSISTANT DRAWER (Opens when clicking "Start studying →" in Study Zone) */}
      <AnimatePresence>
        {activeStewartCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            onClick={() => setActiveStewartCourse(null)}
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[2px] flex justify-end"
          >
            <motion.div
              data-layer="Stewart_Study_Drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-white h-full shadow-[0_0_40px_rgba(15,23,42,0.12)] border-l border-slate-100 flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-[#185CFF]">
                      {activeStewartCourse.code}
                    </span>
                    <CategoryPill category={activeStewartCourse.category} />
                  </div>
                  <h2 className="text-[19px] font-bold text-[#0F172A] mt-1">
                    {activeStewartCourse.title}
                  </h2>
                  <p className="text-[13px] text-[#64748B] mt-0.5">
                    Lecturer:{' '}
                    {activeStewartCourse.lecturer ?? 'Not yet assigned'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveStewartCourse(null)}
                  className="p-2 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Weekly Materials & Stewart Chat */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] mb-3">
                    Weekly Study Materials
                  </h3>
                  <div className="space-y-3">
                    {(activeStewartCourse.weeks ?? []).map((wk) => (
                      <div
                        key={wk.week}
                        style={{ boxShadow: SOFT_CARD_SHADOW }}
                        className="p-4 rounded-[14px] bg-[#F8FAFC] border border-slate-200/60"
                      >
                        <div className="flex items-center gap-2 text-[12px] font-bold text-[#185CFF]">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Week {wk.week}</span>
                        </div>
                        <h4 className="text-[14px] font-bold text-[#0F172A] mt-1">
                          {wk.topic}
                        </h4>
                        <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
                          {wk.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stewart AI Assistant Conversation */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                    <h3 className="text-[13px] font-bold bg-gradient-to-r from-[#185CFF] to-[#7C3AED] bg-clip-text text-transparent">
                      Stewart · AI Study Assistant
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {stewartMessages.map((msg, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className={`p-3.5 rounded-[14px] text-[13.5px] leading-relaxed ${
                          msg.sender === 'stewart'
                            ? 'bg-[#EEF4FF]/80 text-[#0F172A] border border-[#DBEAFE]'
                            : 'bg-[#185CFF] text-white ml-8'
                        }`}
                      >
                        {msg.text}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stewart Input Footer */}
              <form
                onSubmit={handleSendStewartMessage}
                className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={stewartPrompt}
                  onChange={(e) => setStewartPrompt(e.target.value)}
                  placeholder={`Ask Stewart about ${activeStewartCourse.code}...`}
                  className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2.5 text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#185CFF]"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-full bg-[#185CFF] text-white flex items-center justify-center hover:bg-[#144EE0] transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Top-Level Sidebar Item Component with Smart Animate `Active_Bg` & 200ms `Hover_Bg`
 */
function SidebarItem({
  id,
  label,
  icon: Icon,
  collapsed,
  hasAccordion = false,
  isExpanded = false,
  isActive,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  hasAccordion?: boolean;
  isExpanded?: boolean;
  isActive: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}) {
  return (
    <button
      data-layer={`Sidebar_Tab_${id}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`relative w-full flex items-center ${
        collapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-4 py-3'
      } rounded-[14px] text-left cursor-pointer select-none transition-colors duration-300`}
    >
      {/* Hover Variant: Faint, translucent gray pill softly fades in (0% -> 100%, 200ms) on inactive tabs */}
      <motion.div
        data-layer="Hover_Bg"
        initial={false}
        animate={{ opacity: !isActive && isHovered ? 1 : 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className={`pointer-events-none absolute ${
          collapsed
            ? 'w-10 h-10 rounded-[12px]'
            : 'inset-0 rounded-[14px]'
        } bg-slate-200/60`}
      />

      {/* Active State (Smart Animate): Floating Blue Pill (`Active_Bg`) slides smoothly vertically */}
      {isActive && (
        <motion.div
          layoutId="Active_Bg"
          data-layer="Active_Bg"
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className={`pointer-events-none absolute ${
            collapsed
              ? 'w-10 h-10 rounded-[12px]'
              : 'inset-0 rounded-[14px]'
          } bg-[#185CFF] shadow-[0_4px_18px_rgba(24,92,255,0.25)]`}
        />
      )}

      {/* Foreground Icon + Label */}
      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
        <Icon
          className={`w-[19px] h-[19px] shrink-0 transition-colors duration-300 ${
            isActive ? 'text-white' : 'text-[#0F172A]'
          }`}
        />
        {!collapsed && (
          <span
            className={`text-[14.5px] tracking-[-0.01em] truncate transition-colors duration-300 ${
              isActive
                ? 'text-white font-semibold'
                : 'text-[#0F172A] font-medium'
            }`}
          >
            {label}
          </span>
        )}
      </div>

      {/* Accordion Chevron rotating 180 degrees over 300ms */}
      {!collapsed && hasAccordion && (
        <motion.div
          data-layer="Accordion_Chevron"
          initial={false}
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: EASE_IN_OUT }}
          className="relative z-10 ml-2 shrink-0"
        >
          <ChevronDown
            className={`w-4 h-4 transition-colors duration-300 ${
              isActive ? 'text-white' : 'text-[#0F172A]'
            }`}
          />
        </motion.div>
      )}
    </button>
  );
}

/**
 * Sub-item inside Sidebar Accordion Dropdown (also participates in `Active_Bg` Smart Animate & 200ms `Hover_Bg`)
 */
function SidebarSubItem({
  id,
  label,
  isActive,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onClick,
}: {
  id: string;
  label: string;
  isActive: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}) {
  return (
    <button
      data-layer={`Sidebar_SubTab_${id}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
      className="relative w-full flex items-center px-4 py-2.5 rounded-[12px] text-left cursor-pointer select-none"
    >
      {/* Faint translucent gray hover pill (0% -> 100%, 200ms) */}
      <motion.div
        data-layer="Hover_Bg"
        initial={false}
        animate={{ opacity: !isActive && isHovered ? 1 : 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-0 rounded-[12px] bg-slate-200/55"
      />

      {/* Shared Floating Blue Pill (`Active_Bg`) */}
      {isActive && (
        <motion.div
          layoutId="Active_Bg"
          data-layer="Active_Bg"
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="pointer-events-none absolute inset-0 rounded-[12px] bg-[#185CFF] shadow-[0_4px_16px_rgba(24,92,255,0.22)]"
        />
      )}

      <span
        className={`relative z-10 text-[13.5px] pl-5 truncate transition-colors duration-300 ${
          isActive
            ? 'text-white font-semibold'
            : 'text-[#334155] font-medium'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Calendar as CalendarIcon,
  Plus,
  Presentation,
  Dumbbell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flame,
  AlertCircle,
  ArrowLeft,
  Home,
  Briefcase,
  Heart,
  User,
  Edit3,
  Trash2,
  RefreshCw,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';

const SOFT_EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type ScheduleLifeArea =
  | 'Academics'
  | 'Exercise'
  | 'Spirituality'
  | 'Personal'
  | 'Work';

export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type EventOutcomeState = 'default' | 'completed' | 'missed' | 'cancelled';
export type TimetableSyncMode =
  | 'normal'
  | 'updated'
  | 'cancelled-class'
  | 'dropped-course'
  | 'unavailable';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  lifeArea: ScheduleLifeArea;
  dayIndex: number; // 0 = Mon ... 6 = Sun
  startHour: number; // e.g. 9 = 9:00 AM, 14.5 = 2:30 PM
  durationHours: number; // e.g. 1, 1.5, 2
  location: string;
  priority: PriorityLevel;
  mustCompleteToday: boolean;
  state: EventOutcomeState;
  isOfficial: boolean;
  // Official Academic Class Metadata
  courseCode?: string;
  lecturer?: string;
  semester?: string;
  studentNotes?: string;
  attendanceStatus?: 'unrecorded' | 'attended' | 'missed';
  // Personal / Habit Metadata
  backupSlot?: string;
  reminder?: string;
  habitSource?: string;
}

export const WEEK_DAYS = [
  { index: 0, short: 'Mon', date: 26, full: 'Monday, Oct 26', iso: '2026-10-26' },
  { index: 1, short: 'Tue', date: 27, full: 'Tuesday, Oct 27', iso: '2026-10-27' },
  { index: 2, short: 'Wed', date: 28, full: 'Wednesday, Oct 28', iso: '2026-10-28' },
  { index: 3, short: 'Thu', date: 29, full: 'Thursday, Oct 29', iso: '2026-10-29' },
  {
    index: 4,
    short: 'Fri',
    date: 30,
    full: 'Friday, Oct 30',
    iso: '2026-10-30',
    isToday: true,
  },
  { index: 5, short: 'Sat', date: 31, full: 'Saturday, Oct 31', iso: '2026-10-31' },
  { index: 6, short: 'Sun', date: 1, full: 'Sunday, Nov 1', iso: '2026-11-01' },
];

export const LIFE_AREAS_CONFIG: {
  id: ScheduleLifeArea;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  cardBg: string;
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
}[] = [
  {
    id: 'Academics',
    label: 'Academics',
    description: 'Lectures, assignments, study sessions and academic activities.',
    icon: BookOpen,
    cardBg:
      'linear-gradient(145deg, rgba(224, 242, 254, 0.86) 0%, rgba(255, 255, 255, 0.88) 100%)',
    accentBorder: '#0284C7',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-800',
    dotColor: '#38BDF8',
  },
  {
    id: 'Exercise',
    label: 'Exercise',
    description: 'Workouts, gym sessions and fitness activities.',
    icon: Dumbbell,
    cardBg:
      'linear-gradient(145deg, rgba(209, 250, 229, 0.86) 0%, rgba(255, 255, 255, 0.88) 100%)',
    accentBorder: '#059669',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-800',
    dotColor: '#34D399',
  },
  {
    id: 'Spirituality',
    label: 'Spirituality',
    description: 'Prayer, Bible study and spiritual activities.',
    icon: Heart,
    cardBg:
      'linear-gradient(145deg, rgba(237, 233, 254, 0.88) 0%, rgba(255, 255, 255, 0.88) 100%)',
    accentBorder: '#7C3AED',
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-800',
    dotColor: '#A78BFA',
  },
  {
    id: 'Personal',
    label: 'Personal',
    description: 'Personal appointments, reading and daily activities.',
    icon: User,
    cardBg:
      'linear-gradient(145deg, rgba(255, 237, 213, 0.88) 0%, rgba(255, 255, 255, 0.88) 100%)',
    accentBorder: '#EA580C',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-800',
    dotColor: '#FB923C',
  },
  {
    id: 'Work',
    label: 'Work',
    description: 'Projects, meetings and professional commitments.',
    icon: Briefcase,
    cardBg:
      'linear-gradient(145deg, rgba(226, 232, 240, 0.88) 0%, rgba(255, 255, 255, 0.90) 100%)',
    accentBorder: '#2563EB',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-800',
    dotColor: '#60A5FA',
  },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 AM to 9:00 PM
const HOUR_HEIGHT = 72;

export function formatTimeRange(startHour: number, durationHours: number): string {
  const formatSingle = (hrFloat: number) => {
    const h = Math.floor(hrFloat);
    const m = Math.round((hrFloat - h) * 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const dispH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${dispH}:${m.toString().padStart(2, '0')} ${period}`;
  };
  return `${formatSingle(startHour)} – ${formatSingle(startHour + durationHours)}`;
}

const INITIAL_EVENTS: CalendarEvent[] = [
  // MONDAY
  {
    id: 'ev-mon-1',
    title: 'Morning 5km Conditioning Run',
    description:
      'Campus perimeter aerobic conditioning loop and dynamic stretching before morning classes.',
    lifeArea: 'Exercise',
    dayIndex: 0,
    startHour: 6.5,
    durationHours: 1.0,
    location: 'Campus Track',
    priority: 'High',
    mustCompleteToday: true,
    state: 'completed',
    isOfficial: false,
    habitSource: 'Habit · Morning 5km Jog (Mon, Wed, Fri)',
    reminder: '15 mins before',
  },
  {
    id: 'ev-mon-2',
    title: 'MAT 301 · Engineering Mathematics III',
    description:
      'Official lecture covering Fourier series, odd/even extensions, and boundary value partial differential equations.',
    lifeArea: 'Academics',
    dayIndex: 0,
    startHour: 9.0,
    durationHours: 1.5,
    location: 'Science Hall B',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: true,
    courseCode: 'MAT 301',
    lecturer: 'Prof. A. O. Adeyemi',
    semester: '2026/2027 · Alpha Semester',
    studentNotes: 'Review orthogonal function proofs before Friday tutorial.',
    attendanceStatus: 'attended',
  },
  {
    id: 'ev-mon-3',
    title: 'Frontend Architecture Sprint Sync',
    description:
      'Weekly engineering internship stand-up reviewing component library deliverables and API contracts.',
    lifeArea: 'Work',
    dayIndex: 0,
    startHour: 14.0,
    durationHours: 1.0,
    location: 'Innovation Hub Room 3',
    priority: 'Medium',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: false,
    reminder: '15 mins before',
  },

  // TUESDAY
  {
    id: 'ev-tue-1',
    title: 'EEE 311 · Electric Circuit Theory I',
    description:
      'Network theorems, superposition, Thevenin/Norton equivalents, and sinusoidal steady-state phasor domain analysis.',
    lifeArea: 'Academics',
    dayIndex: 1,
    startHour: 8.5,
    durationHours: 1.5,
    location: 'Engineering Lecture Theatre B',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: true,
    courseCode: 'EEE 311',
    lecturer: 'Marvelous Ifezue',
    semester: '2026/2027 · Alpha Semester',
    studentNotes: 'Bring scientific calculator for nodal matrix drill.',
    attendanceStatus: 'attended',
  },
  {
    id: 'ev-tue-2',
    title: 'Circuit Simulation Lab Prep',
    description:
      'Run LTspice DC operating point sweep and export Bode plots ahead of Thursday bench evaluation.',
    lifeArea: 'Academics',
    dayIndex: 1,
    startHour: 11.5,
    durationHours: 1.0,
    location: 'Design Commons',
    priority: 'Medium',
    mustCompleteToday: false,
    state: 'missed',
    isOfficial: false,
    backupSlot: 'Fri, Oct 30 · 4:00 PM',
  },
  {
    id: 'ev-tue-3',
    title: 'Mid-Week Chapel & Bible Study',
    description: 'Small group scripture reflection, worship, and prayer fellowship.',
    lifeArea: 'Spirituality',
    dayIndex: 1,
    startHour: 17.0,
    durationHours: 1.5,
    location: 'University Chapel',
    priority: 'Medium',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: false,
  },

  // WEDNESDAY
  {
    id: 'ev-wed-1',
    title: 'EEE 321 · Analogue Electronic Circuits I',
    description:
      'Small-signal BJT and MOSFET hybrid-pi modelling, current mirrors, and differential amplifier stages.',
    lifeArea: 'Academics',
    dayIndex: 2,
    startHour: 9.0,
    durationHours: 1.5,
    location: 'Electronics Lab 1',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: true,
    courseCode: 'EEE 321',
    lecturer: 'Marvelous Ifezue',
    semester: '2026/2027 · Alpha Semester',
    attendanceStatus: 'unrecorded',
  },
  {
    id: 'ev-wed-2',
    title: 'Personal Reading & Dentist Check-up',
    description:
      'Routine dental hygiene appointment at Campus Health Centre followed by 45 minutes of non-fiction reading.',
    lifeArea: 'Personal',
    dayIndex: 2,
    startHour: 13.0,
    durationHours: 1.5,
    location: 'Campus Medical Center',
    priority: 'Low',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: false,
  },

  // THURSDAY
  {
    id: 'ev-thu-1',
    title: 'GET 307 · Intro to AI & Machine Learning',
    description:
      'Heuristic search (A* optimality), constraint satisfaction problems, and supervised gradient descent.',
    lifeArea: 'Academics',
    dayIndex: 3,
    startHour: 10.0,
    durationHours: 2.0,
    location: 'Computer Lab 204',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: true,
    courseCode: 'GET 307',
    lecturer: 'Dr. K. Balogun',
    semester: '2026/2027 · Alpha Semester',
    attendanceStatus: 'unrecorded',
  },
  {
    id: 'ev-thu-2',
    title: 'PHY 304 · Electromagnetic Waves Lab',
    description:
      'Waveguide propagation and standing-wave ratio measurements in Physics Lab A.',
    lifeArea: 'Academics',
    dayIndex: 3,
    startHour: 14.0,
    durationHours: 1.5,
    location: 'Physics Lab A',
    priority: 'Medium',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: true,
    courseCode: 'PHY 304',
    lecturer: 'Dr. S. Nwosu',
    semester: '2026/2027 · Alpha Semester',
    attendanceStatus: 'unrecorded',
  },

  // FRIDAY (TODAY — index 4)
  {
    id: 'ev-fri-1',
    title: 'Strength & Conditioning',
    description:
      'Upper body compound lifts, core stability circuit, and 15-minute cooldown stretch.',
    lifeArea: 'Exercise',
    dayIndex: 4,
    startHour: 7.0,
    durationHours: 1.0,
    location: 'Sports Complex Gym',
    priority: 'High',
    mustCompleteToday: true,
    state: 'completed',
    isOfficial: false,
    habitSource: 'Habit · Morning 5km Jog / Strength',
    reminder: '30 mins before',
  },
  {
    id: 'ev-fri-2',
    title: 'EEE 311 · Electric Circuit Theory I',
    description:
      'Friday problem-solving lecture on Thevenin and Norton equivalents with complex phasor sources.',
    lifeArea: 'Academics',
    dayIndex: 4,
    startHour: 9.0,
    durationHours: 1.5,
    location: 'Engineering Lecture Theatre B',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: true,
    courseCode: 'EEE 311',
    lecturer: 'Marvelous Ifezue',
    semester: '2026/2027 · Alpha Semester',
    studentNotes: 'Submit Problem Set 4 before end of lecture.',
    attendanceStatus: 'unrecorded',
  },
  {
    id: 'ev-fri-3',
    title: 'Deep Work: Thevenin Problem Set 4',
    description:
      'Complete questions 1–6 in the EEE 311 workbook and verify nodal voltage equations in Python.',
    lifeArea: 'Academics',
    dayIndex: 4,
    startHour: 12.0,
    durationHours: 1.5,
    location: 'Engineering Library Pod 4',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: false,
    backupSlot: 'Sat, Oct 31 · 10:00 AM',
    reminder: '15 mins before',
  },
  {
    id: 'ev-fri-4',
    title: 'Campus Portal UI/UX Part-Time Project',
    description:
      'Deliver responsive component specs and review pull requests with the student product team.',
    lifeArea: 'Work',
    dayIndex: 4,
    startHour: 15.0,
    durationHours: 1.5,
    location: 'Remote / Co-working Lab',
    priority: 'Medium',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: false,
  },
  {
    id: 'ev-fri-5',
    title: 'Evening Quiet Reflection & Prayer',
    description:
      '20 minutes of quiet gratitude journaling, devotional reading, and evening prayer.',
    lifeArea: 'Spirituality',
    dayIndex: 4,
    startHour: 19.0,
    durationHours: 1.0,
    location: 'Residence Study Desk',
    priority: 'Low',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: false,
    habitSource: 'Habit · Quiet Reflection (Daily 7:00 PM)',
  },

  // SATURDAY
  {
    id: 'ev-sat-1',
    title: 'Weekend Long Run & Mobility',
    description:
      '8km steady-state endurance run with the university athletics club.',
    lifeArea: 'Exercise',
    dayIndex: 5,
    startHour: 8.0,
    durationHours: 1.5,
    location: 'Botanical Trail',
    priority: 'Medium',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: false,
  },
  {
    id: 'ev-sat-2',
    title: 'Grocery Restock & Meal Prep',
    description:
      'Weekly shopping and meal preparation for the upcoming academic week.',
    lifeArea: 'Personal',
    dayIndex: 5,
    startHour: 13.0,
    durationHours: 1.5,
    location: 'Student Commons Market',
    priority: 'Low',
    mustCompleteToday: false,
    state: 'default',
    isOfficial: false,
  },

  // SUNDAY
  {
    id: 'ev-sun-1',
    title: 'Sunday Worship Service',
    description: 'Morning campus fellowship and choir service.',
    lifeArea: 'Spirituality',
    dayIndex: 6,
    startHour: 9.0,
    durationHours: 2.0,
    location: 'Main Auditorium',
    priority: 'High',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: false,
  },
  {
    id: 'ev-sun-2',
    title: 'Weekly Reset & Goal Review',
    description:
      'Review upcoming academic deadlines, organise tasks, and plan next week across all 5 life areas.',
    lifeArea: 'Personal',
    dayIndex: 6,
    startHour: 16.0,
    durationHours: 1.0,
    location: 'Study Lounge',
    priority: 'Medium',
    mustCompleteToday: true,
    state: 'default',
    isOfficial: false,
  },
];

const DEFAULT_GLOSS_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.92), 0 4px 20px rgba(0, 0, 0, 0.04)';
const HOVER_GLOSS_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.98), 0 10px 28px rgba(15, 23, 42, 0.08)';

function getLifeAreaConfig(area: ScheduleLifeArea) {
  return (
    LIFE_AREAS_CONFIG.find((c) => c.id === area) ?? LIFE_AREAS_CONFIG[0]
  );
}

function formatHourAxis(hour: number): string {
  if (hour === 12) return '12:00 PM';
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

export function ScheduleManager({
  embedded = false,
  onReturnHome,
}: {
  embedded?: boolean;
  onReturnHome?: () => void;
}) {
  const navigate = useNavigate();

  // 1. Dedicated Landing Screen vs Active Scheduling Workspace
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState<boolean>(false);

  // 2. Single Shared Source of Truth for Events across Main Schedule & all 5 Sub-Schedules
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);

  // Active View: 'main' (Main Schedule) or one of the 5 Life Area Sub-Schedules
  const [activeScheduleScope, setActiveScheduleScope] = useState<
    'main' | ScheduleLifeArea
  >('main');

  // Retained Selected Date across Main Schedule and Sub-Schedules (Default: Friday, Oct 30 = index 4)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(4);

  // View Mode: 'week' or 'agenda'
  const [viewMode, setViewMode] = useState<'week' | 'agenda'>('week');

  // Focus Mode: When enabled, shows only events marked Must Complete Today
  const [focusMode, setFocusMode] = useState<boolean>(false);

  // Official Academic Timetable Sync Mode (Normal, Updated, Cancelled Class, Dropped Course, Unavailable)
  const [timetableMode, setTimetableMode] =
    useState<TimetableSyncMode>('normal');

  // Selected Event for Detail Drawer / Modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Create / Edit Event Modal State
  const [eventModalOpen, setEventModalOpen] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formLifeArea, setFormLifeArea] =
    useState<ScheduleLifeArea>('Academics');
  const [formDayIdx, setFormDayIdx] = useState<number>(4);
  const [formStartHour, setFormStartHour] = useState<number>(14);
  const [formDuration, setFormDuration] = useState<number>(1.0);
  const [formLocation, setFormLocation] = useState<string>('Study Commons');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('Medium');
  const [formMustComplete, setFormMustComplete] = useState<boolean>(false);
  const [formBackupSlot, setFormBackupSlot] = useState<string>('');
  const [formReminder, setFormReminder] = useState<string>('15 mins before');

  // Toast Feedback Banner
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleGoHome = () => {
    if (onReturnHome) {
      onReturnHome();
    } else {
      navigate('/student');
    }
  };

  const handleGoBack = () => {
    if (selectedEvent) {
      setSelectedEvent(null);
      return;
    }
    if (eventModalOpen) {
      setEventModalOpen(false);
      return;
    }
    if (activeScheduleScope !== 'main') {
      setActiveScheduleScope('main');
      return;
    }
    if (hasEnteredWorkspace) {
      setHasEnteredWorkspace(false);
      return;
    }
    handleGoHome();
  };

  // Apply Official Academic Timetable state transformations dynamically while keeping personal events intact
  const effectiveEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (timetableMode === 'unavailable' && ev.isOfficial) return false;
        if (
          timetableMode === 'dropped-course' &&
          ev.isOfficial &&
          ev.courseCode === 'GET 307'
        ) {
          return false;
        }
        return true;
      })
      .map((ev) => {
        if (
          timetableMode === 'cancelled-class' &&
          ev.isOfficial &&
          ev.courseCode === 'PHY 304'
        ) {
          return { ...ev, state: 'cancelled' as EventOutcomeState };
        }
        if (
          timetableMode === 'updated' &&
          ev.isOfficial &&
          ev.id === 'ev-fri-2'
        ) {
          return {
            ...ev,
            startHour: 10.0,
            location: 'Engineering Hall C (Updated Venue)',
          };
        }
        return ev;
      });
  }, [events, timetableMode]);

  // Filtered events for the currently active view (Main Schedule vs Life-Area Sub-Schedule + Focus Mode)
  const scopedEvents = useMemo(() => {
    return effectiveEvents.filter((ev) => {
      const matchesLifeArea =
        activeScheduleScope === 'main'
          ? true
          : ev.lifeArea === activeScheduleScope;
      if (!matchesLifeArea) return false;
      if (focusMode) {
        return ev.mustCompleteToday;
      }
      return true;
    });
  }, [effectiveEvents, activeScheduleScope, focusMode]);

  const countsByLifeArea = useMemo(() => {
    const counts: Record<ScheduleLifeArea, number> = {
      Academics: 0,
      Exercise: 0,
      Spirituality: 0,
      Personal: 0,
      Work: 0,
    };
    effectiveEvents.forEach((ev) => {
      counts[ev.lifeArea] = (counts[ev.lifeArea] ?? 0) + 1;
    });
    return counts;
  }, [effectiveEvents]);

  // Detect overlap conflicts in the Add/Edit Event form
  const conflictingEventInForm = useMemo(() => {
    const endHr = formStartHour + formDuration;
    return effectiveEvents.find((ev) => {
      if (editingEventId && ev.id === editingEventId) return false;
      if (ev.dayIndex !== formDayIdx) return false;
      if (ev.state === 'cancelled') return false;
      const evEnd = ev.startHour + ev.durationHours;
      return formStartHour < evEnd && endHr > ev.startHour;
    });
  }, [
    effectiveEvents,
    formDayIdx,
    formStartHour,
    formDuration,
    editingEventId,
  ]);

  const suggestedConflictFreeHour = useMemo(() => {
    for (let h = 7; h <= 19; h += 1) {
      const endHr = h + formDuration;
      const hasOverlap = effectiveEvents.some((ev) => {
        if (editingEventId && ev.id === editingEventId) return false;
        if (ev.dayIndex !== formDayIdx || ev.state === 'cancelled') return false;
        const evEnd = ev.startHour + ev.durationHours;
        return h < evEnd && endHr > ev.startHour;
      });
      if (!hasOverlap) return h;
    }
    return 18;
  }, [effectiveEvents, formDayIdx, formDuration, editingEventId]);

  const layoutByDay = useMemo(() => {
    const map: Record<
      string,
      { colIndex: number; totalCols: number; isOverlapping: boolean }
    > = {};

    WEEK_DAYS.forEach((_, dIdx) => {
      const dayEvts = scopedEvents
        .filter((e) => e.dayIndex === dIdx)
        .sort((a, b) => a.startHour - b.startHour);

      for (let i = 0; i < dayEvts.length; i++) {
        const a = dayEvts[i];
        const aEnd = a.startHour + Math.max(a.durationHours, 0.85);
        const overlappingGroup: CalendarEvent[] = [a];

        for (let j = 0; j < dayEvts.length; j++) {
          if (i === j) continue;
          const b = dayEvts[j];
          const bEnd = b.startHour + Math.max(b.durationHours, 0.85);
          if (a.startHour < bEnd && aEnd > b.startHour) {
            overlappingGroup.push(b);
          }
        }

        if (overlappingGroup.length > 1) {
          overlappingGroup.sort((x, y) => x.id.localeCompare(y.id));
          const idx = overlappingGroup.findIndex((x) => x.id === a.id);
          map[a.id] = {
            colIndex: idx,
            totalCols: overlappingGroup.length,
            isOverlapping: true,
          };
        } else {
          map[a.id] = {
            colIndex: 0,
            totalCols: 1,
            isOverlapping: false,
          };
        }
      }
    });

    return map;
  }, [scopedEvents]);

  const handleOpenCreateModal = (presetArea?: ScheduleLifeArea) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDesc('');
    setFormLifeArea(
      presetArea ??
        (activeScheduleScope === 'main' ? 'Academics' : activeScheduleScope)
    );
    setFormDayIdx(selectedDayIdx);
    setFormStartHour(16);
    setFormDuration(1.0);
    setFormLocation('Study Workspace');
    setFormPriority('Medium');
    setFormMustComplete(focusMode ? true : false);
    setFormBackupSlot('');
    setFormReminder('15 mins before');
    setEventModalOpen(true);
  };

  const handleOpenEditModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormTitle(ev.title);
    setFormDesc(ev.description);
    setFormLifeArea(ev.lifeArea);
    setFormDayIdx(ev.dayIndex);
    setFormStartHour(ev.startHour);
    setFormDuration(ev.durationHours);
    setFormLocation(ev.location);
    setFormPriority(ev.priority);
    setFormMustComplete(ev.mustCompleteToday);
    setFormBackupSlot(ev.backupSlot ?? '');
    setFormReminder(ev.reminder ?? '15 mins before');
    setSelectedEvent(null);
    setEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingEventId) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEventId
            ? {
                ...ev,
                title: formTitle.trim(),
                description:
                  formDesc.trim() || 'Updated personal commitment details.',
                lifeArea: formLifeArea,
                dayIndex: formDayIdx,
                startHour: formStartHour,
                durationHours: formDuration,
                location: formLocation.trim() || 'Campus Workspace',
                priority: formPriority,
                mustCompleteToday: formMustComplete,
                backupSlot: formBackupSlot.trim() || undefined,
                reminder: formReminder,
              }
            : ev
        )
      );
      setSelectedDayIdx(formDayIdx);
      showToast(
        `Updated "${formTitle.trim()}" across Main & ${formLifeArea} schedules`
      );
    } else {
      const created: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: formTitle.trim(),
        description:
          formDesc.trim() ||
          `Scheduled under ${formLifeArea} in your unified Schedule Manager.`,
        lifeArea: formLifeArea,
        dayIndex: formDayIdx,
        startHour: formStartHour,
        durationHours: formDuration,
        location: formLocation.trim() || 'Campus Workspace',
        priority: formPriority,
        mustCompleteToday: formMustComplete,
        state: 'default',
        isOfficial: false,
        backupSlot: formBackupSlot.trim() || undefined,
        reminder: formReminder,
      };
      setEvents((prev) => [...prev, created]);
      setSelectedDayIdx(formDayIdx);
      showToast(`Added "${created.title}" to ${formLifeArea} & Main Schedule`);
    }

    setEventModalOpen(false);
  };

  const handleToggleComplete = (target: CalendarEvent) => {
    if (target.isOfficial) return;
    const nextState: EventOutcomeState =
      target.state === 'completed' ? 'default' : 'completed';
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === target.id ? { ...ev, state: nextState } : ev
      )
    );
    setSelectedEvent((prev) =>
      prev && prev.id === target.id ? { ...prev, state: nextState } : prev
    );
    showToast(
      nextState === 'completed'
        ? `Marked "${target.title}" as completed`
        : `Reopened "${target.title}"`
    );
  };

  const handleDeleteEvent = (target: CalendarEvent) => {
    if (target.isOfficial) return;
    setEvents((prev) => prev.filter((ev) => ev.id !== target.id));
    setSelectedEvent(null);
    showToast(`Deleted "${target.title}" from your schedule`);
  };

  const handleCreateOfficialCatchUp = (officialEv: CalendarEvent) => {
    const catchUp: CalendarEvent = {
      id: `ev-catchup-${Date.now()}`,
      title: `Catch-up Study: ${officialEv.courseCode ?? officialEv.title}`,
      description: `Personal review session covering lecture material from ${officialEv.title}. (Official lecture remains fixed on registrar timetable.)`,
      lifeArea: 'Academics',
      dayIndex: selectedDayIdx,
      startHour: 16.5,
      durationHours: 1.0,
      location: 'Engineering Library',
      priority: 'High',
      mustCompleteToday: true,
      state: 'default',
      isOfficial: false,
      reminder: '15 mins before',
    };
    setEvents((prev) => [...prev, catchUp]);
    setSelectedEvent(null);
    showToast(
      `Created personal catch-up activity for ${
        officialEv.courseCode ?? officialEv.title
      }`
    );
  };

  const activeDayObj = WEEK_DAYS[selectedDayIdx] ?? WEEK_DAYS[4];
  const activeSubScheduleMeta =
    activeScheduleScope !== 'main'
      ? getLifeAreaConfig(activeScheduleScope)
      : null;

  // ============================================================================
  // 1. DEDICATED SCHEDULE MANAGER LANDING SCREEN
  // ============================================================================
  if (!hasEnteredWorkspace) {
    const todayPreviewEvents = effectiveEvents
      .filter((e) => e.dayIndex === selectedDayIdx)
      .sort((a, b) => a.startHour - b.startHour);

    return (
      <div
        className={`${
          embedded
            ? 'min-h-[780px] rounded-[24px] shadow-[0_12px_36px_rgba(15,23,42,0.08)] border border-white/60'
            : 'min-h-screen'
        } w-full bg-gradient-to-br from-[#F6F8FC] via-[#F1F5F9] to-[#EAF0F8] text-[#0F172A] font-sans antialiased flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden`}
      >
        <div className="pointer-events-none absolute -top-24 left-1/4 w-[480px] h-[300px] rounded-full bg-sky-200/35 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 w-[440px] h-[300px] rounded-full bg-indigo-200/30 blur-[110px]" />

        {/* Top Navigation Bar: Back and Home buttons */}
        <div className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleGoHome}
              style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
              className="px-3.5 py-2 rounded-xl bg-white/85 hover:bg-white text-[13px] font-semibold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
              className="px-3.5 py-2 rounded-xl bg-white/85 hover:bg-white text-[13px] font-semibold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#2563EB]" />
              <span>Home</span>
            </button>
          </div>

          <span className="px-3 py-1 rounded-full bg-[#111318] text-white text-[11.5px] font-semibold tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
            2026/2027 · Alpha Semester Synced
          </span>
        </div>

        {/* Center Hero & Purposeful Weekly Schedule Preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: SOFT_EASE_OUT }}
          className="relative z-10 max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-[#2563EB] text-[12px] font-bold tracking-wide uppercase">
              <CalendarDays className="w-3.5 h-3.5" />
              Unified Academic &amp; Personal Planner
            </div>

            <div className="space-y-3">
              <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight text-[#0F172A] leading-[1.15]">
                Your Schedule Manager
              </h1>
              <p className="text-[15.5px] text-slate-600 leading-relaxed max-w-lg">
                Organise your <strong>academics</strong>, <strong>exercise</strong>,{' '}
                <strong>spirituality</strong>, <strong>personal activities</strong>{' '}
                and <strong>work</strong> in one synchronised workspace—with your official university timetable built right in.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {LIFE_AREAS_CONFIG.map((area) => {
                const Icon = area.icon;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => {
                      setActiveScheduleScope(area.id);
                      setHasEnteredWorkspace(true);
                    }}
                    style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                    className="px-3 py-2 rounded-xl bg-white/85 hover:bg-white text-[12.5px] font-semibold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span
                      style={{ backgroundColor: area.dotColor }}
                      className="w-2 h-2 rounded-full"
                    />
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    <span>{area.label}</span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {countsByLifeArea[area.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15, ease: SOFT_EASE_OUT }}
                type="button"
                onClick={() => {
                  setActiveScheduleScope('main');
                  setHasEnteredWorkspace(true);
                }}
                style={{
                  boxShadow:
                    'inset 0 1px 0 0 rgba(255,255,255,0.35), 0 10px 28px -4px rgba(37, 99, 235, 0.45)',
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white text-[15px] font-semibold flex items-center gap-2.5 cursor-pointer"
              >
                <span>Enter Schedule Manager</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              <button
                type="button"
                onClick={() => {
                  setActiveScheduleScope('main');
                  setHasEnteredWorkspace(true);
                  handleOpenCreateModal();
                }}
                style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                className="px-4 py-3.5 rounded-2xl bg-white/85 hover:bg-white text-[14px] font-semibold text-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#2563EB]" />
                <span>Quick Add Event</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div
              style={{
                boxShadow:
                  'inset 0 1px 0 0 rgba(255,255,255,0.95), 0 20px 44px rgba(15, 23, 42, 0.08)',
              }}
              className="rounded-[24px] bg-white/80 backdrop-blur-xl p-6 space-y-5 border border-white/60"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                    Today’s Schedule Preview
                  </span>
                  <h2 className="text-[18px] font-bold text-[#0F172A] mt-0.5">
                    {activeDayObj.full}
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700">
                  {todayPreviewEvents.length} commitments
                </span>
              </div>

              <div className="space-y-2.5">
                {todayPreviewEvents.slice(0, 4).map((ev) => {
                  const areaCfg = getLifeAreaConfig(ev.lifeArea);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setHasEnteredWorkspace(true);
                        setSelectedEvent(ev);
                      }}
                      style={{
                        background: areaCfg.cardBg,
                        boxShadow: DEFAULT_GLOSS_SHADOW,
                        borderLeft: `3px solid ${areaCfg.accentBorder}`,
                      }}
                      className="p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:brightness-[0.99] transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${areaCfg.badgeBg} ${areaCfg.badgeText}`}
                          >
                            {ev.isOfficial ? 'Official Class' : ev.lifeArea}
                          </span>
                          <span className="text-[11.5px] font-semibold text-slate-500 tabular-nums">
                            {formatTimeRange(ev.startHour, ev.durationHours)}
                          </span>
                        </div>
                        <p className="text-[13.5px] font-bold text-[#0F172A] truncate mt-1">
                          {ev.title}
                        </p>
                        <p className="text-[11.5px] text-slate-500 truncate">
                          {ev.location}
                        </p>
                      </div>

                      {ev.state === 'completed' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-bold shrink-0">
                          Completed
                        </span>
                      ) : ev.mustCompleteToday ? (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-[#2563EB] text-[11px] font-bold shrink-0">
                          Focus
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500">
                <span>
                  Total this week:{' '}
                  <strong>{effectiveEvents.length} scheduled events</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setHasEnteredWorkspace(true)}
                  className="text-[#2563EB] font-semibold hover:underline cursor-pointer"
                >
                  Open full calendar →
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 max-w-5xl w-full mx-auto text-center sm:text-left text-[12px] text-slate-400">
          All changes synchronize automatically between your Main Schedule and Life-Area Sub-Schedules.
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. MAIN SCHEDULING WORKSPACE (MINIMAL DARK SIDEBAR + CONNECTED VIEWS)
  // ============================================================================
  return (
    <div
      className={`${
        embedded
          ? 'h-[840px] rounded-[24px] shadow-[0_12px_36px_rgba(15,23,42,0.08)] border border-white/60'
          : 'h-screen'
      } w-full overflow-hidden flex flex-col lg:flex-row bg-[#F3F5F9] text-[#0F172A] font-sans antialiased select-none relative`}
    >
      {/* LEFT SIDEBAR (DARK, STRICTLY MINIMAL & PURPOSEFUL — NO NESTED SCROLL) */}
      <aside className="hidden lg:flex w-[248px] shrink-0 h-full bg-[#111318] text-white flex-col justify-between p-5 overflow-hidden relative z-20 shadow-[8px_0_32px_rgba(0,0,0,0.10)]">
        <div className="space-y-6">
          {/* Back & Home Navigation Buttons */}
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/[0.08]">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[12.5px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Return to previous view"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[12.5px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Return to main application dashboard"
            >
              <Home className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Home</span>
            </button>
          </div>

          {/* Primary Section: Main Schedule */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Overview
            </span>
            <button
              type="button"
              onClick={() => setActiveScheduleScope('main')}
              className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[13.5px] font-medium transition-colors cursor-pointer ${
                activeScheduleScope === 'main'
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {activeScheduleScope === 'main' && (
                <motion.div
                  layoutId="schedule-minimal-sidebar-pill"
                  transition={{ duration: 0.25, ease: SOFT_EASE_OUT }}
                  style={{
                    boxShadow:
                      'inset 0 1px 0 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.25)',
                  }}
                  className="absolute inset-0 rounded-2xl bg-[#2563EB]"
                />
              )}
              <div className="relative z-10 flex items-center gap-3">
                <CalendarIcon className="w-4 h-4" />
                <span>Main Schedule</span>
              </div>
              <span
                className={`relative z-10 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  activeScheduleScope === 'main'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {effectiveEvents.length}
              </span>
            </button>
          </div>

          {/* Life Areas Sub-Schedules */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Life Areas
            </span>
            <nav className="space-y-1">
              {LIFE_AREAS_CONFIG.map((area) => {
                const isSelected = activeScheduleScope === area.id;
                const Icon = area.icon;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setActiveScheduleScope(area.id)}
                    className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[13.5px] font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="schedule-minimal-sidebar-pill"
                        transition={{ duration: 0.25, ease: SOFT_EASE_OUT }}
                        style={{
                          boxShadow:
                            'inset 0 1px 0 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.25)',
                        }}
                        className="absolute inset-0 rounded-2xl bg-[#2563EB]"
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-3">
                      <span
                        style={{ backgroundColor: area.dotColor }}
                        className="w-2 h-2 rounded-full shrink-0"
                      />
                      <Icon className="w-4 h-4" />
                      <span>{area.label}</span>
                    </div>
                    <span
                      className={`relative z-10 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {countsByLifeArea[area.id]}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Minimal Footer: Official Academic Timetable Sync Status Selector */}
        <div className="pt-4 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Academic Timetable</span>
            <span className="text-[#38BDF8] font-semibold capitalize">
              {timetableMode.replace('-', ' ')}
            </span>
          </div>
          <select
            value={timetableMode}
            onChange={(e) =>
              setTimetableMode(e.target.value as TimetableSyncMode)
            }
            aria-label="Official Academic Timetable Status"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.06] text-[12px] font-medium text-slate-200 border border-white/[0.08] focus:outline-none cursor-pointer"
          >
            <option value="normal" className="bg-[#111318]">
              Official Timetable: Synced
            </option>
            <option value="updated" className="bg-[#111318]">
              Official Timetable: Updated
            </option>
            <option value="cancelled-class" className="bg-[#111318]">
              Official Class: Cancelled
            </option>
            <option value="dropped-course" className="bg-[#111318]">
              Official Course: Dropped (GET 307)
            </option>
            <option value="unavailable" className="bg-[#111318]">
              Official Timetable: Unavailable
            </option>
          </select>
        </div>
      </aside>

      {/* MOBILE & TABLET COMPACT NAVIGATION BAR (< lg) */}
      <div className="lg:hidden bg-[#111318] text-white px-4 py-3 flex flex-col gap-2.5 shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] text-[12px] font-semibold flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] text-[12px] font-semibold flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Home</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveScheduleScope('main')}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${
              activeScheduleScope === 'main'
                ? 'bg-[#2563EB] text-white'
                : 'bg-white/[0.06] text-slate-300'
            }`}
          >
            Main Schedule ({effectiveEvents.length})
          </button>
          {LIFE_AREAS_CONFIG.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setActiveScheduleScope(area.id)}
              className={`px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                activeScheduleScope === area.id
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white/[0.06] text-slate-300'
              }`}
            >
              <span
                style={{ backgroundColor: area.dotColor }}
                className="w-1.5 h-1.5 rounded-full"
              />
              <span>
                {area.label} ({countsByLifeArea[area.id]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CALENDAR WORKSPACE (LIGHT MODE) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gradient-to-br from-[#F5F7FB] via-[#F1F4F9] to-[#EEF2F8]">
        {/* TOP WORKSPACE HEADER */}
        <header
          style={{
            boxShadow:
              'inset 0 1px 0 0 rgba(255,255,255,0.85), 0 4px 20px rgba(0,0,0,0.03)',
          }}
          className="relative z-10 px-6 py-4 bg-white/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 shrink-0"
        >
          <div className="flex flex-wrap items-center gap-4">
            {activeScheduleScope !== 'main' && (
              <button
                type="button"
                onClick={() => setActiveScheduleScope('main')}
                style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                className="px-3 py-1.5 rounded-xl bg-white text-[12.5px] font-semibold text-[#2563EB] hover:bg-blue-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Main Schedule</span>
              </button>
            )}

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#0F172A]">
                  {activeScheduleScope === 'main'
                    ? 'Main Schedule'
                    : `${activeScheduleScope} Schedule`}
                </h1>
                <span className="text-slate-300">·</span>
                <span className="text-[14px] font-semibold text-[#2563EB]">
                  {activeDayObj.full}
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                {activeSubScheduleMeta
                  ? activeSubScheduleMeta.description
                  : 'Unified overview across Academics, Exercise, Spirituality, Personal and Work.'}
              </p>
            </div>

            {/* Date Navigation Arrows + Today Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDayIdx((d) => (d - 1 + 7) % 7)}
                style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center text-slate-600 cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayIdx(4)}
                style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
                  selectedDayIdx === 4
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white/90 text-[#0F172A] hover:bg-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayIdx((d) => (d + 1) % 7)}
                style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center text-slate-600 cursor-pointer"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Focus Mode Toggle */}
            <button
              type="button"
              onClick={() => setFocusMode((f) => !f)}
              style={{
                boxShadow: focusMode
                  ? 'inset 0 1px 0 0 rgba(255,255,255,0.95), 0 6px 20px rgba(37, 99, 235, 0.18)'
                  : DEFAULT_GLOSS_SHADOW,
              }}
              className={`px-3.5 py-2 rounded-2xl text-[12.5px] font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                focusMode
                  ? 'bg-white text-[#2563EB] ring-1 ring-[#2563EB]/30'
                  : 'bg-white/80 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame
                className={`w-4 h-4 ${
                  focusMode ? 'text-[#2563EB] fill-[#2563EB]/20' : 'text-slate-400'
                }`}
              />
              <span>Focus Mode</span>
              <div
                className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                  focusMode
                    ? 'bg-[#2563EB] justify-end'
                    : 'bg-slate-300 justify-start'
                }`}
              >
                <motion.div
                  layout
                  transition={{ duration: 0.2, ease: SOFT_EASE_OUT }}
                  className="w-3 h-3 rounded-full bg-white"
                />
              </div>
            </button>

            {/* Week / Agenda View Segmented Toggle */}
            <div className="p-1 rounded-2xl bg-slate-200/70 flex items-center">
              {(['week', 'agenda'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold capitalize transition-colors cursor-pointer ${
                      active
                        ? 'text-[#0F172A]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="schedule-view-mode-pill"
                        transition={{ duration: 0.22, ease: SOFT_EASE_OUT }}
                        style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                        className="absolute inset-0 rounded-xl bg-white"
                      />
                    )}
                    <span className="relative z-10">{mode}</span>
                  </button>
                );
              })}
            </div>

            {/* Prominent "+ Add Event" Button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12 }}
              type="button"
              onClick={() => handleOpenCreateModal()}
              style={{
                boxShadow:
                  'inset 0 1px 0 0 rgba(255, 255, 255, 0.35), 0 8px 20px -4px rgba(37, 99, 235, 0.42)',
              }}
              className="px-4 py-2 rounded-2xl bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Event</span>
            </motion.button>
          </div>
        </header>

        {/* OFFICIAL ACADEMIC TIMETABLE STATUS BANNERS */}
        <AnimatePresence>
          {timetableMode === 'unavailable' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 py-2.5 bg-amber-50 border-b border-amber-200/80 text-amber-900 text-[12.5px] flex flex-wrap items-center justify-between gap-3 shrink-0"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Official Academic Timetable Unavailable:</strong> Could not reach the university registrar feed. Your personal schedule is still active—this does not mean you have no classes.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTimetableMode('normal');
                  showToast('Official Academic Timetable re-synced');
                }}
                className="px-3 py-1 rounded-lg bg-amber-600 text-white text-[11.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Timetable Sync</span>
              </button>
            </motion.div>
          )}

          {timetableMode === 'updated' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 py-2 bg-blue-50 border-b border-blue-200/70 text-blue-900 text-[12.5px] flex items-center justify-between gap-3 shrink-0"
            >
              <span>
                <strong>Timetable Updated:</strong> EEE 311 (Friday) was moved to 10:00 AM in Engineering Hall C by the Department.
              </span>
              <button
                type="button"
                onClick={() => setTimetableMode('normal')}
                className="text-[11.5px] font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN SCHEDULE: 5 SMALL LIFE-AREA SUMMARY CARDS */}
        {activeScheduleScope === 'main' && (
          <div className="px-6 pt-3 pb-1 grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
            {LIFE_AREAS_CONFIG.map((area) => {
              const Icon = area.icon;
              const count = countsByLifeArea[area.id];
              return (
                <motion.button
                  key={area.id}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setActiveScheduleScope(area.id)}
                  style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                  className="p-2.5 rounded-2xl bg-white/80 hover:bg-white backdrop-blur-md flex items-center justify-between gap-2 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      style={{ backgroundColor: area.dotColor }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#0F172A] truncate">
                        {area.label}
                      </p>
                      <p className="text-[10.5px] text-slate-500">
                        {count} {count === 1 ? 'event' : 'events'}
                      </p>
                    </div>
                  </div>
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                </motion.button>
              );
            })}
          </div>
        )}

        {/* FOCUS MODE ACTIVE BANNER */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 pt-2 shrink-0"
            >
              <div className="px-4 py-2 rounded-xl bg-[#2563EB]/10 text-[#1E40AF] text-[12.5px] font-medium flex items-center justify-between">
                <span>
                  <strong>Focus Mode Enabled:</strong> Showing only commitments explicitly marked <strong>Must Complete Today</strong>. (Priority remains a separate setting.)
                </span>
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  className="text-[12px] font-bold underline cursor-pointer ml-3"
                >
                  Show full schedule
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CALENDAR / AGENDA BODY */}
        <div className="relative z-10 flex-1 flex flex-col min-h-0 px-6 pb-5 pt-2.5">
          <div
            style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
            className="flex-1 bg-white/70 backdrop-blur-xl rounded-[24px] flex flex-col overflow-hidden"
          >
            {/* Sticky Day Column Selector Strip (Mon 26 – Sun 1) */}
            <div className="flex bg-white/85 backdrop-blur-md border-b border-slate-200/50 shrink-0">
              {viewMode === 'week' && (
                <div className="w-16 shrink-0 hidden sm:flex items-center justify-center text-[10.5px] font-semibold text-slate-400">
                  TIME
                </div>
              )}
              <div className="flex-1 grid grid-cols-7">
                {WEEK_DAYS.map((day) => {
                  const isSelected = selectedDayIdx === day.index;
                  const dayCount = scopedEvents.filter(
                    (e) => e.dayIndex === day.index
                  ).length;
                  return (
                    <button
                      key={day.short}
                      type="button"
                      onClick={() => setSelectedDayIdx(day.index)}
                      className={`py-3 px-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-white/60'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            isSelected ? 'text-[#2563EB]' : 'text-slate-400'
                          }`}
                        >
                          {day.short}
                        </span>
                        {day.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                        )}
                      </div>
                      <span
                        className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.32)]'
                            : 'text-[#0F172A]'
                        }`}
                      >
                        {day.date}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {dayCount} {dayCount === 1 ? 'item' : 'items'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EMPTY STATES */}
            {scopedEvents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
                  {focusMode ? (
                    <Flame className="w-6 h-6" />
                  ) : (
                    <CalendarIcon className="w-6 h-6" />
                  )}
                </div>
                <h3 className="text-[18px] font-bold text-[#0F172A]">
                  {focusMode
                    ? 'No Focus Commitments Marked'
                    : activeScheduleScope === 'main'
                    ? 'Your Schedule is Empty'
                    : `No ${activeScheduleScope} Events Scheduled`}
                </h3>
                <p className="text-[13.5px] text-slate-500 mt-1.5 mb-5 leading-relaxed">
                  {focusMode
                    ? 'There are no events explicitly marked "Must Complete Today" in this view. Disable Focus Mode to see your full schedule, or add a focus commitment.'
                    : `Add an activity under ${
                        activeScheduleScope === 'main'
                          ? 'any life area'
                          : activeScheduleScope
                      } and it will automatically sync with your Main Schedule.`}
                </p>
                <div className="flex items-center gap-2.5">
                  {focusMode && (
                    <button
                      type="button"
                      onClick={() => setFocusMode(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-700 cursor-pointer"
                    >
                      Disable Focus Mode
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Event</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'agenda' ? (
              /* AGENDA VIEW */
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {WEEK_DAYS.map((day) => {
                  const dayEvts = scopedEvents
                    .filter((e) => e.dayIndex === day.index)
                    .sort((a, b) => a.startHour - b.startHour);
                  if (dayEvts.length === 0) return null;
                  const isSelectedDay = day.index === selectedDayIdx;

                  return (
                    <div
                      key={day.short}
                      style={{ boxShadow: DEFAULT_GLOSS_SHADOW }}
                      className={`rounded-2xl p-4 transition-colors ${
                        isSelectedDay
                          ? 'bg-white ring-1 ring-[#2563EB]/25'
                          : 'bg-white/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-[#0F172A]">
                            {day.full}
                          </span>
                          {day.isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold uppercase">
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-[12px] text-slate-400 font-medium">
                          {dayEvts.length}{' '}
                          {dayEvts.length === 1 ? 'commitment' : 'commitments'}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {dayEvts.map((ev) => {
                          const areaCfg = getLifeAreaConfig(ev.lifeArea);
                          const isCompleted = ev.state === 'completed';
                          const isMissed = ev.state === 'missed';
                          const isCancelled = ev.state === 'cancelled';

                          return (
                            <motion.div
                              key={ev.id}
                              whileHover={{ y: -1 }}
                              onClick={() => {
                                setSelectedDayIdx(ev.dayIndex);
                                setSelectedEvent(ev);
                              }}
                              style={{
                                background: areaCfg.cardBg,
                                borderLeft: `4px solid ${areaCfg.accentBorder}`,
                                boxShadow: DEFAULT_GLOSS_SHADOW,
                              }}
                              className="p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase ${areaCfg.badgeBg} ${areaCfg.badgeText}`}
                                  >
                                    {ev.isOfficial
                                      ? 'Official Class'
                                      : ev.lifeArea}
                                  </span>
                                  <span
                                    className={`text-[12px] font-semibold text-slate-600 tabular-nums ${
                                      isCancelled ? 'line-through' : ''
                                    }`}
                                  >
                                    {formatTimeRange(
                                      ev.startHour,
                                      ev.durationHours
                                    )}
                                  </span>
                                  {ev.mustCompleteToday && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-[#2563EB] text-[10.5px] font-bold">
                                      Must Complete Today
                                    </span>
                                  )}
                                  {ev.habitSource && (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-900/5 text-slate-600 text-[10.5px] font-medium">
                                      {ev.habitSource}
                                    </span>
                                  )}
                                </div>

                                <h4
                                  className={`text-[14.5px] font-bold text-[#0F172A] ${
                                    isCompleted || isCancelled
                                      ? 'line-through opacity-70'
                                      : ''
                                  }`}
                                >
                                  {ev.title}
                                </h4>
                                <p className="text-[12.5px] text-slate-600 line-clamp-1">
                                  {ev.location} · {ev.description}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isCancelled ? (
                                  <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                                    Cancelled
                                  </span>
                                ) : isMissed ? (
                                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                                    Missed · Reschedule
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                    ✓ Completed
                                  </span>
                                ) : !ev.isOfficial ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(ev);
                                    }}
                                    className="px-3 py-1 rounded-xl bg-white/90 hover:bg-emerald-500 hover:text-white text-slate-700 text-[11.5px] font-semibold transition-colors cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                ) : null}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* WEEKLY CALENDAR GRID VIEW */
              <div className="flex-1 overflow-y-auto relative">
                <div
                  className="flex relative"
                  style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
                >
                  <div className="w-16 shrink-0 hidden sm:block select-none relative border-r border-slate-200/40">
                    {HOURS.map((hour, hIdx) => (
                      <div
                        key={hour}
                        style={{
                          top: `${hIdx * HOUR_HEIGHT}px`,
                          height: `${HOUR_HEIGHT}px`,
                        }}
                        className="absolute inset-x-0 flex items-start justify-end pr-2.5 pt-1"
                      >
                        <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
                          {formatHourAxis(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 grid grid-cols-7 relative">
                    {WEEK_DAYS.map((day) => (
                      <div
                        key={day.short}
                        onClick={() => setSelectedDayIdx(day.index)}
                        className={`relative border-l first:border-l-0 border-slate-200/40 ${
                          selectedDayIdx === day.index ? 'bg-blue-50/[0.22]' : ''
                        }`}
                      >
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            style={{ height: `${HOUR_HEIGHT}px` }}
                            className="border-b border-slate-200/35"
                          />
                        ))}
                      </div>
                    ))}

                    {scopedEvents.map((ev) => {
                      const areaCfg = getLifeAreaConfig(ev.lifeArea);
                      const overlapInfo = layoutByDay[ev.id] ?? {
                        colIndex: 0,
                        totalCols: 1,
                        isOverlapping: false,
                      };

                      const dayColWidthPct = 100 / 7;
                      const subColWidthPct =
                        dayColWidthPct / overlapInfo.totalCols;
                      const leftPct =
                        ev.dayIndex * dayColWidthPct +
                        overlapInfo.colIndex * subColWidthPct;

                      const topPx = (ev.startHour - 6) * HOUR_HEIGHT + 2;
                      const heightPx = Math.max(
                        66,
                        ev.durationHours * HOUR_HEIGHT - 4
                      );

                      const isCompleted = ev.state === 'completed';
                      const isMissed = ev.state === 'missed';
                      const isCancelled = ev.state === 'cancelled';

                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{
                            opacity: isMissed || isCancelled ? 0.65 : 1,
                            y: 0,
                          }}
                          whileHover={{
                            y: -2,
                            boxShadow: HOVER_GLOSS_SHADOW,
                            zIndex: 25,
                          }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.22, ease: SOFT_EASE_OUT }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayIdx(ev.dayIndex);
                            setSelectedEvent(ev);
                          }}
                          style={{
                            top: `${topPx}px`,
                            left: `calc(${leftPct}% + 3px)`,
                            width: `calc(${subColWidthPct}% - 6px)`,
                            height: `${heightPx}px`,
                            minHeight: '66px',
                            background: areaCfg.cardBg,
                            borderLeft: `3.5px solid ${areaCfg.accentBorder}`,
                            backdropFilter: 'blur(14px)',
                            boxShadow: DEFAULT_GLOSS_SHADOW,
                          }}
                          className="absolute z-10 rounded-[14px] p-2.5 flex flex-col justify-between cursor-pointer overflow-hidden"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide truncate ${areaCfg.badgeBg} ${areaCfg.badgeText}`}
                              >
                                {ev.isOfficial ? 'Official Class' : ev.lifeArea}
                              </span>

                              {ev.isOfficial && (
                                <Presentation className="w-3 h-3 text-sky-700 shrink-0" />
                              )}
                            </div>

                            <h3
                              className={`text-[12px] font-bold text-[#0F172A] leading-tight truncate mt-1 ${
                                isCompleted || isCancelled ? 'line-through' : ''
                              }`}
                            >
                              {ev.title}
                            </h3>
                            <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5 tabular-nums">
                              {formatTimeRange(ev.startHour, ev.durationHours)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-auto pt-1">
                            {isCancelled ? (
                              <span className="text-[9.5px] font-bold text-red-600">
                                Cancelled
                              </span>
                            ) : isMissed ? (
                              <span className="text-[9.5px] font-bold text-amber-700">
                                Missed · Reschedule
                              </span>
                            ) : isCompleted ? (
                              <span className="text-[9.5px] font-bold text-emerald-700">
                                ✓ Completed
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-slate-500 truncate">
                                {ev.location}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subtle Toast Notification */}
        <AnimatePresence>
          {feedbackToast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-5 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-[13px] font-medium shadow-xl flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
              <span>{feedbackToast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL 1: COMPLETE EVENT DETAILS & MANAGEMENT */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEvent(null)}
            className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ duration: 0.22, ease: SOFT_EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow:
                  'inset 0 1px 0 0 rgba(255,255,255,0.95), 0 24px 48px rgba(15, 23, 42, 0.16)',
              }}
              className="w-full max-w-lg rounded-[24px] bg-white p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-[12.5px] font-semibold text-slate-600 hover:text-[#0F172A] flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Schedule</span>
                </button>

                <div className="flex items-center gap-2">
                  {selectedEvent.isOfficial ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-900 text-[11px] font-bold uppercase">
                      <Presentation className="w-3.5 h-3.5" />
                      Official Class
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                      {selectedEvent.lifeArea}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                    Priority: {selectedEvent.priority}
                  </span>
                  {selectedEvent.mustCompleteToday && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-[#2563EB] text-[11px] font-bold">
                      Must Complete Today
                    </span>
                  )}
                  {selectedEvent.state === 'cancelled' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                      Cancelled by Faculty
                    </span>
                  )}
                </div>

                <h3 className="text-[20px] font-bold text-[#0F172A]">
                  {selectedEvent.title}
                </h3>
                <p className="text-[13.5px] font-medium text-[#2563EB]">
                  {WEEK_DAYS[selectedEvent.dayIndex]?.full} ·{' '}
                  {formatTimeRange(
                    selectedEvent.startHour,
                    selectedEvent.durationHours
                  )}
                </p>
                <p className="text-[13.5px] text-slate-600 leading-relaxed pt-1">
                  {selectedEvent.description}
                </p>
              </div>

              {selectedEvent.isOfficial ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 text-[12.5px]">
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Course Code
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.courseCode ?? 'EEE 311'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Lecturer
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.lecturer ?? 'Marvelous Ifezue'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Venue
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.location}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Semester
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.semester ?? '2026/2027 · Alpha'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                        Personal Student Record (Separate from Official Class)
                      </span>
                      <span className="text-[11.5px] font-semibold text-slate-500 capitalize">
                        Outcome: {selectedEvent.attendanceStatus ?? 'unrecorded'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(['attended', 'missed', 'unrecorded'] as const).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setEvents((prev) =>
                                prev.map((ev) =>
                                  ev.id === selectedEvent.id
                                    ? { ...ev, attendanceStatus: st }
                                    : ev
                                )
                              );
                              setSelectedEvent((prev) =>
                                prev ? { ...prev, attendanceStatus: st } : null
                              );
                            }}
                            className={`px-3 py-1 rounded-xl text-[12px] font-semibold capitalize cursor-pointer ${
                              (selectedEvent.attendanceStatus ?? 'unrecorded') ===
                              st
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {st}
                          </button>
                        )
                      )}
                    </div>

                    {selectedEvent.attendanceStatus === 'missed' && (
                      <div className="p-3 rounded-xl bg-blue-50 text-[12.5px] text-blue-900 flex items-center justify-between gap-3">
                        <span>
                          Official lectures cannot be moved. Schedule a personal catch-up study session instead?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCreateOfficialCatchUp(selectedEvent)
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white font-semibold shrink-0 cursor-pointer"
                        >
                          + Catch-up Session
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 text-[12.5px]">
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Location
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.location}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        Reminder
                      </span>
                      <span className="font-bold text-[#0F172A]">
                        {selectedEvent.reminder ?? '15 mins before'}
                      </span>
                    </div>
                    {selectedEvent.backupSlot && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-semibold block">
                          Backup Date &amp; Time
                        </span>
                        <span className="font-bold text-[#2563EB]">
                          {selectedEvent.backupSlot}
                        </span>
                      </div>
                    )}
                    {selectedEvent.habitSource && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-semibold block">
                          Habit Source
                        </span>
                        <span className="font-bold text-[#0F172A]">
                          {selectedEvent.habitSource}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(selectedEvent)}
                      className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(selectedEvent)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit / Reschedule</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(selectedEvent)}
                        className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {selectedEvent.state === 'completed'
                            ? 'Mark Incomplete'
                            : 'Mark Completed'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD / EDIT EVENT */}
      <AnimatePresence>
        {eventModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEventModalOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ duration: 0.22, ease: SOFT_EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow:
                  'inset 0 1px 0 0 rgba(255,255,255,0.95), 0 24px 48px rgba(15, 23, 42, 0.16)',
              }}
              className="w-full max-w-lg rounded-[24px] bg-white p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-[18px] font-bold text-[#0F172A]">
                    {editingEventId ? 'Edit Event' : 'Add New Event'}
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Synchronizes automatically between Main Schedule and {formLifeArea}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3.5">
                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Event Summary / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Leg Day Workout or Thesis Chapter Draft"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 text-[13.5px] text-[#0F172A] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Detailed Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Add agenda notes, preparation steps, or location details..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 text-[13px] text-[#0F172A] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Life Area
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {LIFE_AREAS_CONFIG.map((area) => {
                      const active = formLifeArea === area.id;
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => setFormLifeArea(area.id)}
                          className={`py-2 px-2 rounded-xl text-[11.5px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            active
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>{area.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Date
                    </label>
                    <select
                      value={formDayIdx}
                      onChange={(e) => setFormDayIdx(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 text-[12.5px] font-medium text-[#0F172A]"
                    >
                      {WEEK_DAYS.map((d) => (
                        <option key={d.short} value={d.index}>
                          {d.short}, Oct {d.date}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Start Time
                    </label>
                    <select
                      value={formStartHour}
                      onChange={(e) => setFormStartHour(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 text-[12.5px] font-medium text-[#0F172A]"
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourAxis(h)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Duration
                    </label>
                    <select
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 text-[12.5px] font-medium text-[#0F172A]"
                    >
                      <option value={0.5}>30 mins</option>
                      <option value={1}>1 hour</option>
                      <option value={1.5}>1.5 hours</option>
                      <option value={2}>2 hours</option>
                    </select>
                  </div>
                </div>

                {conflictingEventInForm && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12px] flex items-center justify-between gap-2">
                    <div>
                      <strong>Schedule Overlap Detected:</strong> Conflicts with{' '}
                      <strong>{conflictingEventInForm.title}</strong> (
                      {formatTimeRange(
                        conflictingEventInForm.startHour,
                        conflictingEventInForm.durationHours
                      )}
                      ).
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormStartHour(suggestedConflictFreeHour)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-semibold shrink-0 cursor-pointer"
                    >
                      Choose {formatHourAxis(suggestedConflictFreeHour)}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Priority Level
                    </label>
                    <div className="flex gap-1.5">
                      {(['High', 'Medium', 'Low'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormPriority(p)}
                          className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer ${
                            formPriority === p
                              ? 'bg-[#0F172A] text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Focus Mode Inclusion
                    </label>
                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/70 text-[12.5px] font-semibold text-[#1E40AF] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formMustComplete}
                        onChange={(e) => setFormMustComplete(e.target.checked)}
                      />
                      <span>Must Complete Today</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Optional Backup Date &amp; Time
                    </label>
                    <input
                      type="text"
                      value={formBackupSlot}
                      onChange={(e) => setFormBackupSlot(e.target.value)}
                      placeholder="e.g., Sat, Oct 31 · 10:00 AM"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-100 text-[12.5px] text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Reminder Setting
                    </label>
                    <select
                      value={formReminder}
                      onChange={(e) => setFormReminder(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-100 text-[12.5px] text-[#0F172A]"
                    >
                      <option value="15 mins before">15 mins before</option>
                      <option value="30 mins before">30 mins before</option>
                      <option value="1 hour before">1 hour before</option>
                      <option value="None">No reminder</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEventModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold cursor-pointer"
                  >
                    {editingEventId ? 'Save Changes' : 'Create Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

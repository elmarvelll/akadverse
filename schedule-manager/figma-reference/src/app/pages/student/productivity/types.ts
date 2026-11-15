export type FigmaPageId =
  | '00-tokens'
  | '01-components'
  | '02-desktop'
  | '03-mobile'
  | '04-flows'
  | '05-annotations';

export type NavSectionId =
  | 'today'
  | 'schedule'
  | 'tasks'
  | 'habits'
  | 'goals'
  | 'accountability'
  | 'groups'
  | 'admin'
  | 'history'
  | 'reminders';

export type ScreenDataState =
  | 'populated'
  | 'loading'
  | 'empty'
  | 'error'
  | 'access-denied'
  | 'pending-sync';

export type SyncState =
  | 'online'
  | 'offline'
  | 'syncing'
  | 'confirmed'
  | 'conflict';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type StatusOutcome =
  | 'unrecorded'
  | 'completed'
  | 'missed'
  | 'pending-sync'
  | 'official'
  | 'focus';

export type LifeArea = 'Academics' | 'Exercise' | 'Spirituality' | 'Career';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceType: 'TASK' | 'HABIT' | 'GOAL' | 'COURSE';
  linkedHabitId?: string;
  linkedGoalId?: string;
  priority: PriorityLevel;
  dueDate: string;
  dueTime: string;
  status: StatusOutcome;
  isFocus?: boolean;
  awaitingOutcome?: boolean;
  lifeArea: LifeArea;
}

export interface ScheduleEventItem {
  id: string;
  title: string;
  dayIndex: number; // 0 = Mon, 4 = Fri
  dayLabel: string;
  startHour: number; // e.g., 9.0 = 09:00, 10.5 = 10:30
  durationHours: number;
  location: string;
  lifeArea: LifeArea;
  isOfficial: boolean;
  isFocus: boolean;
  priority: PriorityLevel;
  status: StatusOutcome;
  courseCode?: string;
  studentNotes?: string;
  backupSlot?: string;
  hasConflict?: boolean;
}

export type HabitCellState =
  | 'complete'
  | 'missed'
  | 'not-scheduled'
  | 'scheduled'
  | 'today-scheduled';

export interface HabitDefinition {
  id: string;
  name: string;
  description: string;
  type: 'task' | 'event';
  frequencyLabel: string;
  timeLabel: string;
  priority: PriorityLevel;
  lifeArea: LifeArea;
  startDate: string;
  endDate?: string;
  // Keyed by date label e.g. 'Oct 27', 'Oct 28', 'Oct 29', 'Oct 30', 'Oct 31'
  cells: Record<string, HabitCellState>;
}

export interface GoalStep {
  id: string;
  title: string;
  kind: 'session' | 'task';
  completed: boolean;
  dueLabel: string;
}

export interface GoalItem {
  id: string;
  title: string;
  courseOrArea: string;
  targetDate: string;
  steps: GoalStep[];
}

export interface AccountabilityRequest {
  id: string;
  author: string;
  roleLabel: string;
  tags: string[];
  excerpt: string;
  sharedCommitments: string[];
  checkInFrequency: string;
  nextCheckIn: string;
  interestSent?: boolean;
  isOwner?: boolean;
  partnerActive?: boolean;
}

export interface StudyGroupItem {
  id: string;
  title: string;
  topic: string;
  description: string;
  approvalState: 'Approved' | 'Pending' | 'Rejected';
  recruitmentState: 'Recruiting' | 'Active' | 'Full';
  memberCount: number;
  capacity: number;
  isOwner?: boolean;
  requestPending?: boolean;
  rejectionReason?: string;
}

export interface HistoryRecord {
  id: string;
  title: string;
  action: string;
  dateLabel: string;
  completionTime: string;
  activityType: 'Task' | 'Habit' | 'Schedule' | 'Goal';
  outcome: 'completed' | 'missed' | 'replanned';
  lifeArea: LifeArea;
  relatedAttempt?: {
    originalTime: string;
    reason: string;
  };
}

export interface OpenDecisionItem {
  id: string;
  decision: string;
  screenFrame: string;
  targetSection: NavSectionId;
  question: string;
}

export const OPEN_DECISIONS: OpenDecisionItem[] = [
  {
    id: 'OD-01',
    decision: 'Late-completion credit & habit-grid date',
    screenFrame: 'Habits/Grid/Feedback',
    targetSection: 'habits',
    question:
      'Should a habit completed after midnight credit the intended schedule date or the actual timestamp date on the monthly grid?',
  },
  {
    id: 'OD-02',
    decision: 'Score eligibility & unrecorded treatment',
    screenFrame: 'Goals/Detail, History',
    targetSection: 'goals',
    question:
      'Do unrecorded past occurrences count as neutral (excluded from denominator) or missed when computing completion progress?',
  },
  {
    id: 'OD-03',
    decision: 'Collision with next habit occurrence',
    screenFrame: 'Habits/Detail/Upcoming',
    targetSection: 'habits',
    question:
      'If replanning a missed habit pushes it past the next scheduled occurrence, should the earlier occurrence auto-merge or expire?',
  },
  {
    id: 'OD-04',
    decision: 'Contact visibility stage',
    screenFrame: 'Accountability/RequestDetail',
    targetSection: 'accountability',
    question:
      'Is institutional email/handle revealed upon Express Interest or strictly after the request owner clicks Accept?',
  },
  {
    id: 'OD-05',
    decision: 'Scope of sharing a whole schedule',
    screenFrame: 'Accountability/RequestForm',
    targetSection: 'accountability',
    question:
      'When sharing a schedule with an accountability partner, do non-selected personal blocks appear as "Busy" or remain hidden?',
  },
  {
    id: 'OD-06',
    decision: 'Group activation below 3',
    screenFrame: 'Groups/Detail/Active',
    targetSection: 'groups',
    question:
      'Can an approved study group transition from Recruiting to Active with 2 members, or is 3 the hard minimum threshold?',
  },
  {
    id: 'OD-07',
    decision: 'Deletion vs archiving',
    screenFrame: 'Habits/Detail/History, Tasks/Detail',
    targetSection: 'tasks',
    question:
      'When a student deletes an active task or habit rule, should historical completion logs be soft-archived or permanently purged?',
  },
  {
    id: 'OD-08',
    decision: 'Supported reminder channels',
    screenFrame: 'Global/ReminderPrefs',
    targetSection: 'reminders',
    question:
      'In Phase 1, are reminders delivered via in-portal push + institutional email only, or is SMS/WhatsApp webhook included?',
  },
  {
    id: 'OD-09',
    decision: 'Final rescheduling limits',
    screenFrame: 'Replan/NoSlot',
    targetSection: 'schedule',
    question:
      'How many times can a single missed commitment be replanned before requiring manual archival or scope adjustment?',
  },
  {
    id: 'OD-10',
    decision: 'Backdating policy',
    screenFrame: 'Tasks/Form/Default',
    targetSection: 'tasks',
    question:
      'How many days in the past may a student backdate a task outcome before the record locks for weekly accountability?',
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-habit-jog',
    title: 'Morning 5km Jog — Aerobic Conditioning',
    description: 'Complete 5km campus perimeter loop before 7:00 AM lecture prep.',
    source: 'Habit · Mon, Wed, Fri at 6:00 AM',
    sourceType: 'HABIT',
    linkedHabitId: 'habit-jog',
    priority: 'high',
    dueDate: 'Fri, 31 Oct',
    dueTime: '06:00 AM',
    status: 'unrecorded',
    isFocus: true,
    lifeArea: 'Exercise',
  },
  {
    id: 'task-eee311-problem',
    title: 'Solve Thevenin & Norton Problem Set 4',
    description: 'Complete questions 1–6 in EEE 311 workbook and upload PDF scan.',
    source: 'EEE 311 · Electric Circuit Theory I',
    sourceType: 'COURSE',
    linkedGoalId: 'goal-eee311',
    priority: 'high',
    dueDate: 'Fri, 31 Oct',
    dueTime: '02:00 PM',
    status: 'unrecorded',
    isFocus: true,
    lifeArea: 'Academics',
  },
  {
    id: 'task-get307-draft',
    title: 'Draft Heuristic Search Python Notebook',
    description: 'Implement A* pathfinding benchmark and compare Manhattan vs Euclidean heuristics.',
    source: 'Goal · AI Term Project Milestone 2',
    sourceType: 'GOAL',
    linkedGoalId: 'goal-ai-paper',
    priority: 'medium',
    dueDate: 'Fri, 31 Oct',
    dueTime: '05:30 PM',
    status: 'unrecorded',
    isFocus: true,
    lifeArea: 'Academics',
  },
  {
    id: 'task-eee321-lab',
    title: 'Pre-lab Simulation: BJT Common-Emitter Stage',
    description: 'Run LTspice DC operating point sweep and export Bode plot.',
    source: 'EEE 321 · Analogue Electronic Circuits I',
    sourceType: 'COURSE',
    priority: 'medium',
    dueDate: 'Fri, 31 Oct',
    dueTime: '07:00 PM',
    status: 'unrecorded',
    isFocus: false,
    lifeArea: 'Academics',
  },
  {
    id: 'task-scripture-study',
    title: 'Evening Quiet Reflection & Journaling',
    description: '20 minutes of quiet gratitude log and readings.',
    source: 'Habit · Daily at 9:00 PM',
    sourceType: 'HABIT',
    linkedHabitId: 'habit-reflect',
    priority: 'low',
    dueDate: 'Fri, 31 Oct',
    dueTime: '09:00 PM',
    status: 'unrecorded',
    isFocus: false,
    lifeArea: 'Spirituality',
  },
  {
    id: 'task-awaiting-1',
    title: 'Review Engineering Math III Fourier Series Notes',
    description: 'Summarize odd/even periodic extensions from Thursday lecture.',
    source: 'GET 301 · Yesterday 8:00 PM',
    sourceType: 'TASK',
    priority: 'medium',
    dueDate: 'Thu, 30 Oct',
    dueTime: '08:00 PM',
    status: 'unrecorded',
    isFocus: false,
    awaitingOutcome: true,
    lifeArea: 'Academics',
  },
  {
    id: 'task-awaiting-2',
    title: 'SIWES Logbook Week 3 Supervisor Entry',
    description: 'Record weekly technical summary for GET 399 coordinator.',
    source: 'GET 399 · Yesterday 4:00 PM',
    sourceType: 'COURSE',
    priority: 'low',
    dueDate: 'Thu, 30 Oct',
    dueTime: '04:00 PM',
    status: 'unrecorded',
    isFocus: false,
    awaitingOutcome: true,
    lifeArea: 'Career',
  },
];

export const INITIAL_EVENTS: ScheduleEventItem[] = [
  {
    id: 'evt-jog',
    title: 'Morning 5km Jog',
    dayIndex: 4,
    dayLabel: 'Fri 31',
    startHour: 6.5,
    durationHours: 1.0,
    location: 'Sports Complex Track',
    lifeArea: 'Exercise',
    isOfficial: false,
    isFocus: true,
    priority: 'high',
    status: 'unrecorded',
    backupSlot: 'Sat, 01 Nov · 07:00 AM',
  },
  {
    id: 'evt-eee311-official',
    title: 'EEE 311 · Electric Circuit Theory I',
    dayIndex: 4,
    dayLabel: 'Fri 31',
    startHour: 9.0,
    durationHours: 2.0,
    location: 'Engineering Lecture Theatre B',
    lifeArea: 'Academics',
    isOfficial: true,
    isFocus: true,
    priority: 'high',
    status: 'official',
    courseCode: 'EEE 311',
    studentNotes: 'Bring scientific calculator and nodal analysis sheet for quiz.',
  },
  {
    id: 'evt-circuit-study',
    title: 'Deep Work: Thevenin Problem Set 4',
    dayIndex: 4,
    dayLabel: 'Fri 31',
    startHour: 12.0,
    durationHours: 1.5,
    location: 'Engineering Library Pod 4',
    lifeArea: 'Academics',
    isOfficial: false,
    isFocus: true,
    priority: 'high',
    status: 'unrecorded',
    backupSlot: 'Fri, 31 Oct · 04:30 PM',
  },
  {
    id: 'evt-get307-official',
    title: 'GET 307 · Intro to AI & Machine Learning',
    dayIndex: 4,
    dayLabel: 'Fri 31',
    startHour: 14.0,
    durationHours: 2.0,
    location: 'Computer Lab 204',
    lifeArea: 'Academics',
    isOfficial: true,
    isFocus: false,
    priority: 'medium',
    status: 'official',
    courseCode: 'GET 307',
    studentNotes: 'Prof. reviewing A* search optimality proof.',
  },
  {
    id: 'evt-chapel',
    title: 'Evening Fellowship & Choir Rehearsal',
    dayIndex: 4,
    dayLabel: 'Fri 31',
    startHour: 17.0,
    durationHours: 1.5,
    location: 'University Chapel',
    lifeArea: 'Spirituality',
    isOfficial: false,
    isFocus: false,
    priority: 'low',
    status: 'unrecorded',
    backupSlot: 'Sun, 02 Nov · 04:00 PM',
  },
  {
    id: 'evt-mon-math',
    title: 'GET 301 · Engineering Mathematics III',
    dayIndex: 0,
    dayLabel: 'Mon 27',
    startHour: 8.0,
    durationHours: 2.0,
    location: 'Hall A2',
    lifeArea: 'Academics',
    isOfficial: true,
    isFocus: false,
    priority: 'high',
    status: 'official',
    courseCode: 'GET 301',
  },
  {
    id: 'evt-tue-circuits',
    title: 'EEE 321 · Analogue Electronic Circuits I',
    dayIndex: 1,
    dayLabel: 'Tue 28',
    startHour: 10.0,
    durationHours: 2.0,
    location: 'Electronics Lab 1',
    lifeArea: 'Academics',
    isOfficial: true,
    isFocus: true,
    priority: 'high',
    status: 'official',
    courseCode: 'EEE 321',
  },
  {
    id: 'evt-wed-em',
    title: 'EEE 324 · Electromagnetic Fields I',
    dayIndex: 2,
    dayLabel: 'Wed 29',
    startHour: 9.0,
    durationHours: 2.0,
    location: 'Room 305',
    lifeArea: 'Academics',
    isOfficial: true,
    isFocus: false,
    priority: 'medium',
    status: 'official',
    courseCode: 'EEE 324',
  },
  {
    id: 'evt-thu-study',
    title: 'Fourier Series Peer Problem Session',
    dayIndex: 3,
    dayLabel: 'Thu 30',
    startHour: 11.0,
    durationHours: 1.5,
    location: 'Study Zone Commons',
    lifeArea: 'Academics',
    isOfficial: false,
    isFocus: true,
    priority: 'medium',
    status: 'completed',
  },
];

export const HABIT_DATES = [
  'Oct 25',
  'Oct 26',
  'Oct 27',
  'Oct 28',
  'Oct 29',
  'Oct 30',
  'Oct 31',
];

export const INITIAL_HABITS: HabitDefinition[] = [
  {
    id: 'habit-jog',
    name: 'Morning 5km Jog',
    description: 'Jog every Mon, Wed, Fri at 6 a.m. around the campus track.',
    type: 'event',
    frequencyLabel: 'Mon, Wed, Fri',
    timeLabel: '6:00 AM – 7:00 AM',
    priority: 'high',
    lifeArea: 'Exercise',
    startDate: '2026-10-01',
    cells: {
      'Oct 25': 'complete',
      'Oct 26': 'not-scheduled',
      'Oct 27': 'complete',
      'Oct 28': 'not-scheduled',
      'Oct 29': 'missed',
      'Oct 30': 'not-scheduled',
      'Oct 31': 'today-scheduled',
    },
  },
  {
    id: 'habit-circuits',
    name: '90m Circuit Drill',
    description: 'Solve 3 nodal/phasor problems daily at 4 p.m.',
    type: 'task',
    frequencyLabel: 'Daily (Weekdays)',
    timeLabel: '4:00 PM',
    priority: 'high',
    lifeArea: 'Academics',
    startDate: '2026-10-01',
    cells: {
      'Oct 25': 'not-scheduled',
      'Oct 26': 'complete',
      'Oct 27': 'complete',
      'Oct 28': 'complete',
      'Oct 29': 'complete',
      'Oct 30': 'complete',
      'Oct 31': 'complete',
    },
  },
  {
    id: 'habit-reflect',
    name: 'Quiet Reflection',
    description: 'Evening gratitude log & reading every day at 9 p.m.',
    type: 'task',
    frequencyLabel: 'Every day',
    timeLabel: '9:00 PM',
    priority: 'medium',
    lifeArea: 'Spirituality',
    startDate: '2026-10-01',
    cells: {
      'Oct 25': 'complete',
      'Oct 26': 'complete',
      'Oct 27': 'missed',
      'Oct 28': 'complete',
      'Oct 29': 'complete',
      'Oct 30': 'complete',
      'Oct 31': 'complete',
    },
  },
];

export const INITIAL_GOALS: GoalItem[] = [
  {
    id: 'goal-ai-paper',
    title: 'GET 307 Term Paper: Heuristic Search in Power Grids',
    courseOrArea: 'GET 307 · Academics',
    targetDate: '14 Nov 2026',
    steps: [
      {
        id: 'step-1',
        title: 'Research: Annotate 8 IEEE papers on A* grid fault recovery',
        kind: 'session',
        completed: true,
        dueLabel: 'Completed 24 Oct',
      },
      {
        id: 'step-2',
        title: 'Draft: Write methodology & Python benchmark section',
        kind: 'task',
        completed: true,
        dueLabel: 'Completed 28 Oct',
      },
      {
        id: 'step-3',
        title: 'Review: Peer check equations with Marvelous study group',
        kind: 'session',
        completed: false,
        dueLabel: 'Due 04 Nov',
      },
      {
        id: 'step-4',
        title: 'Submit: Upload final PDF & code archive to E-Learning portal',
        kind: 'task',
        completed: false,
        dueLabel: 'Due 14 Nov',
      },
    ],
  },
  {
    id: 'goal-eee311',
    title: 'Master Sinusoidal Steady-State & Phasor Analysis',
    courseOrArea: 'EEE 311 · Academics',
    targetDate: '20 Nov 2026',
    steps: [
      {
        id: 'step-201',
        title: 'Complete Workbook Sets 1–3',
        kind: 'task',
        completed: true,
        dueLabel: 'Completed 22 Oct',
      },
      {
        id: 'step-202',
        title: 'Solve Thevenin & Norton Problem Set 4',
        kind: 'task',
        completed: false,
        dueLabel: 'Due Today',
      },
      {
        id: 'step-203',
        title: 'Timed Mock Midterm Session (90 mins)',
        kind: 'session',
        completed: false,
        dueLabel: 'Due 12 Nov',
      },
    ],
  },
];

export const INITIAL_ACCOUNTABILITY: AccountabilityRequest[] = [
  {
    id: 'acc-1',
    author: 'Chidinma Okafor',
    roleLabel: '300L Electrical Engineering',
    tags: ['EEE 311', 'Morning Routine', 'Deep Work'],
    excerpt:
      'Looking for a consistent 300L partner to check in every Tuesday and Friday on Circuit Theory problem sets and 6 AM morning runs.',
    sharedCommitments: [
      'Habit: Morning 5km Jog (Mon, Wed, Fri)',
      'Task: Solve Thevenin & Norton Problem Set 4',
      'Goal: Master Sinusoidal Steady-State & Phasor Analysis',
    ],
    checkInFrequency: 'Twice weekly (Tue & Fri · 8:00 PM)',
    nextCheckIn: 'Fri, 31 Oct · 8:00 PM',
    interestSent: false,
  },
  {
    id: 'acc-2',
    author: 'Tunde Adebayo',
    roleLabel: '300L Computer Engineering',
    tags: ['GET 307 AI', 'Python', 'Paper Writing'],
    excerpt:
      'Building the GET 307 heuristic search project. Sharing my milestone checklist and daily 90-minute coding block for mutual accountability.',
    sharedCommitments: [
      'Goal: GET 307 Term Paper (4 milestones)',
      'Habit: 90m Circuit & Coding Drill',
    ],
    checkInFrequency: 'Every Sunday · 6:00 PM',
    nextCheckIn: 'Sun, 02 Nov · 6:00 PM',
    interestSent: false,
  },
];

export const INITIAL_GROUPS: StudyGroupItem[] = [
  {
    id: 'grp-1',
    title: '300L Circuit Theory & Phasor Mastery',
    topic: 'EEE 311 / EEE 326',
    description:
      'Weekly collaborative problem-solving pod focused on nodal analysis, two-port networks, and past exam derivations.',
    approvalState: 'Approved',
    recruitmentState: 'Recruiting',
    memberCount: 4,
    capacity: 6,
    isOwner: true,
  },
  {
    id: 'grp-2',
    title: 'Applied AI & Convergent Tech Lab',
    topic: 'GET 307',
    description:
      'Hands-on study group implementing search algorithms and neural architectures in Python alongside lecture modules.',
    approvalState: 'Approved',
    recruitmentState: 'Active',
    memberCount: 5,
    capacity: 5,
    isOwner: false,
  },
  {
    id: 'grp-3',
    title: 'Engineering Math III Fourier & PDE Circle',
    topic: 'GET 301',
    description:
      'Focused derivations and Sturm-Liouville boundary value problem drills every Wednesday afternoon.',
    approvalState: 'Pending',
    recruitmentState: 'Recruiting',
    memberCount: 2,
    capacity: 5,
    isOwner: true,
  },
];

export const INITIAL_HISTORY: HistoryRecord[] = [
  {
    id: 'hist-1',
    title: '90m Circuit Drill — Nodal Equations',
    action: 'Marked Completed on time',
    dateLabel: 'Fri, 31 Oct 2026',
    completionTime: '04:12 PM',
    activityType: 'Habit',
    outcome: 'completed',
    lifeArea: 'Academics',
  },
  {
    id: 'hist-2',
    title: 'Fourier Series Peer Problem Session',
    action: 'Completed after replanning',
    dateLabel: 'Thu, 30 Oct 2026',
    completionTime: '12:30 PM',
    activityType: 'Schedule',
    outcome: 'completed',
    lifeArea: 'Academics',
    relatedAttempt: {
      originalTime: 'Wed, 29 Oct · 03:00 PM (Marked Missed)',
      reason: 'Extended EEE 321 laboratory bench session conflict',
    },
  },
  {
    id: 'hist-3',
    title: 'Morning 5km Jog',
    action: 'Marked Missed',
    dateLabel: 'Wed, 29 Oct 2026',
    completionTime: '06:00 AM',
    activityType: 'Habit',
    outcome: 'missed',
    lifeArea: 'Exercise',
  },
  {
    id: 'hist-4',
    title: 'Draft: Write methodology & Python benchmark section',
    action: 'Goal Milestone Completed',
    dateLabel: 'Wed, 28 Oct 2026',
    completionTime: '06:45 PM',
    activityType: 'Goal',
    outcome: 'completed',
    lifeArea: 'Academics',
  },
];

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  CheckSquare,
  Sparkles,
  Grid,
  Users,
  Shield,
  Clock,
  Bell,
  HelpCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Target,
  WifiOff,
  Check,
  AlertTriangle,
  BookOpen,
  Layers,
} from 'lucide-react';
import {
  AccountabilityRequest,
  FigmaPageId,
  GoalItem,
  HabitCellState,
  HabitDefinition,
  HistoryRecord,
  INITIAL_ACCOUNTABILITY,
  INITIAL_EVENTS,
  INITIAL_GOALS,
  INITIAL_GROUPS,
  INITIAL_HABITS,
  INITIAL_HISTORY,
  INITIAL_TASKS,
  NavSectionId,
  ScheduleEventItem,
  ScreenDataState,
  StudyGroupItem,
  SyncState,
  TaskItem,
} from './types';
import {
  ComponentsLibraryPage,
  EASE_CURVE,
  OpenDecisionChip,
  ProdButton,
  ProdModal,
  SHADOW_TOKENS,
  SyncBadge,
  ToastMessage,
  ToastStack,
  TokensSpecPage,
} from './components';
import {
  AccountabilityScreen,
  GoalsScreen,
  GroupsAndAdminScreen,
  HabitsScreen,
  HistoryScreen,
  TasksScreen,
  TodayScreen,
} from './screens';
import { ScheduleManager } from '../ScheduleManager';
import {
  AcceptanceFlowsPage,
  AnnotationsAndMatricesPage,
  MobileScreensPage,
} from './flowsAndMatrices';

export function ProductivityPortal() {
  const navigate = useNavigate();

  // Active Figma Page (00 Tokens -> 05 Annotations, defaults to 02 Desktop Screens)
  const [figmaPage, setFigmaPage] = useState<FigmaPageId>('02-desktop');

  // Global Shell Sidebar State (240px expanded, 72px collapsed, 250ms --ease)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSectionId>('today');
  const [dataState, setDataState] = useState<ScreenDataState>('populated');

  // Accessibility & Figma Spec Overlays
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Global Sync & Offline State (Section 3.5 & 4.18)
  const [syncState, setSyncState] = useState<SyncState>('online');
  const [pendingSyncCount, setPendingSyncCount] = useState(2);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  // Core Domain State (Shared across Today, Tasks, Habits, Schedule, Goals, Accountability, Groups, History)
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const [events, setEvents] = useState<ScheduleEventItem[]>(INITIAL_EVENTS);
  const [habits, setHabits] = useState<HabitDefinition[]>(INITIAL_HABITS);
  const [goals, setGoals] = useState<GoalItem[]>(INITIAL_GOALS);
  const [accountability, setAccountability] = useState<AccountabilityRequest[]>(
    INITIAL_ACCOUNTABILITY
  );
  const [groups, setGroups] = useState<StudyGroupItem[]>(INITIAL_GROUPS);
  const [history, setHistory] = useState<HistoryRecord[]>(INITIAL_HISTORY);
  const [historyCounter, setHistoryCounter] = useState<number>(
    INITIAL_HISTORY.length
  );

  // Modals for Reminders (OD-08) & Help
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Toast Notification Queue (max 3, auto-dismiss 4s)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const triggerToast = (msg: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...msg, id }, ...prev].slice(0, 3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * SIGNATURE MOMENT (Section 4.3 & Journey A):
   * Complete Task Sequence:
   * 1. Checkbox spring fill (180ms) + Checkmark draw (250ms)
   * 2. Row scale 1.015 (120ms spring) + Background wash to Accent/soft (150ms)
   * 3. Row collapses, neighbors slide up (280ms --ease)
   * 4. Sidebar History counter ticks up + Linked Habit Grid cell turns green!
   */
  const handleCompleteTask = (task: TaskItem) => {
    if (completingTaskIds.includes(task.id)) return;
    setCompletingTaskIds((prev) => [...prev, task.id]);

    setTimeout(
      () => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: 'completed' } : t
          )
        );
        setCompletingTaskIds((prev) => prev.filter((id) => id !== task.id));
        setHistoryCounter((c) => c + 1);

        // If linked to a habit (e.g. Morning 5km Jog), mark today's Habit Grid cell complete!
        if (task.linkedHabitId) {
          setHabits((prev) =>
            prev.map((h) =>
              h.id === task.linkedHabitId
                ? { ...h, cells: { ...h.cells, 'Oct 31': 'complete' } }
                : h
            )
          );
        }

        // Append to History
        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            title: task.title,
            action:
              syncState === 'offline'
                ? 'Completed Offline (Pending Sync)'
                : 'Completed via Productivity Layer',
            dateLabel: 'Fri, 31 Oct 2026',
            completionTime: 'Just now',
            activityType: task.linkedHabitId ? 'Habit' : 'Task',
            outcome: 'completed',
            lifeArea: task.lifeArea,
          },
          ...prev,
        ]);

        triggerToast({
          title:
            syncState === 'offline'
              ? 'Saved Offline · Pending Sync'
              : 'Commitment Completed',
          subtitle: task.linkedHabitId
            ? 'Habit cell turned green & Today progress updated'
            : 'History counter incremented',
          tone: syncState === 'offline' ? 'warning' : 'success',
        });
      },
      reducedMotion ? 80 : 400
    );
  };

  const handleMarkMissedTask = (task: TaskItem) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'missed' } : t))
    );
    setHistoryCounter((c) => c + 1);
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        title: task.title,
        action: 'Marked Missed',
        dateLabel: 'Fri, 31 Oct 2026',
        completionTime: 'Just now',
        activityType: 'Task',
        outcome: 'missed',
        lifeArea: task.lifeArea,
      },
      ...prev,
    ]);
    triggerToast({
      title: 'Marked as Missed',
      subtitle: 'Logged in History. Open Schedule to replan a backup slot.',
      tone: 'warning',
    });
  };

  const handleCreateTask = (newTask: Omit<TaskItem, 'id' | 'status'>) => {
    const created: TaskItem = {
      ...newTask,
      id: `task-${Date.now()}`,
      status: syncState === 'offline' ? 'pending-sync' : 'unrecorded',
    };
    setTasks((prev) => [created, ...prev]);
    triggerToast({
      title: 'Commitment Added',
      subtitle: created.title,
      tone: 'success',
    });
  };

  const handleToggleHabitCell = (habitId: string, dateKey: string) => {
    const cycle: Record<HabitCellState, HabitCellState> = {
      'today-scheduled': 'complete',
      scheduled: 'complete',
      complete: 'missed',
      missed: 'today-scheduled',
      'not-scheduled': 'complete',
    };

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const current = h.cells[dateKey] ?? 'scheduled';
        const next = cycle[current];
        return {
          ...h,
          cells: {
            ...h.cells,
            [dateKey]: next,
          },
        };
      })
    );

    setHistoryCounter((c) => c + 1);
    if (syncState === 'offline') {
      setPendingSyncCount((n) => n + 1);
      triggerToast({
        title: 'Habit Outcome Queued Offline',
        subtitle: 'Amber pending-sync badge active until reconnect',
        tone: 'warning',
      });
    }
  };

  const handleCycleSyncState = () => {
    const order: SyncState[] = [
      'online',
      'offline',
      'syncing',
      'confirmed',
      'conflict',
    ];
    const next = order[(order.indexOf(syncState) + 1) % order.length];
    setSyncState(next);
    if (next === 'conflict') {
      setConflictModalOpen(true);
    }
  };

  const handleReconnectSimulate = () => {
    setSyncState('syncing');
    setTimeout(() => {
      setSyncState('confirmed');
      setPendingSyncCount(0);
      triggerToast({
        title: 'All Pending Outcomes Synced',
        subtitle: 'Badges flipped to green checkmarks (60ms stagger)',
        tone: 'success',
      });
    }, 650);
  };

  const sidebarPrimaryItems: {
    id: NavSectionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'today', label: 'Today', icon: Sparkles },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'habits', label: 'Habits', icon: Grid },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'accountability', label: 'Accountability', icon: Users },
    { id: 'groups', label: 'Groups', icon: Layers },
    { id: 'admin', label: 'Admin Queue', icon: Shield },
  ];

  const figmaPages: { id: FigmaPageId; label: string }[] = [
    { id: '00-tokens', label: '00 · Tokens' },
    { id: '01-components', label: '01 · Components' },
    { id: '02-desktop', label: '02 · Desktop (1440)' },
    { id: '03-mobile', label: '03 · Mobile (390)' },
    { id: '04-flows', label: '04 · Flows (5 Journeys)' },
    { id: '05-annotations', label: '05 · Matrices & Specs' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0F172A] flex flex-col font-sans antialiased selection:bg-[#185CFF]/15 selection:text-[#185CFF]">
      {/* ====================================================================
          4.1 GLOBAL TOP BAR (64px)
          Left: Avatar + Name + Portal Switcher
          Center: Date Chip + Figma File Setup Page Tabs (00 - 05)
          Right: Sync Badge + Global Quick-Add (+)
         ==================================================================== */}
      <header
        style={{ boxShadow: SHADOW_TOKENS.xs }}
        className="sticky top-0 z-40 h-16 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3"
      >
        {/* Left: Portal Identity + Student Avatar & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#185CFF] text-white font-bold text-[14px] flex items-center justify-center shadow-[0_2px_8px_rgba(24,92,255,0.25)]">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#0F172A]">
                Awesome
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#EEF4FF] text-[#185CFF] text-[10px] font-bold uppercase tracking-[0.06em]">
                Productivity Layer
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/e-learning')}
              className="text-[11.5px] text-[#475569] hover:text-[#185CFF] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              <span>Switch to E-Learning Portal →</span>
            </button>
          </div>
        </div>

        {/* Center: Date Chip + Figma Pages Bar */}
        <div className="hidden xl:flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-[#EEF0F4] text-[#0F172A] text-[12px] font-medium">
            Fri, 31 Oct 2026
          </span>

          <div className="flex items-center p-1 rounded-full bg-[#EEF0F4]">
            {figmaPages.map((pg) => {
              const active = figmaPage === pg.id;
              return (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => setFigmaPage(pg.id)}
                  className={`relative px-3 py-1 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'text-[#0F172A] font-semibold'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="figma-page-pill"
                      transition={{ duration: 0.25, ease: EASE_CURVE }}
                      style={{ boxShadow: SHADOW_TOKENS.xs }}
                      className="absolute inset-0 bg-white rounded-full"
                    />
                  )}
                  <span className="relative z-10">{pg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Annotations Toggle, Reduced-Motion Toggle, Sync Badge & Quick-Add + */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAnnotations((a) => !a)}
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-medium cursor-pointer transition-colors ${
              showAnnotations
                ? 'bg-[#FEF3C7] text-[#92400E]'
                : 'bg-[#EEF0F4] text-[#475569]'
            }`}
            title="Toggle Open Decision & Motion Spec annotations"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Annotations {showAnnotations ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((r) => !r)}
            className={`hidden lg:inline-flex items-center px-2.5 py-1.5 rounded-full text-[11.5px] font-medium cursor-pointer transition-colors ${
              reducedMotion
                ? 'bg-[#185CFF] text-white'
                : 'bg-[#EEF0F4] text-[#475569]'
            }`}
            title="Simulate prefers-reduced-motion accessibility fallback"
          >
            {reducedMotion ? 'Reduced Motion: ON' : 'Motion: Standard'}
          </button>

          <SyncBadge
            state={syncState}
            pendingCount={pendingSyncCount}
            onClick={handleCycleSyncState}
            reducedMotion={reducedMotion}
          />

          <ProdButton
            variant="primary"
            size="sm"
            reducedMotion={reducedMotion}
            onClick={() => {
              setFigmaPage('02-desktop');
              setActiveSection('tasks');
              setTaskFormOpen(true);
            }}
            title="Global Quick-Add Commitment"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick add</span>
          </ProdButton>
        </div>
      </header>

      {/* Compact Figma Page Switcher for smaller viewports (< xl) */}
      <div className="xl:hidden bg-white border-b border-[#E5E7EB]/60 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
        {figmaPages.map((pg) => (
          <button
            key={pg.id}
            type="button"
            onClick={() => setFigmaPage(pg.id)}
            className={`px-3 py-1 rounded-full text-[11.5px] font-medium whitespace-nowrap cursor-pointer ${
              figmaPage === pg.id
                ? 'bg-[#185CFF] text-white'
                : 'bg-[#EEF0F4] text-[#475569]'
            }`}
          >
            {pg.label}
          </button>
        ))}
      </div>

      {/* ====================================================================
          4.18 PERSISTENT COMPACT OFFLINE & SYNC BANNER UNDER TOP BAR
         ==================================================================== */}
      <AnimatePresence>
        {syncState !== 'online' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_CURVE }}
            className={`px-6 py-2 text-[12.5px] font-medium flex flex-wrap items-center justify-between gap-3 ${
              syncState === 'offline'
                ? 'bg-[#FEF3C7] text-[#92400E]'
                : syncState === 'conflict'
                ? 'bg-[#FEE2E2] text-[#B91C1C]'
                : syncState === 'confirmed'
                ? 'bg-[#D1FAE5] text-[#065F46]'
                : 'bg-[#EEF4FF] text-[#185CFF]'
            }`}
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5" />
              <span>
                {syncState === 'offline' &&
                  `Frame: Global/Offline/Cached · Working offline with cached commitments (${pendingSyncCount} outcomes pending sync).`}
                {syncState === 'syncing' &&
                  'Frame: Global/Syncing · Uploading queued outcomes to Akadverse cloud…'}
                {syncState === 'confirmed' &&
                  'Frame: Global/SyncConfirmed · Reconnected! All pending-sync pills flipped to green checkmarks (staggered 60ms).'}
                {syncState === 'conflict' &&
                  'Frame: Global/Conflict · Timestamp conflict detected on “Morning 5km Jog” between mobile and web sessions.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {syncState === 'offline' && (
                <button
                  type="button"
                  onClick={handleReconnectSimulate}
                  className="px-3 py-1 rounded-full bg-white text-[#0F172A] text-[11.5px] font-semibold shadow-xs cursor-pointer"
                >
                  Simulate Reconnect →
                </button>
              )}
              {syncState === 'conflict' && (
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(true)}
                  className="px-3 py-1 rounded-full bg-[#EF4444] text-white text-[11.5px] font-semibold cursor-pointer"
                >
                  Resolve Conflict
                </button>
              )}
              <button
                type="button"
                onClick={() => setSyncState('online')}
                className="text-[11.5px] underline cursor-pointer ml-2"
              >
                Return to Online
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          4.1 GLOBAL SHELL BODY: LEFT SIDEBAR (240px / 72px) + CENTERED CONTENT (max-w 1200)
         ==================================================================== */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        {/* LEFT SIDEBAR: 240px expanded, 72px collapsed, 250ms --ease */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 72 : 240 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.25, ease: EASE_CURVE }}
          style={{ boxShadow: SHADOW_TOKENS.xs }}
          className="flex-shrink-0 bg-white flex flex-col justify-between py-4 px-3 select-none z-20"
        >
          {/* Top Section: Collapse Toggle + Main Nav Items */}
          <div className="space-y-4">
            <div
              className={`flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'justify-between px-2'
              }`}
            >
              {!sidebarCollapsed && (
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                  Workspace
                </span>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[#475569] hover:bg-[#EEF0F4] hover:text-[#0F172A] transition-colors cursor-pointer"
                title={sidebarCollapsed ? 'Expand sidebar (240px)' : 'Collapse sidebar (72px)'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            <nav className="space-y-1">
              {sidebarPrimaryItems.map((item) => {
                const isActive =
                  figmaPage === '02-desktop' && activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFigmaPage('02-desktop');
                      setActiveSection(item.id);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full h-10 rounded-[12px] flex items-center ${
                      sidebarCollapsed
                        ? 'justify-center px-0'
                        : 'justify-start px-3 gap-3'
                    } text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-white'
                        : 'text-[#475569] hover:bg-[#EEF0F4]/70 hover:text-[#0F172A]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="prod-sidebar-active"
                        transition={{ duration: 0.25, ease: EASE_CURVE }}
                        style={{ boxShadow: SHADOW_TOKENS.accent }}
                        className="absolute inset-0 bg-[#185CFF] rounded-[12px]"
                      />
                    )}
                    <item.icon className="relative z-10 w-4 h-4 shrink-0" />
                    <AnimatePresence initial={false}>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: EASE_CURVE }}
                          className="relative z-10 truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer: History (with live ticking badge!), Reminders, Help */}
          <div className="pt-4 border-t border-[#E5E7EB]/70 space-y-1">
            <button
              type="button"
              onClick={() => {
                setFigmaPage('02-desktop');
                setActiveSection('history');
              }}
              title={sidebarCollapsed ? 'History' : undefined}
              className={`w-full h-10 rounded-[12px] flex items-center ${
                sidebarCollapsed
                  ? 'justify-center px-0'
                  : 'justify-between px-3'
              } text-[13px] font-medium transition-colors cursor-pointer ${
                figmaPage === '02-desktop' && activeSection === 'history'
                  ? 'bg-[#EEF4FF] text-[#185CFF]'
                  : 'text-[#475569] hover:bg-[#EEF0F4] hover:text-[#0F172A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>History</span>}
              </div>
              {!sidebarCollapsed && (
                <motion.span
                  key={historyCounter}
                  initial={{ y: 8, opacity: 0, scale: 0.85 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 340 }}
                  className="px-2 py-0.5 rounded-full bg-[#EEF4FF] text-[#185CFF] text-[11px] font-bold tabular-nums"
                >
                  {historyCounter}
                </motion.span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setReminderModalOpen(true)}
              title={sidebarCollapsed ? 'Reminders' : undefined}
              className={`w-full h-10 rounded-[12px] flex items-center ${
                sidebarCollapsed
                  ? 'justify-center px-0'
                  : 'justify-start px-3 gap-3'
              } text-[13px] font-medium text-[#475569] hover:bg-[#EEF0F4] hover:text-[#0F172A] transition-colors cursor-pointer`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Reminders</span>}
            </button>

            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              title={sidebarCollapsed ? 'Help' : undefined}
              className={`w-full h-10 rounded-[12px] flex items-center ${
                sidebarCollapsed
                  ? 'justify-center px-0'
                  : 'justify-start px-3 gap-3'
              } text-[13px] font-medium text-[#475569] hover:bg-[#EEF0F4] hover:text-[#0F172A] transition-colors cursor-pointer`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Help</span>}
            </button>
          </div>
        </motion.aside>

        {/* MAIN CONTENT AREA (max-w 1200, centered) */}
        <main className="flex-1 px-4 sm:px-8 py-6 overflow-x-hidden">
          <div className="max-w-[1200px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${figmaPage}-${activeSection}`}
                initial={
                  reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{
                  duration: reducedMotion ? 0.05 : 0.22,
                  ease: EASE_CURVE,
                }}
              >
                {/* 00 · TOKENS */}
                {figmaPage === '00-tokens' && <TokensSpecPage />}

                {/* 01 · COMPONENTS */}
                {figmaPage === '01-components' && (
                  <ComponentsLibraryPage onTriggerToast={triggerToast} />
                )}

                {/* 02 · DESKTOP SCREENS (1440px) */}
                {figmaPage === '02-desktop' && (
                  <>
                    {activeSection === 'today' && (
                      <TodayScreen
                        tasks={tasks}
                        habits={habits}
                        completingTaskIds={completingTaskIds}
                        onCompleteTask={handleCompleteTask}
                        onOpenTaskDetail={(t) => {
                          setSelectedTask(t);
                          setActiveSection('tasks');
                        }}
                        onOpenQuickAdd={() => {
                          setActiveSection('tasks');
                          setTaskFormOpen(true);
                        }}
                        onNavigateSection={setActiveSection}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                        reducedMotion={reducedMotion}
                        syncState={syncState}
                      />
                    )}

                    {activeSection === 'tasks' && (
                      <TasksScreen
                        tasks={tasks}
                        completingTaskIds={completingTaskIds}
                        onCompleteTask={handleCompleteTask}
                        onMarkMissedTask={handleMarkMissedTask}
                        onCreateTask={handleCreateTask}
                        selectedTask={selectedTask}
                        onSelectTask={setSelectedTask}
                        taskFormOpen={taskFormOpen}
                        onSetTaskFormOpen={setTaskFormOpen}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                        reducedMotion={reducedMotion}
                        onTriggerToast={triggerToast}
                        onNavigateHistory={() => setActiveSection('history')}
                      />
                    )}

                    {activeSection === 'schedule' && (
                      <ScheduleManager
                        embedded
                        onReturnHome={() => setActiveSection('today')}
                      />
                    )}

                    {activeSection === 'habits' && (
                      <HabitsScreen
                        habits={habits}
                        onToggleHabitCell={handleToggleHabitCell}
                        onCreateHabit={(newHab) => {
                          setHabits((prev) => [...prev, newHab]);
                          triggerToast({
                            title: 'Repeating Habit Created',
                            subtitle: newHab.description,
                            tone: 'success',
                          });
                        }}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                        reducedMotion={reducedMotion}
                        syncState={syncState}
                      />
                    )}

                    {activeSection === 'goals' && (
                      <GoalsScreen
                        goals={goals}
                        onToggleGoalStep={(goalId, stepId) => {
                          setGoals((prev) =>
                            prev.map((g) =>
                              g.id === goalId
                                ? {
                                    ...g,
                                    steps: g.steps.map((s) =>
                                      s.id === stepId
                                        ? { ...s, completed: !s.completed }
                                        : s
                                    ),
                                  }
                                : g
                            )
                          );
                          setHistoryCounter((c) => c + 1);
                        }}
                        onAddGoalStep={(goalId, title, kind) => {
                          setGoals((prev) =>
                            prev.map((g) =>
                              g.id === goalId
                                ? {
                                    ...g,
                                    steps: [
                                      ...g.steps,
                                      {
                                        id: `st-${Date.now()}`,
                                        title,
                                        kind,
                                        completed: false,
                                        dueLabel: 'Added Today',
                                      },
                                    ],
                                  }
                                : g
                            )
                          );
                          triggerToast({
                            title: 'Milestone Step Added',
                            subtitle: title,
                            tone: 'info',
                          });
                        }}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                        reducedMotion={reducedMotion}
                      />
                    )}

                    {activeSection === 'accountability' && (
                      <AccountabilityScreen
                        requests={accountability}
                        onExpressInterest={(id) => {
                          setAccountability((prev) =>
                            prev.map((r) =>
                              r.id === id ? { ...r, interestSent: true } : r
                            )
                          );
                          triggerToast({
                            title: 'Interest Sent',
                            subtitle:
                              'Partner will only see agreed commitments upon acceptance',
                            tone: 'info',
                          });
                        }}
                        onAcceptPartner={(id) => {
                          setAccountability((prev) =>
                            prev.map((r) =>
                              r.id === id ? { ...r, partnerActive: true } : r
                            )
                          );
                          triggerToast({
                            title: 'Partnership Active',
                            subtitle: 'Sanitized sharing scope enabled',
                            tone: 'success',
                          });
                        }}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                      />
                    )}

                    {(activeSection === 'groups' ||
                      activeSection === 'admin') && (
                      <GroupsAndAdminScreen
                        groups={groups}
                        isAdminView={activeSection === 'admin'}
                        onApproveGroup={(id) => {
                          setGroups((prev) =>
                            prev.map((g) =>
                              g.id === id
                                ? {
                                    ...g,
                                    approvalState: 'Approved',
                                    rejectionReason: undefined,
                                  }
                                : g
                            )
                          );
                          triggerToast({
                            title: 'Group Proposal Approved',
                            subtitle: 'Now visible in Student Group Discovery',
                            tone: 'success',
                          });
                        }}
                        onRejectGroup={(id, reason) => {
                          setGroups((prev) =>
                            prev.map((g) =>
                              g.id === id
                                ? {
                                    ...g,
                                    approvalState: 'Rejected',
                                    rejectionReason: reason,
                                  }
                                : g
                            )
                          );
                          triggerToast({
                            title: 'Group Proposal Rejected',
                            subtitle: 'Reason sent to student proposer',
                            tone: 'danger',
                          });
                        }}
                        onProposeGroup={(title, topic, description) => {
                          setGroups((prev) => [
                            {
                              id: `grp-${Date.now()}`,
                              title,
                              topic,
                              description,
                              approvalState: 'Pending',
                              recruitmentState: 'Recruiting',
                              memberCount: 1,
                              capacity: 5,
                              isOwner: true,
                            },
                            ...prev,
                          ]);
                          triggerToast({
                            title: 'Proposal Submitted',
                            subtitle: 'Awaiting Platform Admin review',
                            tone: 'info',
                          });
                        }}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                      />
                    )}

                    {activeSection === 'history' && (
                      <HistoryScreen
                        history={history}
                        dataState={dataState}
                        onChangeDataState={setDataState}
                        showAnnotations={showAnnotations}
                      />
                    )}
                  </>
                )}

                {/* 03 · MOBILE SCREENS (390px) */}
                {figmaPage === '03-mobile' && (
                  <MobileScreensPage
                    tasks={tasks}
                    events={events}
                    habits={habits}
                    onCompleteTask={handleCompleteTask}
                    onToggleHabitCell={handleToggleHabitCell}
                    syncState={syncState}
                    onCycleSync={handleCycleSyncState}
                  />
                )}

                {/* 04 · FLOWS (5 ACCEPTANCE JOURNEYS) */}
                {figmaPage === '04-flows' && (
                  <AcceptanceFlowsPage
                    onJumpToLiveScreen={(sec) => {
                      setFigmaPage('02-desktop');
                      setActiveSection(sec);
                    }}
                  />
                )}

                {/* 05 · ANNOTATIONS, MOTION SPEC & MATRICES */}
                {figmaPage === '05-annotations' && (
                  <AnnotationsAndMatricesPage
                    onNavigateToFrame={(section, st) => {
                      setFigmaPage('02-desktop');
                      setActiveSection(section);
                      setDataState(st);
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* GLOBAL REMINDER PREFERENCES MODAL (Annotated with OD-08) */}
      <ProdModal
        open={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        title="Reminder Channels & Cadence"
        subtitle="Frame: Global/ReminderPrefs"
      >
        <div className="space-y-4">
          <OpenDecisionChip
            decisionId="OD-08"
            showAnnotations={showAnnotations}
          />
          <div className="space-y-2.5 text-[13px]">
            {[
              { label: 'In-Portal Push Banner (15m before commitment)', on: true },
              { label: 'Institutional Email Digest (7:00 AM daily)', on: true },
              { label: 'Awaiting Outcome Evening Nudge (8:30 PM)', on: true },
            ].map((ch) => (
              <div
                key={ch.label}
                className="p-3 rounded-[12px] bg-[#F7F8FA] flex items-center justify-between"
              >
                <span className="font-medium text-[#0F172A]">{ch.label}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#047857] text-[11px] font-semibold">
                  Enabled
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <ProdButton onClick={() => setReminderModalOpen(false)}>
              Done
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* SYNC CONFLICT RESOLUTION MODAL (Section 4.18) */}
      <ProdModal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Sync Conflict Detected"
        subtitle="Frame: Global/Conflict"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[#475569]">
            “Morning 5km Jog” for Fri, 31 Oct was updated on two devices while offline. Choose which outcome to keep:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-[12px] bg-[#EEF4FF] border border-[#185CFF]/30 space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#185CFF]">
                This Device (Local)
              </span>
              <p className="text-[14px] font-semibold text-[#0F172A]">
                Completed · 06:42 AM
              </p>
            </div>
            <div className="p-3.5 rounded-[12px] bg-[#F7F8FA] space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#94A3B8]">
                Mobile Session
              </span>
              <p className="text-[14px] font-semibold text-[#0F172A]">
                Not recorded · 06:15 AM
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <ProdButton
              variant="secondary"
              onClick={() => {
                setSyncState('online');
                setConflictModalOpen(false);
              }}
            >
              Use Mobile Record
            </ProdButton>
            <ProdButton
              variant="primary"
              onClick={() => {
                setSyncState('confirmed');
                setConflictModalOpen(false);
                triggerToast({
                  title: 'Conflict Resolved',
                  subtitle: 'Local completion synced across all devices',
                  tone: 'success',
                });
              }}
            >
              Keep Local Completion
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* HELP / ARCHITECTURE GUIDE MODAL */}
      <ProdModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="Productivity Layer Prototype Guide"
        subtitle="Figma Pages 00–05 & 5 Acceptance Journeys"
      >
        <div className="space-y-3 text-[13px] text-[#475569] leading-relaxed">
          <p>
            Use the top bar segmented control to inspect all 6 Figma deliverable pages:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#0F172A]">
            <li>
              <strong>00 · Tokens:</strong> Color styles, 8-step type ramp, soft shadows, and 1440/390 frame grids.
            </li>
            <li>
              <strong>01 · Components:</strong> Interactive playground for all 12 components (3.1–3.12).
            </li>
            <li>
              <strong>02 · Desktop (1440):</strong> Full interactive screens with a live Frame State Bar.
            </li>
            <li>
              <strong>03 · Mobile (390):</strong> 390×844 mobile viewport with 4-column grid overlay.
            </li>
            <li>
              <strong>04 · Flows:</strong> Guided runner for all 5 Acceptance Journeys (A–E).
            </li>
            <li>
              <strong>05 · Matrices &amp; Specs:</strong> Clickable State &amp; Permission Matrices + 10 Open Decisions.
            </li>
          </ul>
          <div className="flex justify-end pt-2">
            <ProdButton onClick={() => setHelpModalOpen(false)}>
              Got it
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* GLOBAL TOAST STACK (3.8) */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

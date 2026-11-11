import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Clock,
  MapPin,
  Lock,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Eye,
  Users,
  ShieldCheck,
  Calendar,
  Filter,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  FileText,
  Flame,
  Dumbbell,
  Brain,
  BookOpen,
} from 'lucide-react';
import {
  AccountabilityRequest,
  GoalItem,
  HABIT_DATES,
  HabitCellState,
  HabitDefinition,
  HistoryRecord,
  LifeArea,
  NavSectionId,
  PriorityLevel,
  ScheduleEventItem,
  ScreenDataState,
  StudyGroupItem,
  SyncState,
  TaskItem,
} from './types';
import {
  ActivityCardRow,
  EASE_CURVE,
  EmptyStateBlock,
  FrameStateBanner,
  HabitGridCellView,
  OpenDecisionChip,
  ProdButton,
  ProdCheckbox,
  ProdModal,
  ProdProgressBar,
  SHADOW_TOKENS,
  SegmentedControl,
  SkeletonList,
  StatusPill,
  ToastMessage,
} from './components';

/**
 * ============================================================================
 * 4.2 TODAY OVERVIEW SCREEN
 * Frame: Today/Overview/Populated (+ Empty, Loading, Error, AccessDenied, PendingSync)
 * ============================================================================
 */
export function TodayScreen({
  tasks,
  habits,
  completingTaskIds,
  onCompleteTask,
  onOpenTaskDetail,
  onOpenQuickAdd,
  onNavigateSection,
  dataState,
  onChangeDataState,
  showAnnotations,
  reducedMotion,
  syncState,
}: {
  tasks: TaskItem[];
  habits: HabitDefinition[];
  completingTaskIds: string[];
  onCompleteTask: (task: TaskItem) => void;
  onOpenTaskDetail: (task: TaskItem) => void;
  onOpenQuickAdd: () => void;
  onNavigateSection: (sec: NavSectionId) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  reducedMotion: boolean;
  syncState: SyncState;
}) {
  const [awaitingOpen, setAwaitingOpen] = useState(true);
  const [dayLabel, setDayLabel] = useState('Friday, 31 October');

  const activeTasks = tasks.filter(
    (t) => t.status !== 'completed' && !t.awaitingOutcome
  );
  const focusTasks = activeTasks.filter((t) => t.isFocus).slice(0, 3);
  const remainingTasks = activeTasks.filter((t) => !t.isFocus);
  const awaitingTasks = tasks.filter(
    (t) => t.awaitingOutcome && t.status !== 'completed'
  );

  // Calculate today's completed habits count ("2 of 3 habits" or "3 of 3 habits")
  const todayCompletedHabits = habits.filter(
    (h) => h.cells['Oct 31'] === 'complete'
  ).length;

  const showPendingBadges =
    dataState === 'pending-sync' || syncState === 'offline';

  return (
    <div>
      <FrameStateBanner
        frameName={`Today/Overview/${
          dataState === 'populated'
            ? activeTasks.length === 0
              ? 'AllComplete'
              : 'Populated'
            : dataState
        }`}
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      {dataState === 'loading' && <SkeletonList rows={5} />}
      {dataState === 'empty' && (
        <EmptyStateBlock
          title="Welcome to your Productivity Layer"
          description="You have no commitments scheduled for this day yet. Add your first task or sync your course timetable."
          ctaLabel="Quick add commitment"
          onCta={onOpenQuickAdd}
        />
      )}
      {dataState === 'error' && (
        <EmptyStateBlock
          variant="error"
          title="Unable to load Today Overview"
          description="We couldn't reach the Akadverse sync service. Your cached items are safe."
          ctaLabel="Retry connection"
          onCta={() => onChangeDataState('populated')}
        />
      )}
      {dataState === 'access-denied' && (
        <EmptyStateBlock
          variant="access-denied"
          title="Student Portal Access Required"
          description="Switch to an active student session to view personal commitments."
          ctaLabel="Return to Populated"
          onCta={() => onChangeDataState('populated')}
        />
      )}

      {(dataState === 'populated' || dataState === 'pending-sync') && (
        <div className="space-y-6">
          {/* Section 1: Day Header */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0, ease: EASE_CURVE }}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                {dayLabel}
              </h1>
              <div className="flex items-center gap-1">
                <ProdButton
                  variant="icon-only"
                  size="sm"
                  onClick={() => setDayLabel('Thursday, 30 October')}
                  title="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </ProdButton>
                <ProdButton
                  variant="icon-only"
                  size="sm"
                  onClick={() => setDayLabel('Friday, 31 October')}
                  title="Today"
                >
                  <ChevronRight className="w-4 h-4" />
                </ProdButton>
              </div>
            </div>

            <ProdButton
              variant="primary"
              size="md"
              onClick={onOpenQuickAdd}
              reducedMotion={reducedMotion}
            >
              <Plus className="w-4 h-4" />
              <span>Quick add</span>
            </ProdButton>
          </motion.div>

          {/* Section 2: Next Commitment Card (Hero treatment) */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.06, ease: EASE_CURVE }}
            whileHover={
              reducedMotion
                ? undefined
                : { y: -2, transition: { duration: 0.2, ease: EASE_CURVE } }
            }
            onClick={() => onNavigateSection('schedule')}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F6FF 100%)',
              boxShadow: SHADOW_TOKENS.md,
              borderLeft: '3px solid #185CFF',
            }}
            className="rounded-[16px] p-5 cursor-pointer"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                NEXT COMMITMENT
              </span>
              <div className="flex items-center gap-2">
                {showPendingBadges && <StatusPill variant="pending-sync" />}
                <StatusPill variant="official" label="Official Timetable" />
              </div>
            </div>
            <h2 className="text-[20px] leading-[28px] font-semibold tracking-[-0.01em] text-[#0F172A]">
              EEE 311 · Electric Circuit Theory I
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#475569] mt-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#185CFF]" />
                09:00 AM – 11:00 AM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#185CFF]" />
                Engineering Lecture Theatre B
              </span>
              <span className="text-[12px] text-[#94A3B8]">
                Lecturer: Marvelous Ifezue
              </span>
            </div>
          </motion.div>

          {/* Section 3: Focus Today */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.12, ease: EASE_CURVE }}
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                FOCUS
              </span>
              <span className="text-[12px] text-[#94A3B8]">
                {focusTasks.length} priority commitments
              </span>
            </div>

            {focusTasks.length === 0 ? (
              <div
                style={{ boxShadow: SHADOW_TOKENS.xs }}
                className="bg-white rounded-[12px] p-4 text-[13px] text-[#475569] flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>All Focus commitments for today are complete!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {focusTasks.map((task) => (
                    <ActivityCardRow
                      key={task.id}
                      task={task}
                      isFocusStyled
                      isCompleting={completingTaskIds.includes(task.id)}
                      showPendingSync={showPendingBadges}
                      reducedMotion={reducedMotion}
                      onToggleComplete={onCompleteTask}
                      onClickRow={onOpenTaskDetail}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Section 4: Remaining Today */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.18, ease: EASE_CURVE }}
            className="space-y-2.5"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              REMAINING TODAY
            </span>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {remainingTasks.map((task) => (
                  <ActivityCardRow
                    key={task.id}
                    task={task}
                    isCompleting={completingTaskIds.includes(task.id)}
                    showPendingSync={showPendingBadges}
                    reducedMotion={reducedMotion}
                    onToggleComplete={onCompleteTask}
                    onClickRow={onOpenTaskDetail}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Section 5: Awaiting Outcome (Collapsible with 2s amber border pulse) */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.24, ease: EASE_CURVE }}
            style={{ boxShadow: SHADOW_TOKENS.xs }}
            className="bg-white rounded-[16px] p-4 relative overflow-hidden"
          >
            {/* Pulsing 3px Amber Left Border (opacity 0.6 <-> 1, 2s loop) */}
            <motion.div
              animate={reducedMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#F59E0B]"
            />

            <button
              type="button"
              onClick={() => setAwaitingOpen((p) => !p)}
              className="w-full flex items-center justify-between text-left pl-2 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D97706]">
                  AWAITING OUTCOME ({awaitingTasks.length})
                </span>
                <StatusPill variant="unrecorded" />
              </div>
              <motion.div
                animate={{ rotate: awaitingOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: EASE_CURVE }}
              >
                <ChevronDown className="w-4 h-4 text-[#475569]" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {awaitingOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE_CURVE }}
                  className="pt-3 pl-2 space-y-2 overflow-hidden"
                >
                  {awaitingTasks.map((task) => (
                    <ActivityCardRow
                      key={task.id}
                      task={task}
                      isCompleting={completingTaskIds.includes(task.id)}
                      reducedMotion={reducedMotion}
                      onToggleComplete={onCompleteTask}
                      onClickRow={onOpenTaskDetail}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Section 6: Habits Summary Footer */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.3, ease: EASE_CURVE }}
            style={{ boxShadow: SHADOW_TOKENS.sm }}
            className="bg-white rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex-1 max-w-md">
              <ProdProgressBar
                value={todayCompletedHabits}
                max={habits.length}
                label={`${todayCompletedHabits} of ${habits.length} habits completed today`}
                reducedMotion={reducedMotion}
              />
            </div>
            <ProdButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigateSection('habits')}
            >
              <span>Open Habit Grid</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </ProdButton>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * 4.3 TASKS PAGE + 4.4 TASK FORM + 4.5 TASK DETAIL
 * Frames: Tasks/List/Default, Filtered, Empty, NoResults, AllComplete
 * ============================================================================
 */
export function TasksScreen({
  tasks,
  completingTaskIds,
  onCompleteTask,
  onMarkMissedTask,
  onCreateTask,
  selectedTask,
  onSelectTask,
  taskFormOpen,
  onSetTaskFormOpen,
  dataState,
  onChangeDataState,
  showAnnotations,
  reducedMotion,
  onTriggerToast,
  onNavigateHistory,
}: {
  tasks: TaskItem[];
  completingTaskIds: string[];
  onCompleteTask: (t: TaskItem) => void;
  onMarkMissedTask: (t: TaskItem) => void;
  onCreateTask: (newTask: Omit<TaskItem, 'id' | 'status'>) => void;
  selectedTask: TaskItem | null;
  onSelectTask: (t: TaskItem | null) => void;
  taskFormOpen: boolean;
  onSetTaskFormOpen: (open: boolean) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  reducedMotion: boolean;
  onTriggerToast: (t: Omit<ToastMessage, 'id'>) => void;
  onNavigateHistory: () => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'thu'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'due'>('priority');

  // Task Form States (Section 4.4: Default, Valid, Invalid, Submitting, FailedSave)
  const [formFrameState, setFormFrameState] = useState<
    'Default' | 'Valid' | 'Invalid' | 'Submitting' | 'FailedSave'
  >('Default');
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<PriorityLevel>('high');
  const [dueInput, setDueInput] = useState('Fri, 31 Oct · 06:00 PM');
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);

  // Task Detail outcome submitting animation state
  const [detailSubmitting, setDetailSubmitting] = useState(false);

  const uncompletedTasks = tasks.filter((t) => t.status !== 'completed');

  const filteredTasks = uncompletedTasks
    .filter((t) =>
      priorityFilter === 'all' ? true : t.priority === priorityFilter
    )
    .filter((t) =>
      dateFilter === 'all'
        ? true
        : dateFilter === 'today'
        ? t.dueDate.includes('31 Oct')
        : t.dueDate.includes('30 Oct')
    )
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      return a.dueTime.localeCompare(b.dueTime);
    });

  const isFiltered = priorityFilter !== 'all' || dateFilter !== 'all';

  const currentFrameLabel =
    dataState !== 'populated'
      ? `Tasks/List/${dataState}`
      : uncompletedTasks.length === 0
      ? 'Tasks/List/AllComplete'
      : filteredTasks.length === 0
      ? 'Tasks/List/NoResults'
      : isFiltered
      ? 'Tasks/List/Filtered'
      : 'Tasks/List/Default';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formFrameState === 'Invalid' || !titleInput.trim()) {
      setFormFrameState('Invalid');
      return;
    }
    if (formFrameState === 'FailedSave') {
      setShakeCount((c) => c + 1);
      onTriggerToast({
        title: 'Could not save commitment',
        subtitle: 'Server timeout — your input is preserved in the form.',
        tone: 'danger',
      });
      return;
    }

    setFormFrameState('Submitting');
    setTimeout(() => {
      onCreateTask({
        title: titleInput.trim(),
        description: descInput.trim() || 'Added via Productivity Layer Task Form',
        source: 'Personal Task · Intended today',
        sourceType: 'TASK',
        priority: priorityInput,
        dueDate: 'Fri, 31 Oct',
        dueTime: dueInput.split('·')[1]?.trim() || '06:00 PM',
        isFocus: priorityInput === 'high',
        lifeArea: 'Academics',
      });
      setTitleInput('');
      setDescInput('');
      setFormFrameState('Default');
      onSetTaskFormOpen(false);
    }, 550);
  };

  return (
    <div>
      <FrameStateBanner
        frameName={currentFrameLabel}
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <OpenDecisionChip decisionId="OD-10" showAnnotations={showAnnotations} />

      {/* Header + New Task CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            Tasks &amp; Actionable Commitments
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            Click any checkbox to experience the 5-step signature completion sequence (spring fill → SVG draw → row scale → Accent/soft wash → collapse &amp; History tick).
          </p>
        </div>
        <ProdButton
          variant="primary"
          onClick={() => {
            setDetailsRevealed(false);
            setFormFrameState('Default');
            onSetTaskFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </ProdButton>
      </div>

      {/* Filter Bar (4.3) */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.xs }}
        className="bg-white rounded-[14px] p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-[#475569] mr-1 inline-flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Priority:
          </span>
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <motion.button
              key={p}
              whileTap={{ scale: 0.96 }}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium capitalize transition-colors cursor-pointer ${
                priorityFilter === p
                  ? 'bg-[#185CFF] text-white'
                  : 'bg-[#EEF0F4] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {p}
            </motion.button>
          ))}

          <div className="h-4 w-px bg-[#E5E7EB] mx-1" />

          <span className="text-[12px] font-medium text-[#475569]">Date:</span>
          {[
            { id: 'all', label: 'All Dates' },
            { id: 'today', label: 'Today (31 Oct)' },
            { id: 'thu', label: 'Yesterday (30 Oct)' },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setDateFilter(d.id as 'all' | 'today' | 'thu')}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                dateFilter === d.id
                  ? 'bg-[#EEF4FF] text-[#185CFF]'
                  : 'bg-[#EEF0F4] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'due')}
            className="bg-[#EEF0F4] text-[#0F172A] text-[12px] font-medium px-3 py-1.5 rounded-[10px] focus:outline-none"
          >
            <option value="priority">Sort: Priority</option>
            <option value="due">Sort: Due Time</option>
          </select>

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setPriorityFilter('all');
                setDateFilter('all');
              }}
              className="text-[12px] font-medium text-[#185CFF] hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Data States */}
      {dataState === 'loading' && <SkeletonList rows={5} />}
      {dataState === 'empty' && (
        <EmptyStateBlock
          title="No tasks yet"
          description="Break your study goals or personal commitments into actionable tasks."
          ctaLabel="Create first task"
          onCta={() => onSetTaskFormOpen(true)}
        />
      )}
      {dataState === 'error' && (
        <EmptyStateBlock
          variant="error"
          title="Failed to load tasks"
          description="Connection interrupted while fetching your task list."
          ctaLabel="Retry"
          onCta={() => onChangeDataState('populated')}
        />
      )}
      {dataState === 'access-denied' && (
        <EmptyStateBlock
          variant="access-denied"
          title="Task List Locked"
          description="You do not have permission to edit another student's private tasks."
          ctaLabel="Restore View"
          onCta={() => onChangeDataState('populated')}
        />
      )}

      {(dataState === 'populated' || dataState === 'pending-sync') && (
        <>
          {uncompletedTasks.length === 0 ? (
            <EmptyStateBlock
              variant="all-complete"
              title="All tasks complete!"
              description="Every commitment on your list is recorded. Check History to review your completed work."
              ctaLabel="View History"
              onCta={onNavigateHistory}
            />
          ) : filteredTasks.length === 0 ? (
            <EmptyStateBlock
              title="No matching tasks"
              description="No commitments match your active priority and date filters."
              ctaLabel="Clear filters"
              onCta={() => {
                setPriorityFilter('all');
                setDateFilter('all');
              }}
            />
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <ActivityCardRow
                    key={task.id}
                    task={task}
                    isFocusStyled={task.isFocus}
                    isCompleting={completingTaskIds.includes(task.id)}
                    showPendingSync={dataState === 'pending-sync'}
                    reducedMotion={reducedMotion}
                    onToggleComplete={onCompleteTask}
                    onClickRow={(t) => onSelectTask(t)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* 4.4 TASK FORM MODAL (Progressive Reveal, Inline Error, Shake on FailedSave) */}
      <ProdModal
        open={taskFormOpen}
        onClose={() => onSetTaskFormOpen(false)}
        title="Create Commitment Task"
        subtitle={`Frame: Tasks/Form/${formFrameState}`}
      >
        {/* Form Frame State Switcher for Prototype Inspection */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 p-2 rounded-[10px] bg-[#F7F8FA]">
          <span className="text-[11px] font-semibold text-[#475569] mr-1">
            Form Frame:
          </span>
          {(
            ['Default', 'Valid', 'Invalid', 'Submitting', 'FailedSave'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setFormFrameState(st);
                if (st === 'Valid' && !titleInput) {
                  setTitleInput('Complete EEE 321 Bode Plot Lab Analysis');
                  setDetailsRevealed(true);
                }
                if (st === 'FailedSave' && !titleInput) {
                  setTitleInput('Complete EEE 321 Bode Plot Lab Analysis');
                  setDetailsRevealed(true);
                }
              }}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer ${
                formFrameState === st
                  ? 'bg-[#185CFF] text-white'
                  : 'bg-white text-[#475569]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <motion.div
            key={shakeCount}
            animate={
              shakeCount > 0 && !reducedMotion
                ? { x: [0, -6, 6, -6, 6, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.3 }}
          >
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Task title <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={titleInput}
              onFocus={() => setDetailsRevealed(true)}
              onChange={(e) => {
                setTitleInput(e.target.value);
                if (formFrameState === 'Invalid' && e.target.value.trim()) {
                  setFormFrameState('Valid');
                }
              }}
              placeholder="e.g., Solve Thevenin & Norton Problem Set 4"
              className={`w-full px-3.5 py-2.5 rounded-[12px] bg-[#F7F8FA] text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:bg-white transition-all ${
                formFrameState === 'Invalid'
                  ? 'ring-2 ring-[#EF4444]'
                  : 'focus:shadow-[0_0_0_3px_rgba(24,92,255,0.18)]'
              }`}
            />
            {formFrameState === 'Invalid' && (
              <p className="text-[12px] text-[#EF4444] mt-1.5">
                Title is required before saving a commitment.
              </p>
            )}
          </motion.div>

          {/* Progressive reveal: details appear once title is focused or filled */}
          <AnimatePresence initial={false}>
            {(detailsRevealed ||
              titleInput.length > 0 ||
              formFrameState !== 'Default') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: EASE_CURVE }}
                className="space-y-4 overflow-hidden pt-1"
              >
                <div>
                  <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Optional notes, equations, or chapter references..."
                    className="w-full px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,92,255,0.18)]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
                      Priority
                    </label>
                    <SegmentedControl
                      id="task-form-priority"
                      size="sm"
                      value={priorityInput}
                      onChange={setPriorityInput}
                      options={[
                        { value: 'high', label: 'High' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'low', label: 'Low' },
                      ]}
                    />
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
                      Intended Completion
                    </label>
                    <input
                      type="text"
                      value={dueInput}
                      onChange={(e) => setDueInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[10px] bg-[#F7F8FA] text-[13px] text-[#0F172A]"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <ProdButton
              variant="ghost"
              onClick={() => onSetTaskFormOpen(false)}
            >
              Cancel
            </ProdButton>
            <ProdButton
              type="submit"
              variant="primary"
              loading={formFrameState === 'Submitting'}
            >
              Save Commitment
            </ProdButton>
          </div>
        </form>
      </ProdModal>

      {/* 4.5 TASK DETAIL MODAL / SHEET */}
      <ProdModal
        open={!!selectedTask}
        onClose={() => onSelectTask(null)}
        variant="sheet"
        title={selectedTask?.title ?? 'Task Detail'}
        subtitle={`Frame: Tasks/Detail/${
          selectedTask?.status === 'completed'
            ? 'Completed'
            : selectedTask?.status === 'missed'
            ? 'Missed'
            : 'Active'
        }`}
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[12px] bg-[#F7F8FA] sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <StatusPill variant={selectedTask.status} />
                <span className="text-[12px] text-[#475569]">
                  Due {selectedTask.dueDate} at {selectedTask.dueTime}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                {selectedTask.sourceType} · {selectedTask.lifeArea}
              </span>
            </div>

            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8] mb-1">
                Description &amp; Context
              </h4>
              <p className="text-[14px] text-[#0F172A] leading-relaxed">
                {selectedTask.description}
              </p>
              <p className="text-[12px] text-[#94A3B8] mt-1">
                Source: {selectedTask.source}
              </p>
            </div>

            <OpenDecisionChip
              decisionId="OD-07"
              showAnnotations={showAnnotations}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB]/60">
              <button
                type="button"
                onClick={() => {
                  onSelectTask(null);
                  onNavigateHistory();
                }}
                className="text-[13px] font-medium text-[#185CFF] hover:underline cursor-pointer"
              >
                View outcome history →
              </button>

              <div className="flex items-center gap-2.5">
                <ProdButton
                  variant="danger"
                  onClick={() => {
                    onMarkMissedTask(selectedTask);
                    onSelectTask(null);
                  }}
                >
                  Mark missed
                </ProdButton>

                <ProdButton
                  variant="primary"
                  loading={detailSubmitting}
                  onClick={() => {
                    setDetailSubmitting(true);
                    setTimeout(() => {
                      setDetailSubmitting(false);
                      onCompleteTask(selectedTask);
                      onSelectTask(null);
                    }, 400);
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span>Complete</span>
                </ProdButton>
              </div>
            </div>
          </div>
        )}
      </ProdModal>
    </div>
  );
}

/**
 * ============================================================================
 * 4.6 SCHEDULE (WEEK VIEW) + 4.7 AGENDA VIEW + 4.8 FOCUS MODE + 4.9 EVENT DETAIL + 4.17 REPLANNING
 * ============================================================================
 */
export function ScheduleScreen({
  events,
  onUpdateEventNotes,
  onCompleteEvent,
  onTriggerReplan,
  dataState,
  onChangeDataState,
  showAnnotations,
  reducedMotion,
}: {
  events: ScheduleEventItem[];
  onUpdateEventNotes: (eventId: string, notes: string) => void;
  onCompleteEvent: (eventId: string) => void;
  onTriggerReplan: (evt: ScheduleEventItem, newSlotLabel: string) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  reducedMotion: boolean;
}) {
  const [viewMode, setViewMode] = useState<'week' | 'agenda'>('week');
  const [focusMode, setFocusMode] = useState(false);
  const [showConflictDemo, setShowConflictDemo] = useState(false);
  const [personalOnlyFilter, setPersonalOnlyFilter] = useState(false);
  const [selectedLifeArea, setSelectedLifeArea] = useState<'All' | LifeArea>('All');
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventItem | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // 4.17 Replanning Flow Modal state ('Check' | 'Success' | 'Conflict' | 'NoSlot')
  const [replanEvent, setReplanEvent] = useState<ScheduleEventItem | null>(null);
  const [replanStage, setReplanStage] = useState<
    'Check' | 'Success' | 'Conflict' | 'NoSlot'
  >('Check');
  const [customSlot, setCustomSlot] = useState('Sat, 01 Nov · 10:00 AM');

  const days = ['Mon 27', 'Tue 28', 'Wed 29', 'Thu 30', 'Fri 31'];

  const visibleEvents = events
    .filter((e) => (personalOnlyFilter ? !e.isOfficial : true))
    .filter((e) =>
      selectedLifeArea === 'All' ? true : e.lifeArea === selectedLifeArea
    );

  const lifeAreaStyles: Record<
    LifeArea,
    { bg: string; bar: string; text: string }
  > = {
    Academics: {
      bg: 'rgba(24, 92, 255, 0.09)',
      bar: '#185CFF',
      text: '#0F172A',
    },
    Exercise: {
      bg: 'rgba(16, 185, 129, 0.11)',
      bar: '#10B981',
      text: '#064E3B',
    },
    Spirituality: {
      bg: 'rgba(124, 58, 237, 0.10)',
      bar: '#7C3AED',
      text: '#4C1D95',
    },
    Career: {
      bg: 'rgba(245, 158, 11, 0.12)',
      bar: '#F59E0B',
      text: '#78350F',
    },
  };

  const startReplanFlow = (evt: ScheduleEventItem) => {
    setSelectedEvent(null);
    setReplanEvent(evt);
    setReplanStage('Check');
    setTimeout(() => {
      setReplanStage('Success');
    }, 900);
  };

  const frameTitle =
    viewMode === 'agenda'
      ? 'Schedule/Agenda/Mixed'
      : showConflictDemo
      ? 'Schedule/Week/Conflict'
      : focusMode
      ? 'Schedule/Week/FocusOn'
      : personalOnlyFilter
      ? 'Schedule/Week/PersonalOnly'
      : 'Schedule/Week/Mixed';

  return (
    <div>
      <FrameStateBanner
        frameName={frameTitle}
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      {/* Header Controls: Week/Agenda Segmented Control + Focus Mode Toggle + Conflict Demo */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            Academic &amp; Personal Schedule
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            Official timetable classes feature a lock icon &amp; diagonal corner stripe. Toggle Focus Mode to dim non-focus blocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            id="schedule-view"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'agenda', label: 'Agenda' },
            ]}
          />

          {/* 4.8 Focus Mode Sliding Pill Toggle */}
          <button
            type="button"
            onClick={() => setFocusMode((f) => !f)}
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
              focusMode
                ? 'bg-[#185CFF] text-white shadow-[0_8px_24px_rgba(24,92,255,0.22)]'
                : 'bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
            }`}
          >
            <span>Focus Mode</span>
            <div
              className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                focusMode ? 'bg-white/30 justify-end' : 'bg-[#CBD5E1] justify-start'
              }`}
            >
              <motion.div
                layout
                transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                className="w-3 h-3 rounded-full bg-white"
              />
            </div>
          </button>

          <ProdButton
            size="sm"
            variant={showConflictDemo ? 'danger' : 'secondary'}
            onClick={() => setShowConflictDemo((c) => !c)}
          >
            {showConflictDemo ? 'Conflict Active' : 'Simulate Conflict'}
          </ProdButton>
        </div>
      </div>

      {/* Life-area pills row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Academics', 'Exercise', 'Spirituality', 'Career'] as const).map(
            (area) => (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedLifeArea(area)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                  selectedLifeArea === area
                    ? 'bg-[#185CFF] text-white'
                    : 'bg-white text-[#475569] hover:bg-[#EEF0F4]'
                }`}
                style={{ boxShadow: SHADOW_TOKENS.xs }}
              >
                {area}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => setPersonalOnlyFilter((p) => !p)}
          className={`text-[12px] font-medium px-3 py-1 rounded-full cursor-pointer transition-colors ${
            personalOnlyFilter
              ? 'bg-[#EEF4FF] text-[#185CFF]'
              : 'text-[#475569] hover:text-[#0F172A]'
          }`}
        >
          {personalOnlyFilter
            ? 'Showing Personal Only (Click to show Official)'
            : 'Filter: Hide Official Timetable'}
        </button>
      </div>

      {dataState === 'loading' && <SkeletonList rows={5} />}
      {dataState === 'empty' && (
        <EmptyStateBlock
          title="No schedule blocks in this view"
          description="Priority stays separate from Focus Mode. Add a study session or restore your official timetable."
          ctaLabel="Show all events"
          onCta={() => {
            setPersonalOnlyFilter(false);
            onChangeDataState('populated');
          }}
        />
      )}

      {(dataState === 'populated' || dataState === 'pending-sync') && (
        <>
          {viewMode === 'week' ? (
            /* 4.6 WEEK VIEW GRID */
            <div
              style={{ boxShadow: SHADOW_TOKENS.sm }}
              className="bg-white rounded-[16px] p-5 overflow-x-auto relative"
            >
              {/* Now-line: 2px accent + pulsing dot at left edge (scale 1 <-> 1.3, 2s) */}
              <div
                style={{ top: '185px' }}
                className="pointer-events-none absolute left-4 right-4 z-20 flex items-center"
              >
                <motion.div
                  animate={
                    reducedMotion ? { scale: 1 } : { scale: [1, 1.3, 1] }
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="w-2.5 h-2.5 rounded-full bg-[#185CFF] -ml-1"
                />
                <div className="flex-1 h-[2px] bg-[#185CFF]/80" />
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#185CFF] text-white text-[10px] font-semibold">
                  NOW · 10:15 AM
                </span>
              </div>

              <div className="grid grid-cols-5 gap-3 min-w-[780px]">
                {days.map((day, dIdx) => {
                  const dayEvents = visibleEvents.filter(
                    (e) => e.dayIndex === dIdx
                  );
                  const isToday = dIdx === 4;
                  return (
                    <div
                      key={day}
                      className={`rounded-[12px] p-3 min-h-[380px] ${
                        isToday ? 'bg-[#EEF4FF]/45' : 'bg-[#F7F8FA]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E5E7EB]/70">
                        <span
                          className={`text-[13px] font-semibold ${
                            isToday ? 'text-[#185CFF]' : 'text-[#0F172A]'
                          }`}
                        >
                          {day}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full bg-[#185CFF] text-white text-[10px] font-semibold uppercase">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {dayEvents.map((evt) => {
                          const style = lifeAreaStyles[evt.lifeArea];
                          const dimmedByFocus = focusMode && !evt.isFocus;
                          const highlightedByFocus = focusMode && evt.isFocus;
                          const isConflicting =
                            showConflictDemo && evt.id === 'evt-circuit-study';

                          return (
                            <motion.div
                              key={evt.id}
                              animate={{
                                opacity: dimmedByFocus ? 0.25 : 1,
                                scale: highlightedByFocus ? 1.02 : 1,
                                filter: dimmedByFocus
                                  ? 'grayscale(100%)'
                                  : 'grayscale(0%)',
                              }}
                              whileHover={
                                reducedMotion
                                  ? undefined
                                  : { y: -1, boxShadow: SHADOW_TOKENS.sm }
                              }
                              transition={{ duration: 0.3, ease: EASE_CURVE }}
                              onClick={() => {
                                setSelectedEvent(evt);
                                setNotesDraft(evt.studentNotes ?? '');
                              }}
                              style={{
                                backgroundColor: style.bg,
                                borderLeft: `3px solid ${style.bar}`,
                                boxShadow: highlightedByFocus
                                  ? SHADOW_TOKENS.accent
                                  : undefined,
                              }}
                              className={`relative rounded-[12px] p-[10px] cursor-pointer overflow-hidden ${
                                isConflicting
                                  ? 'outline-2 outline-dashed outline-[#EF4444]'
                                  : ''
                              }`}
                            >
                              {/* Official Class Diagonal Stripe Corner + Lock Icon 12px */}
                              {evt.isOfficial && (
                                <div
                                  title="Official University Timetable (Read-only)"
                                  className="absolute top-0 right-0 w-7 h-7 flex items-start justify-end p-1"
                                  style={{
                                    background:
                                      'repeating-linear-gradient(135deg, rgba(24,92,255,0.18), rgba(24,92,255,0.18) 3px, transparent 3px, transparent 6px)',
                                  }}
                                >
                                  <Lock className="w-3 h-3 text-[#185CFF]" />
                                </div>
                              )}

                              <p className="text-[11px] font-semibold text-[#475569]">
                                {Math.floor(evt.startHour)}:
                                {evt.startHour % 1 === 0.5 ? '30' : '00'} ·{' '}
                                {evt.durationHours}h
                              </p>
                              <p
                                style={{ color: style.text }}
                                className="text-[13px] font-semibold leading-snug mt-0.5 pr-4"
                              >
                                {evt.title}
                              </p>
                              <p className="text-[11px] text-[#475569] truncate mt-1">
                                {evt.location}
                              </p>

                              {isConflicting && (
                                <div className="mt-2 px-2 py-1 rounded-[8px] bg-[#EF4444] text-white text-[11px] font-medium flex items-center justify-between">
                                  <span>Overlap · Choose another time</span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 4.7 SCHEDULE — AGENDA VIEW (Mobile Baseline) */
            <div className="space-y-4">
              {days.map((day, dIdx) => {
                const dayEvents = visibleEvents.filter(
                  (e) => e.dayIndex === dIdx
                );
                if (dayEvents.length === 0) return null;
                return (
                  <div
                    key={day}
                    style={{ boxShadow: SHADOW_TOKENS.sm }}
                    className="bg-white rounded-[16px] p-5"
                  >
                    <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">
                      {day}
                    </h3>
                    <div className="space-y-3">
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => {
                            setSelectedEvent(evt);
                            setNotesDraft(evt.studentNotes ?? '');
                          }}
                          className="flex items-start gap-4 p-3 rounded-[12px] bg-[#F7F8FA] hover:bg-[#EEF4FF]/50 transition-colors cursor-pointer"
                        >
                          <div className="w-20 shrink-0 text-[12px] font-semibold text-[#475569] tabular-nums">
                            {Math.floor(evt.startHour)}:00
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[14px] font-semibold text-[#0F172A] truncate">
                                {evt.title}
                              </p>
                              {evt.isOfficial && (
                                <StatusPill variant="official" />
                              )}
                            </div>
                            <p className="text-[12px] text-[#475569] mt-0.5">
                              {evt.location} · {evt.lifeArea}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 4.9 EVENT DETAIL MODAL (Official Read-Only vs Personal Editable) */}
      <ProdModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title ?? 'Event Detail'}
        subtitle={`Frame: Schedule/EventDetail/${
          selectedEvent?.isOfficial ? 'Official' : 'Personal'
        }`}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[#F7F8FA]">
              <div className="flex items-center gap-2">
                {selectedEvent.isOfficial ? (
                  <StatusPill variant="official" label="Official Class (Read-Only)" />
                ) : (
                  <StatusPill variant={selectedEvent.status} />
                )}
                <span className="text-[12px] font-medium text-[#475569]">
                  {selectedEvent.dayLabel} · {Math.floor(selectedEvent.startHour)}:00
                </span>
              </div>
              {selectedEvent.isOfficial && (
                <Lock className="w-4 h-4 text-[#185CFF]" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="p-3 rounded-[12px] bg-[#F7F8FA]">
                <p className="text-[11px] font-semibold uppercase text-[#94A3B8]">
                  Location
                </p>
                <p className="font-medium text-[#0F172A] mt-0.5">
                  {selectedEvent.location}
                </p>
              </div>
              <div className="p-3 rounded-[12px] bg-[#F7F8FA]">
                <p className="text-[11px] font-semibold uppercase text-[#94A3B8]">
                  Life Area
                </p>
                <p className="font-medium text-[#0F172A] mt-0.5">
                  {selectedEvent.lifeArea}
                </p>
              </div>
            </div>

            {selectedEvent.isOfficial ? (
              /* Official Event: Student Notes visually separated below a divider */
              <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-[#0F172A]">
                    Personal Student Notes (Editable)
                  </label>
                  <span className="text-[11px] text-[#94A3B8]">
                    Official time &amp; venue locked by Registrar
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Add personal lecture prep notes..."
                  className="w-full p-3 rounded-[12px] bg-[#F7F8FA] text-[13px] text-[#0F172A] focus:outline-none focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,92,255,0.18)]"
                />
                <div className="flex justify-end gap-2">
                  <ProdButton
                    variant="secondary"
                    onClick={() => {
                      setPersonalOnlyFilter(true);
                      setSelectedEvent(null);
                    }}
                  >
                    Back to Personal Only
                  </ProdButton>
                  <ProdButton
                    variant="primary"
                    onClick={() => {
                      onUpdateEventNotes(selectedEvent.id, notesDraft);
                      setSelectedEvent(null);
                    }}
                  >
                    Save Notes
                  </ProdButton>
                </div>
              </div>
            ) : (
              /* Personal Event: Editable outcome & backup slot + Replanning trigger */
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-[12px] bg-[#EEF4FF]/60 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#185CFF]">
                      Backup Reschedule Slot
                    </p>
                    <p className="text-[13px] font-medium text-[#0F172A]">
                      {selectedEvent.backupSlot ?? 'Sat, 01 Nov · 08:00 AM'}
                    </p>
                  </div>
                  <Calendar className="w-4 h-4 text-[#185CFF]" />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <ProdButton
                    variant="danger"
                    onClick={() => startReplanFlow(selectedEvent)}
                  >
                    Mark missed &amp; Replan
                  </ProdButton>
                  <ProdButton
                    variant="primary"
                    onClick={() => {
                      onCompleteEvent(selectedEvent.id);
                      setSelectedEvent(null);
                    }}
                  >
                    <Check className="w-4 h-4" />
                    <span>Complete Session</span>
                  </ProdButton>
                </div>
              </div>
            )}
          </div>
        )}
      </ProdModal>

      {/* 4.17 REPLANNING FLOW MODAL (Replan/Check, Replan/Success, Replan/Conflict, Replan/NoSlot) */}
      <ProdModal
        open={!!replanEvent}
        onClose={() => setReplanEvent(null)}
        title="Smart Commitment Replanning"
        subtitle={`Frame: Replan/${replanStage}`}
      >
        {replanEvent && (
          <div className="space-y-4">
            {/* Stage switcher for prototype inspection */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-[10px] bg-[#F7F8FA]">
              <span className="text-[11px] font-semibold text-[#475569] mr-1">
                Replan State:
              </span>
              {(['Check', 'Success', 'Conflict', 'NoSlot'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReplanStage(st)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium cursor-pointer ${
                    replanStage === st
                      ? 'bg-[#185CFF] text-white'
                      : 'bg-white text-[#475569]'
                  }`}
                >
                  Replan/{st}
                </button>
              ))}
            </div>

            {replanStage === 'Check' && (
              <div className="py-8 text-center space-y-3">
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                      transition={{
                        duration: 0.9,
                        delay: i * 0.15,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="w-2.5 h-2.5 rounded-full bg-[#185CFF]"
                    />
                  ))}
                </div>
                <p className="text-[14px] font-medium text-[#0F172A]">
                  Checking timetable availability &amp; backup slot…
                </p>
                <div className="w-48 h-1.5 bg-[#EEF0F4] rounded-full mx-auto overflow-hidden">
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-1/2 h-full bg-[#185CFF] rounded-full"
                  />
                </div>
              </div>
            )}

            {replanStage === 'Success' && (
              <div className="space-y-4">
                <div className="p-4 rounded-[14px] bg-[#F7F8FA] space-y-2 overflow-hidden">
                  <motion.p
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25, ease: EASE_CURVE }}
                    className="text-[13px] text-[#94A3B8] line-through"
                  >
                    Original: {replanEvent.dayLabel} · {Math.floor(replanEvent.startHour)}:00 (Marked Missed, retained in History)
                  </motion.p>
                  <motion.p
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25, delay: 0.08, ease: EASE_CURVE }}
                    className="text-[15px] font-semibold text-[#10B981] flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      New Slot: {replanEvent.backupSlot ?? 'Fri, 31 Oct · 04:30 PM'}
                    </span>
                  </motion.p>
                </div>
                <div className="flex justify-end gap-2">
                  <ProdButton
                    variant="secondary"
                    onClick={() => setReplanStage('Conflict')}
                  >
                    View Conflict Alt Path
                  </ProdButton>
                  <ProdButton
                    variant="primary"
                    onClick={() => {
                      onTriggerReplan(
                        replanEvent,
                        replanEvent.backupSlot ?? 'Fri, 31 Oct · 04:30 PM'
                      );
                      setReplanEvent(null);
                    }}
                  >
                    Confirm Replan
                  </ProdButton>
                </div>
              </div>
            )}

            {replanStage === 'Conflict' && (
              <div className="space-y-4">
                <motion.div
                  initial={{ y: -12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.2, ease: EASE_CURVE }}
                  className="p-3 rounded-[12px] bg-[#FEE2E2] text-[#B91C1C] text-[13px] font-medium flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Backup time overlaps with GET 307 · Intro to AI (2:00 PM). Choose another time:
                  </span>
                </motion.div>

                <div className="space-y-2">
                  {[
                    'Fri, 31 Oct · 04:30 PM – 06:00 PM',
                    'Sat, 01 Nov · 09:00 AM – 10:30 AM',
                  ].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        onTriggerReplan(replanEvent, slot);
                        setReplanEvent(null);
                      }}
                      className="w-full p-3 rounded-[12px] bg-[#F7F8FA] hover:bg-[#EEF4FF] text-left text-[13px] font-medium text-[#0F172A] flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span>{slot}</span>
                      <span className="text-[#185CFF] font-semibold">
                        Choose →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {replanStage === 'NoSlot' && (
              <div className="space-y-4">
                <OpenDecisionChip
                  decisionId="OD-09"
                  showAnnotations={showAnnotations}
                />
                <p className="text-[13px] text-[#475569]">
                  No automatic free window matched today. Pick a manual date and time:
                </p>
                <input
                  type="text"
                  value={customSlot}
                  onChange={(e) => setCustomSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F7F8FA] text-[14px] text-[#0F172A]"
                />
                <div className="flex justify-end">
                  <ProdButton
                    variant="primary"
                    onClick={() => {
                      onTriggerReplan(replanEvent, customSlot);
                      setReplanEvent(null);
                    }}
                  >
                    Schedule Manual Slot
                  </ProdButton>
                </div>
              </div>
            )}
          </div>
        )}
      </ProdModal>
    </div>
  );
}

/**
 * ============================================================================
 * 4.10 HABITS — MONTHLY GRID + 4.11 HABIT FORM & DETAIL
 * Frames: Habits/Grid/Populated, Scrolled, Empty, Feedback
 * ============================================================================
 */
export function HabitsScreen({
  habits,
  onToggleHabitCell,
  onCreateHabit,
  dataState,
  onChangeDataState,
  showAnnotations,
  reducedMotion,
  syncState,
}: {
  habits: HabitDefinition[];
  onToggleHabitCell: (habitId: string, dateKey: string) => void;
  onCreateHabit: (h: HabitDefinition) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  reducedMotion: boolean;
  syncState: SyncState;
}) {
  const [monthIndex, setMonthIndex] = useState(1); // 0 = Jan, 1 = February 2026 (matches reference), 9 = October 2026
  const monthNames = [
    'January 2026',
    'February 2026',
    'March 2026',
    'October 2026',
  ];
  const monthLabel = monthNames[monthIndex] ?? 'February 2026';

  const [activeHabitId, setActiveHabitId] = useState<string>(
    habits[0]?.id ?? 'habit-jog'
  );
  const [selectedHabit, setSelectedHabit] = useState<HabitDefinition | null>(null);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [habitType, setHabitType] = useState<'task' | 'event'>('event');
  const [habitName, setHabitName] = useState('Jog');
  const [habitDays, setHabitDays] = useState('Mon, Wed, Fri');
  const [habitTime, setHabitTime] = useState('6 a.m.');

  // Attendance-style 28-day month calendar statuses per habit (matching reference image Screenshot_2026-11-05_20104855555555.png)
  type AttendanceDayStatus = 'attended' | 'missed' | 'none' | 'upcoming';
  const [calendarOverrides, setCalendarOverrides] = useState<
    Record<string, AttendanceDayStatus>
  >({});

  const activeHabit =
    habits.find((h) => h.id === activeHabitId) ?? habits[0];

  const getDayStatus = (
    habitId: string,
    day: number
  ): AttendanceDayStatus => {
    const key = `${habitId}-${monthIndex}-${day}`;
    if (calendarOverrides[key]) return calendarOverrides[key];

    const col = (day - 1) % 7; // 0 = SUN, 1 = MON ... 6 = SAT
    if (col === 0 || col === 6) return 'none';
    if (habitId === 'habit-jog') {
      if (day === 10 || day === 20) return 'missed';
      if (day > 27) return 'upcoming';
      return 'attended';
    }
    if (habitId === 'habit-circuits') {
      if (day === 12) return 'missed';
      if (day >= 26) return 'upcoming';
      return 'attended';
    }
    if (day === 5 || day === 19) return 'missed';
    return 'attended';
  };

  const handleCycleCalendarDay = (habitId: string, day: number) => {
    const current = getDayStatus(habitId, day);
    const nextOrder: Record<AttendanceDayStatus, AttendanceDayStatus> = {
      attended: 'missed',
      missed: 'upcoming',
      upcoming: 'none',
      none: 'attended',
    };
    const next = nextOrder[current];
    setCalendarOverrides((prev) => ({
      ...prev,
      [`${habitId}-${monthIndex}-${day}`]: next,
    }));
    const mappedDateKey = HABIT_DATES[day % HABIT_DATES.length];
    onToggleHabitCell(habitId, mappedDateKey);
  };

  const jogHabit = activeHabit ?? habits[0];
  const jogCells = jogHabit ? Object.values(jogHabit.cells) : [];
  const jogComplete = jogCells.filter((c) => c === 'complete').length;
  const jogMissed = jogCells.filter((c) => c === 'missed').length;
  const jogUnrecorded = jogCells.filter(
    (c) => c === 'today-scheduled' || c === 'scheduled'
  ).length;
  const jogTotalScheduled = jogComplete + jogMissed + jogUnrecorded;

  const habitCardMeta: Record<
    string,
    {
      streak: string;
      rate: number;
      icon: React.ComponentType<{ className?: string }>;
      tintBg: string;
      tintText: string;
    }
  > = {
    'habit-jog': {
      streak: '14d streak',
      rate: 90,
      icon: Dumbbell,
      tintBg: 'bg-emerald-50',
      tintText: 'text-emerald-600',
    },
    'habit-circuits': {
      streak: '21d streak',
      rate: 95,
      icon: Brain,
      tintBg: 'bg-blue-50',
      tintText: 'text-blue-600',
    },
    'habit-reflect': {
      streak: '9d streak',
      rate: 88,
      icon: Flame,
      tintBg: 'bg-amber-50',
      tintText: 'text-amber-600',
    },
  };

  return (
    <div>
      <FrameStateBanner
        frameName={`Habits/Grid/${
          dataState === 'populated' ? 'Populated' : dataState
        }`}
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            Habits &amp; Consistency Tracker
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            Select any compact habit card below to inspect or update its monthly attendance calendar.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ProdButton variant="primary" onClick={() => setHabitFormOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New Habit</span>
          </ProdButton>
        </div>
      </div>

      {dataState === 'loading' && <SkeletonList rows={4} />}
      {dataState === 'empty' && (
        <EmptyStateBlock
          title="No active habits yet"
          description="Create repeating study or wellness habits to track daily consistency."
          ctaLabel="Create habit rule"
          onCta={() => setHabitFormOpen(true)}
        />
      )}

      {(dataState === 'populated' || dataState === 'pending-sync') && (
        <div className="space-y-5">
          {/* Top Row: Compact Attendance-Style Habit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {habits.map((h) => {
              const isSelected = h.id === activeHabit?.id;
              const meta = habitCardMeta[h.id] ?? {
                streak: '7d streak',
                rate: 85,
                icon: BookOpen,
                tintBg: 'bg-indigo-50',
                tintText: 'text-indigo-600',
              };
              const IconComp = meta.icon;
              const todayState = h.cells['Oct 31'];

              return (
                <motion.div
                  key={h.id}
                  whileHover={reducedMotion ? undefined : { y: -2 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  onClick={() => setActiveHabitId(h.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#185CFF] text-white border-transparent shadow-md'
                      : 'bg-white text-slate-800 border-slate-200/70 hover:border-slate-300 shadow-[0_2px_8px_rgba(15,23,42,0.04)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : `${meta.tintBg} ${meta.tintText}`
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {meta.streak} · {meta.rate}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHabit(h);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                          isSelected
                            ? 'bg-white/15 text-white hover:bg-white/25'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Rule
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-[15px] leading-snug truncate">
                        {h.name}
                      </h3>
                      <p
                        className={`text-[12px] truncate mt-0.5 ${
                          isSelected ? 'text-white/80' : 'text-slate-500'
                        }`}
                      >
                        {h.frequencyLabel} · {h.timeLabel}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHabitCell(h.id, 'Oct 31');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                        todayState === 'complete'
                          ? isSelected
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-emerald-500 text-white'
                          : isSelected
                          ? 'bg-white text-[#185CFF]'
                          : 'bg-[#EEF4FF] text-[#185CFF]'
                      }`}
                    >
                      {todayState === 'complete' ? '✓ Done' : 'Mark Today'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Main Content Row: Attendance-Style Calendar Card + Compact Supportive Feedback Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Attendance-Style Habit Calendar Card (2 cols) */}
            <div
              style={{ boxShadow: SHADOW_TOKENS.sm }}
              className="lg:col-span-2 bg-white rounded-[20px] p-6 border border-slate-100"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h2 className="text-[18px] font-bold text-[#0F172A] tracking-tight">
                  {activeHabit?.name ?? 'Habit'} Attendance Calendar
                </h2>

                <div className="inline-flex items-center gap-3 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      setMonthIndex(
                        (m) => (m - 1 + monthNames.length) % monthNames.length
                      )
                    }
                    className="p-1 hover:bg-white hover:shadow-2xs rounded-full transition-all text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[13px] font-bold text-[#0F172A] min-w-[115px] text-center">
                    {monthLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMonthIndex((m) => (m + 1) % monthNames.length)
                    }
                    className="p-1 hover:bg-white hover:shadow-2xs rounded-full transition-all text-slate-600 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Legend matching Reference Image */}
              <div className="flex flex-wrap items-center gap-5 mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#00B87C]" />
                  <span className="text-[12px] font-semibold text-slate-600">
                    Present / Attended
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FF2C55]" />
                  <span className="text-[12px] font-semibold text-slate-600">
                    Absent / Missed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200" />
                  <span className="text-[12px] font-semibold text-slate-600">
                    No Event
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#B9BEC3]" />
                  <span className="text-[12px] font-semibold text-slate-600">
                    Upcoming
                  </span>
                </div>
              </div>

              {/* Compact 7-Column Calendar Grid matching Reference Image */}
              <div className="grid grid-cols-7 gap-2.5">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(
                  (dayHeader) => (
                    <div
                      key={dayHeader}
                      className="text-center text-[11px] font-bold text-slate-400 uppercase py-1 tracking-wider"
                    >
                      {dayHeader}
                    </div>
                  )
                )}

                {Array.from({ length: 28 }, (_, i) => i + 1).map((dayNum) => {
                  const status = getDayStatus(
                    activeHabit?.id ?? 'habit-jog',
                    dayNum
                  );

                  let tileClasses = '';
                  if (status === 'attended') {
                    tileClasses =
                      'bg-[#00B87C] hover:bg-[#00A36C] text-white shadow-[0_2px_8px_rgba(0,184,124,0.22)]';
                  } else if (status === 'missed') {
                    tileClasses =
                      'bg-[#FF2C55] hover:bg-[#E62249] text-white shadow-[0_2px_8px_rgba(255,44,85,0.22)]';
                  } else if (status === 'upcoming') {
                    tileClasses =
                      'bg-[#B9BEC3] hover:brightness-95 text-white';
                  } else {
                    tileClasses =
                      'bg-[#F9FAFB] hover:bg-slate-100/80 text-slate-400 border border-slate-100/80';
                  }

                  return (
                    <motion.button
                      key={dayNum}
                      type="button"
                      whileHover={reducedMotion ? undefined : { y: -1 }}
                      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                      onClick={() =>
                        handleCycleCalendarDay(
                          activeHabit?.id ?? 'habit-jog',
                          dayNum
                        )
                      }
                      className={`h-12 sm:h-14 rounded-[14px] flex items-center justify-center text-[13px] font-bold transition-colors cursor-pointer select-none ${tileClasses}`}
                    >
                      {dayNum}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Supportive Feedback & Quick Multi-Habit Strip (1 col) */}
            <div
              style={{ boxShadow: SHADOW_TOKENS.sm }}
              className="bg-white rounded-[20px] p-5 border border-slate-100 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    HABITS/GRID/FEEDBACK
                  </span>
                  {(dataState === 'pending-sync' || syncState === 'offline') && (
                    <StatusPill variant="pending-sync" />
                  )}
                </div>

                <h3 className="text-[17px] font-semibold text-[#0F172A]">
                  Supportive Consistency Summary
                </h3>

                <p className="text-[13.5px] text-[#0F172A] leading-relaxed bg-[#F7F8FA] p-3.5 rounded-[12px]">
                  “You completed{' '}
                  <strong>
                    {jogComplete} of {jogTotalScheduled}
                  </strong>{' '}
                  recent sessions for <strong>{jogHabit?.name}</strong>;{' '}
                  <strong>{jogMissed}</strong> was missed,{' '}
                  <strong>{jogUnrecorded}</strong> has no recorded outcome.”
                </p>

                <ProdProgressBar
                  value={jogComplete}
                  max={jogTotalScheduled}
                  label={`${jogHabit?.name} Completion Rate`}
                  reducedMotion={reducedMotion}
                />

                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Today’s Check-off (Oct 31)
                  </p>
                  {habits.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-[10px] bg-[#F7F8FA]"
                    >
                      <span className="text-[12.5px] font-medium text-[#0F172A] truncate">
                        {h.name}
                      </span>
                      <HabitGridCellView
                        state={h.cells['Oct 31'] ?? 'today-scheduled'}
                        reducedMotion={reducedMotion}
                        onClick={() => onToggleHabitCell(h.id, 'Oct 31')}
                      />
                    </div>
                  ))}
                </div>

                <OpenDecisionChip
                  decisionId="OD-01"
                  showAnnotations={showAnnotations}
                />
              </div>

              <div className="pt-3 border-t border-[#E5E7EB]/60 flex items-center justify-between text-[12px] text-[#475569]">
                <span>Edit occurrence or rule</span>
                <button
                  type="button"
                  onClick={() => setSelectedHabit(activeHabit ?? habits[0])}
                  className="text-[#185CFF] font-semibold hover:underline cursor-pointer"
                >
                  Inspect Rule →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4.11 HABIT FORM MODAL */}
      <ProdModal
        open={habitFormOpen}
        onClose={() => setHabitFormOpen(false)}
        title="Create Repeating Habit"
        subtitle={`Frame: Habits/Form/${
          habitType === 'event' ? 'EventType' : 'Default'
        }`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Habit Type
            </label>
            <SegmentedControl
              id="habit-type-seg"
              value={habitType}
              onChange={setHabitType}
              options={[
                { value: 'task', label: 'Task Habit (Flexible)' },
                { value: 'event', label: 'Event Habit (Start + End Time)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Habit Name
            </label>
            <input
              type="text"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[14px] text-[#0F172A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
                Days of Week
              </label>
              <input
                type="text"
                value={habitDays}
                onChange={(e) => setHabitDays(e.target.value)}
                className="w-full px-3 py-2 rounded-[12px] bg-[#F7F8FA] text-[13px] text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
                {habitType === 'event' ? 'Start & End Time' : 'Completion Time'}
              </label>
              <input
                type="text"
                value={habitTime}
                onChange={(e) => setHabitTime(e.target.value)}
                className="w-full px-3 py-2 rounded-[12px] bg-[#F7F8FA] text-[13px] text-[#0F172A]"
              />
            </div>
          </div>

          {/* Plain-language preview (4.11) */}
          <div className="p-3.5 rounded-[12px] bg-[#EEF4FF] text-[#185CFF] text-[13px] font-medium">
            Plain-language preview: “{habitName} every {habitDays} at {habitTime}”
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ProdButton variant="ghost" onClick={() => setHabitFormOpen(false)}>
              Cancel
            </ProdButton>
            <ProdButton
              variant="primary"
              onClick={() => {
                onCreateHabit({
                  id: `hab-${Date.now()}`,
                  name: habitName || 'Study Habit',
                  description: `${habitName} every ${habitDays} at ${habitTime}`,
                  type: habitType,
                  frequencyLabel: habitDays,
                  timeLabel: habitTime,
                  priority: 'medium',
                  lifeArea: 'Exercise',
                  startDate: '2026-10-31',
                  cells: {
                    'Oct 25': 'not-scheduled',
                    'Oct 26': 'not-scheduled',
                    'Oct 27': 'complete',
                    'Oct 28': 'not-scheduled',
                    'Oct 29': 'complete',
                    'Oct 30': 'not-scheduled',
                    'Oct 31': 'today-scheduled',
                  },
                });
                setHabitFormOpen(false);
              }}
            >
              Save Habit Rule
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* 4.11 HABIT DETAIL MODAL ("Edit this occurrence" vs "Edit repeating rule") */}
      <ProdModal
        open={!!selectedHabit}
        onClose={() => setSelectedHabit(null)}
        title={selectedHabit?.name ?? 'Habit Detail'}
        subtitle="Frame: Habits/Detail/Upcoming"
      >
        {selectedHabit && (
          <div className="space-y-4">
            <p className="text-[14px] text-[#475569]">
              {selectedHabit.description}
            </p>
            <div className="p-3 rounded-[12px] bg-[#F7F8FA] text-[13px] space-y-1">
              <p>
                <strong>Frequency:</strong> {selectedHabit.frequencyLabel} ({selectedHabit.timeLabel})
              </p>
              <p>
                <strong>Next Occurrence:</strong> Today, Fri 31 Oct
              </p>
            </div>

            <OpenDecisionChip
              decisionId="OD-03"
              showAnnotations={showAnnotations}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB]/60">
              <ProdButton
                variant="secondary"
                size="sm"
                onClick={() => setSelectedHabit(null)}
              >
                Edit this occurrence
              </ProdButton>
              <ProdButton
                variant="primary"
                size="sm"
                onClick={() => setSelectedHabit(null)}
              >
                Edit repeating rule
              </ProdButton>
            </div>
          </div>
        )}
      </ProdModal>
    </div>
  );
}

/**
 * ============================================================================
 * 4.19 GOALS SCREEN
 * Assignment example: Research -> Draft -> Review -> Submit
 * Distinct visuals for session completion vs task completion
 * ============================================================================
 */
export function GoalsScreen({
  goals,
  onToggleGoalStep,
  onAddGoalStep,
  dataState,
  onChangeDataState,
  showAnnotations,
  reducedMotion,
}: {
  goals: GoalItem[];
  onToggleGoalStep: (goalId: string, stepId: string) => void;
  onAddGoalStep: (goalId: string, title: string, kind: 'session' | 'task') => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  reducedMotion: boolean;
}) {
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id ?? '');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepKind, setNewStepKind] = useState<'session' | 'task'>('task');

  const activeGoal = goals.find((g) => g.id === selectedGoalId) ?? goals[0];

  return (
    <div>
      <FrameStateBanner
        frameName="Goals/Detail/InProgress"
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <OpenDecisionChip decisionId="OD-02" showAnnotations={showAnnotations} />

      <div className="mb-5">
        <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
          Academic &amp; Personal Goals
        </h1>
        <p className="text-[14px] text-[#475569] mt-0.5">
          Milestone progression (Research → Draft → Review → Submit) with distinct visual treatments for timed Study Sessions vs Task deliverables.
        </p>
      </div>

      {dataState === 'loading' && <SkeletonList rows={4} />}
      {dataState === 'empty' && (
        <EmptyStateBlock
          title="No active goals"
          description="Link your term papers and exam prep into structured multi-step milestones."
          ctaLabel="Restore Goals"
          onCta={() => onChangeDataState('populated')}
        />
      )}

      {(dataState === 'populated' || dataState === 'pending-sync') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Goal List */}
          <div className="space-y-3">
            {goals.map((g) => {
              const done = g.steps.filter((s) => s.completed).length;
              const isSelected = g.id === activeGoal?.id;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGoalId(g.id)}
                  style={{
                    boxShadow: isSelected
                      ? SHADOW_TOKENS.md
                      : SHADOW_TOKENS.xs,
                    borderLeft: isSelected ? '3px solid #185CFF' : undefined,
                  }}
                  className={`p-4 rounded-[16px] cursor-pointer transition-colors ${
                    isSelected ? 'bg-white' : 'bg-white/80 hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    {g.courseOrArea}
                  </span>
                  <h3 className="text-[15px] font-semibold text-[#0F172A] mt-1">
                    {g.title}
                  </h3>
                  <p className="text-[12px] text-[#94A3B8] mt-1 mb-3">
                    Target: {g.targetDate}
                  </p>
                  <ProdProgressBar
                    value={done}
                    max={g.steps.length}
                    label={`${done} of ${g.steps.length} steps`}
                    reducedMotion={reducedMotion}
                  />
                </div>
              );
            })}
          </div>

          {/* Right: Goal Detail & Steps */}
          {activeGoal && (
            <div
              style={{ boxShadow: SHADOW_TOKENS.sm }}
              className="lg:col-span-2 bg-white rounded-[16px] p-6 space-y-5"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                  GOAL MILESTONE PIPELINE
                </span>
                <h2 className="text-[20px] font-semibold text-[#0F172A] mt-1">
                  {activeGoal.title}
                </h2>
              </div>

              <div className="space-y-2.5">
                {activeGoal.steps.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => onToggleGoalStep(activeGoal.id, st.id)}
                    style={{ boxShadow: SHADOW_TOKENS.xs }}
                    className={`p-3.5 rounded-[12px] flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      st.kind === 'session'
                        ? 'bg-[#EEF4FF]/55 hover:bg-[#EEF4FF]'
                        : 'bg-[#F7F8FA] hover:bg-[#EEF0F4]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ProdCheckbox
                        checked={st.completed}
                        onChange={() => onToggleGoalStep(activeGoal.id, st.id)}
                        reducedMotion={reducedMotion}
                      />
                      <div>
                        <p
                          className={`text-[14px] font-medium ${
                            st.completed
                              ? 'line-through text-[#94A3B8]'
                              : 'text-[#0F172A]'
                          }`}
                        >
                          {st.title}
                        </p>
                        <p className="text-[12px] text-[#475569]">
                          {st.dueLabel}
                        </p>
                      </div>
                    </div>

                    {/* Distinct visuals for Session completion vs Task completion */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] ${
                        st.kind === 'session'
                          ? 'bg-[#185CFF]/15 text-[#185CFF]'
                          : 'bg-[#10B981]/15 text-[#059669]'
                      }`}
                    >
                      {st.kind === 'session' ? 'Timed Session' : 'Task Deliverable'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Add a step (reuses task creation pattern) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newStepTitle.trim()) return;
                  onAddGoalStep(activeGoal.id, newStepTitle.trim(), newStepKind);
                  setNewStepTitle('');
                }}
                className="pt-4 border-t border-[#E5E7EB]/60 flex flex-wrap items-center gap-2.5"
              >
                <input
                  type="text"
                  value={newStepTitle}
                  onChange={(e) => setNewStepTitle(e.target.value)}
                  placeholder="Add a step to this goal..."
                  className="flex-1 min-w-[200px] px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[13px] text-[#0F172A] focus:outline-none"
                />
                <SegmentedControl
                  id="goal-step-kind"
                  size="sm"
                  value={newStepKind}
                  onChange={setNewStepKind}
                  options={[
                    { value: 'task', label: 'Task' },
                    { value: 'session', label: 'Session' },
                  ]}
                />
                <ProdButton type="submit" size="sm" variant="primary">
                  Add a step
                </ProdButton>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * 4.12 ACCOUNTABILITY (DISCOVERY, REQUEST FORM, "VIEW AS PARTNER" PREVIEW) + 4.13 PARTNERSHIP DETAIL
 * ============================================================================
 */
export function AccountabilityScreen({
  requests,
  onExpressInterest,
  onAcceptPartner,
  dataState,
  onChangeDataState,
  showAnnotations,
}: {
  requests: AccountabilityRequest[];
  onExpressInterest: (id: string) => void;
  onAcceptPartner: (id: string) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
}) {
  const [subTab, setSubTab] = useState<
    'discover' | 'owner-interests' | 'partnership' | 'create'
  >('discover');
  const [lifecycleState, setLifecycleState] = useState<
    | 'draft request'
    | 'published'
    | 'interest submitted'
    | 'awaiting owner response'
    | 'accepted'
    | 'declined'
    | 'withdrawn'
    | 'ended'
  >('published');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState('All');
  const [previewPartnerOverlay, setPreviewPartnerOverlay] = useState(false);
  const [flashedCardId, setFlashedCardId] = useState<string | null>(null);
  const [sharedItems, setSharedItems] = useState<string[]>([
    'Habit: Morning 5km Jog (Mon, Wed, Fri)',
    'Task: Solve Thevenin & Norton Problem Set 4',
  ]);
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInLogs, setCheckInLogs] = useState<string[]>([
    'Tue 28 Oct: Both completed EEE 311 Nodal Analysis set on time.',
  ]);

  const allTags = ['All', 'EEE 311', 'Morning Routine', 'Deep Work', 'GET 307 AI'];

  const visibleRequests = requests.filter((r) =>
    selectedTag === 'All' ? true : r.tags.includes(selectedTag)
  );

  return (
    <div>
      <FrameStateBanner
        frameName={
          subTab === 'discover'
            ? 'Accountability/Discover/Default'
            : subTab === 'partnership'
            ? 'Accountability/Partnership/Active'
            : 'Accountability/RequestForm/Default'
        }
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            Selective Peer Accountability
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            Share only specific habits, tasks, or goals. Preview exactly what a partner sees before submitting.
          </p>
        </div>

        <SegmentedControl
          id="acc-subtab"
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'discover', label: 'Discover Requests' },
            { value: 'owner-interests', label: 'Owner Interests (2)' },
            { value: 'partnership', label: 'Active Partnership' },
            { value: 'create', label: 'Create Request' },
          ]}
        />
      </div>

      {/* Interactive Contact & Partnership Lifecycle State Bar */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.xs }}
        className="bg-white rounded-[14px] p-3 mb-4 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Lifecycle State:
          </span>
          {(
            [
              'draft request',
              'published',
              'interest submitted',
              'awaiting owner response',
              'accepted',
              'declined',
              'withdrawn',
              'ended',
            ] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setLifecycleState(st)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                lifecycleState === st
                  ? 'bg-[#185CFF] text-white'
                  : 'bg-[#EEF0F4] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] font-medium text-slate-500">
          Contact:{' '}
          <strong className="font-mono text-slate-700">
            {lifecycleState === 'accepted'
              ? 'chidinma.o@student.akadverse.edu'
              : '••••••@student.akadverse.edu (Placeholder until accepted)'}
          </strong>
        </span>
      </div>

      <OpenDecisionChip decisionId="OD-04" showAnnotations={showAnnotations} />

      {subTab === 'discover' && (
        <div className="space-y-4">
          {/* Topic tag chips */}
          <div className="flex flex-wrap items-center gap-2">
            {allTags.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => setSelectedTag(tg)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
                  selectedTag === tg
                    ? 'bg-[#185CFF] text-white'
                    : 'bg-white text-[#475569] hover:bg-[#EEF0F4]'
                }`}
              >
                {tg}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleRequests.map((req) => (
              <motion.div
                key={req.id}
                animate={{
                  boxShadow:
                    flashedCardId === req.id
                      ? '0 0 0 2px #185CFF, 0 8px 24px rgba(24,92,255,0.20)'
                      : SHADOW_TOKENS.sm,
                }}
                transition={{ duration: 0.3, ease: EASE_CURVE }}
                className="bg-white rounded-[16px] p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#0F172A]">
                        {req.author}
                      </h3>
                      <p className="text-[12px] text-[#94A3B8]">
                        {req.roleLabel}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#185CFF] bg-[#EEF4FF] px-2.5 py-1 rounded-full">
                      {req.checkInFrequency}
                    </span>
                  </div>

                  <p className="text-[14px] text-[#475569] leading-relaxed">
                    {req.excerpt}
                  </p>

                  {/* Visible Per-Item Sharing Summary (Never Blanket Access) */}
                  <div className="p-3 rounded-[12px] bg-[#F7F8FA] space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#185CFF]">
                      Scoped Sharing Summary ({req.sharedCommitments.length} items only · No blanket history)
                    </p>
                    <ul className="text-[12px] text-[#0F172A] space-y-0.5 list-disc pl-4">
                      {req.sharedCommitments.map((sc) => (
                        <li key={sc}>{sc}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {req.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-0.5 rounded-full bg-[#EEF0F4] text-[11px] font-medium text-[#475569]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E7EB]/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAcceptPartner(req.id);
                      setSubTab('partnership');
                    }}
                    className="text-[12px] font-medium text-[#475569] hover:text-[#185CFF] cursor-pointer"
                  >
                    Owner view: Accept →
                  </button>

                  {/* Express interest -> button collapses to check + "Interest sent" (300ms) */}
                  <motion.button
                    layout
                    type="button"
                    onClick={() => {
                      if (!req.interestSent) {
                        onExpressInterest(req.id);
                        setFlashedCardId(req.id);
                        setTimeout(() => setFlashedCardId(null), 600);
                      }
                    }}
                    transition={{ duration: 0.3, ease: EASE_CURVE }}
                    className={`px-4 py-2 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                      req.interestSent
                        ? 'bg-[#D1FAE5] text-[#047857]'
                        : 'bg-[#185CFF] text-white hover:shadow-[0_8px_24px_rgba(24,92,255,0.20)]'
                    }`}
                  >
                    {req.interestSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Interest sent</span>
                      </>
                    ) : (
                      <span>Express interest</span>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* OWNER'S INTERESTS VIEW: Expressing interest does NOT create a partnership until Owner clicks Accept */}
      {subTab === 'owner-interests' && (
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                FRAME: ACCOUNTABILITY/INTERESTS/OWNER
              </span>
              <h3 className="text-[18px] font-semibold text-[#0F172A] mt-0.5">
                Incoming Interest Requests for Your Commitment
              </h3>
              <p className="text-[13px] text-[#475569]">
                Expressing interest does <strong>not</strong> create a partnership or reveal private records. A partnership becomes active only after you click <strong>Accept</strong>.
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#E5E7EB]/60">
            {[
              {
                id: 'int-1',
                name: 'Chidinma Okafor',
                dept: '300L Electrical Engineering',
                note: 'I also run at 6 AM Mon/Wed/Fri and am taking EEE 311!',
                contactPlaceholder: '••••••@student.akadverse.edu (Placeholder)',
              },
              {
                id: 'int-2',
                name: 'Kelechi Nwosu',
                dept: '300L Mechanical Engineering',
                note: 'Looking for a Friday evening check-in partner for Engineering Math III.',
                contactPlaceholder: '••••••@student.akadverse.edu (Placeholder)',
              },
            ].map((candidate) => (
              <div
                key={candidate.id}
                className="py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[15px] font-semibold text-[#0F172A]">
                      {candidate.name}
                    </h4>
                    <span className="text-[12px] text-[#94A3B8]">
                      {candidate.dept}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#475569]">{candidate.note}</p>
                  <p className="text-[11.5px] font-mono text-[#94A3B8]">
                    Contact: {candidate.contactPlaceholder}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <ProdButton
                    size="sm"
                    variant="danger"
                    onClick={() => setLifecycleState('declined')}
                  >
                    Reject
                  </ProdButton>
                  <ProdButton
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setLifecycleState('accepted');
                      setSubTab('partnership');
                    }}
                  >
                    Accept &amp; Activate Partnership
                  </ProdButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'create' && (
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4 max-w-2xl"
        >
          <h3 className="text-[18px] font-semibold text-[#0F172A]">
            Create Accountability Request &amp; Selective Sharing Scope
          </h3>
          <OpenDecisionChip
            decisionId="OD-05"
            showAnnotations={showAnnotations}
          />
          <p className="text-[13px] text-[#475569]">
            Select the exact commitments your partner is permitted to see. Everything else in your portal remains private.
          </p>

          <div className="space-y-2">
            {[
              'Habit: Morning 5km Jog (Mon, Wed, Fri)',
              'Task: Solve Thevenin & Norton Problem Set 4',
              'Goal: GET 307 Term Paper (4 milestones)',
              'Schedule: Personal Deep Work Blocks Only',
            ].map((item) => {
              const checked = sharedItems.includes(item);
              return (
                <div
                  key={item}
                  onClick={() =>
                    setSharedItems((prev) =>
                      checked ? prev.filter((x) => x !== item) : [...prev, item]
                    )
                  }
                  className="p-3 rounded-[12px] bg-[#F7F8FA] flex items-center gap-3 cursor-pointer"
                >
                  <ProdCheckbox checked={checked} />
                  <span className="text-[13px] font-medium text-[#0F172A]">
                    {item}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-[12px] bg-[#EEF4FF] text-[13px] text-[#185CFF]">
            <strong>Plain-language sharing summary:</strong> Your partner will only see outcomes for the{' '}
            <strong>{sharedItems.length}</strong> selected commitments above. Private history, unshared tasks, and grades are never exposed.
            {sharedItems.some((s) => s.startsWith('Schedule:')) && (
              <span className="block mt-1.5 text-[12px] text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-[8px]">
                ⚠️ <strong>Scope Note (Open Decision OD-05):</strong> Sharing a schedule currently snapshots existing blocks; whether future schedule entries are automatically included is flagged for product owner sign-off.
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <ProdButton
              variant="secondary"
              onClick={() => setPreviewPartnerOverlay(true)}
            >
              <Eye className="w-4 h-4" />
              <span>View as partner</span>
            </ProdButton>

            <ProdButton
              variant="primary"
              onClick={() => setSubTab('partnership')}
            >
              Publish Request
            </ProdButton>
          </div>
        </div>
      )}

      {subTab === 'partnership' && (
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#10B981]">
                ACTIVE PARTNERSHIP · ONLY AGREED COMMITMENTS VISIBLE
              </span>
              <h3 className="text-[20px] font-semibold text-[#0F172A] mt-0.5">
                Awesome &amp; Chidinma Okafor
              </h3>
              <p className="text-[13px] text-[#475569]">
                Check-in frequency: Twice weekly · Next check-in: Fri, 31 Oct at 8:00 PM
              </p>
            </div>
            <ProdButton
              variant="danger"
              size="sm"
              onClick={() => setLeaveConfirmOpen(true)}
            >
              Leave partnership (Revokes future access)
            </ProdButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-[12px] bg-[#F7F8FA] space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#475569]">
                Shared Commitments ({sharedItems.length})
              </p>
              {sharedItems.map((it) => (
                <div
                  key={it}
                  className="p-2.5 rounded-[10px] bg-white text-[13px] font-medium text-[#0F172A] flex items-center justify-between"
                >
                  <span>{it}</span>
                  <StatusPill variant="completed" />
                </div>
              ))}
            </div>

            <div className="p-4 rounded-[12px] bg-[#F7F8FA] space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#475569]">
                Short Check-In Record
              </p>
              <div className="space-y-2">
                {checkInLogs.map((log, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-[10px] bg-white text-[13px] text-[#0F172A]"
                  >
                    {log}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!checkInNote.trim()) return;
                  setCheckInLogs((prev) => [
                    `Fri 31 Oct: ${checkInNote.trim()}`,
                    ...prev,
                  ]);
                  setCheckInNote('');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="Add short check-in note..."
                  className="flex-1 px-3 py-1.5 rounded-[10px] bg-white text-[13px]"
                />
                <ProdButton type="submit" size="sm">
                  Log
                </ProdButton>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Leave Partnership Confirmation Modal explaining loss of future access */}
      <ProdModal
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        title="Leave Accountability Partnership?"
        subtitle="Frame: Accountability/Partnership/Leave"
      >
        <div className="space-y-4">
          <p className="text-[13.5px] text-[#475569] leading-relaxed">
            Leaving this partnership immediately revokes mutual access to all{' '}
            <strong>{sharedItems.length} agreed commitments</strong>. Neither partner will see future habit outcomes, task completions, or upcoming check-ins.
          </p>
          <div className="flex justify-end gap-2">
            <ProdButton
              variant="ghost"
              onClick={() => setLeaveConfirmOpen(false)}
            >
              Stay in Partnership
            </ProdButton>
            <ProdButton
              variant="danger"
              onClick={() => {
                setLeaveConfirmOpen(false);
                setLifecycleState('ended');
                setSubTab('discover');
              }}
            >
              Confirm &amp; Revoke Future Access
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* "View as partner" bottom-up slide overlay (300ms, blurred backdrop) */}
      <AnimatePresence>
        {previewPartnerOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_CURVE }}
            onClick={() => setPreviewPartnerOverlay(false)}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[4px] flex items-end justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: EASE_CURVE }}
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: SHADOW_TOKENS.lg }}
              className="w-full max-w-2xl bg-white rounded-t-[20px] rounded-b-[16px] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    FRAME: ACCOUNTABILITY/REQUESTFORM/PREVIEW
                  </span>
                  <h3 className="text-[18px] font-semibold text-[#0F172A]">
                    Partner View Preview (Sanitized Scope)
                  </h3>
                </div>
                <ProdButton
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviewPartnerOverlay(false)}
                >
                  Exit Preview
                </ProdButton>
              </div>
              <p className="text-[13px] text-[#475569]">
                Only these {sharedItems.length} permitted commitments are visible to your partner. All other tasks, grades, and official lectures are hidden:
              </p>
              <div className="space-y-2">
                {sharedItems.map((it) => (
                  <div
                    key={it}
                    className="p-3 rounded-[12px] bg-[#F7F8FA] flex items-center justify-between text-[13px] font-medium text-[#0F172A]"
                  >
                    <span>{it}</span>
                    <StatusPill variant="completed" />
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * ============================================================================
 * 4.14 GROUPS & 4.15 ADMIN — GROUP PROPOSAL QUEUE
 * ============================================================================
 */
export function GroupsAndAdminScreen({
  groups,
  isAdminView,
  onApproveGroup,
  onRejectGroup,
  onProposeGroup,
  dataState,
  onChangeDataState,
  showAnnotations,
}: {
  groups: StudyGroupItem[];
  isAdminView: boolean;
  onApproveGroup: (id: string) => void;
  onRejectGroup: (id: string, reason: string) => void;
  onProposeGroup: (title: string, topic: string, desc: string) => void;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
}) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [propTopic, setPropTopic] = useState('EEE 324');
  const [propDesc, setPropDesc] = useState('');
  const [rejectingGroup, setRejectingGroup] = useState<StudyGroupItem | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState(
    'Overlaps with existing Departmental Tutorial Pod — please specify unique focus.'
  );
  const [membershipStateDemo, setMembershipStateDemo] = useState<
    | 'not joined'
    | 'request pending'
    | 'accepted'
    | 'declined'
    | 'full'
    | 'left'
    | 'permission-denied'
    | 'revoked-access'
  >('not joined');
  const [managingGroup, setManagingGroup] = useState<StudyGroupItem | null>(
    null
  );

  return (
    <div>
      <FrameStateBanner
        frameName={
          isAdminView
            ? 'Admin/Proposals/Queue'
            : 'Groups/Discover/Default'
        }
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <OpenDecisionChip decisionId="OD-06" showAnnotations={showAnnotations} />

      {/* Explicit Scoped Privacy Banner & Membership State Bar */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.xs }}
        className="bg-white rounded-[14px] p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#0F172A]">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>
            <strong>Scoped Privacy Rule:</strong> Joining a group never automatically shares a student’s productivity records.
          </span>
        </div>

        {!isAdminView && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">
              Membership State:
            </span>
            {(
              [
                'not joined',
                'request pending',
                'accepted',
                'declined',
                'full',
                'left',
                'permission-denied',
                'revoked-access',
              ] as const
            ).map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setMembershipStateDemo(ms)}
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold capitalize cursor-pointer ${
                  membershipStateDemo === ms
                    ? 'bg-[#185CFF] text-white'
                    : 'bg-[#EEF0F4] text-[#475569]'
                }`}
              >
                {ms}
              </button>
            ))}
          </div>
        )}
      </div>

      {(membershipStateDemo === 'permission-denied' ||
        membershipStateDemo === 'revoked-access') && (
        <div className="mb-5 p-4 rounded-[14px] bg-[#FEE2E2] text-[#B91C1C] text-[13px] flex items-center justify-between">
          <span>
            <strong>
              {membershipStateDemo === 'permission-denied'
                ? 'Permission Denied:'
                : 'Revoked Access:'}
            </strong>{' '}
            {membershipStateDemo === 'permission-denied'
              ? 'Ordinary members cannot access Group Owner member-management controls.'
              : 'Your membership in this study pod was ended; shared group resources are no longer accessible.'}
          </span>
          <button
            type="button"
            onClick={() => setMembershipStateDemo('not joined')}
            className="underline font-semibold cursor-pointer ml-3"
          >
            Reset
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            {isAdminView
              ? 'Platform Admin · Group Proposal Queue'
              : 'Peer Study Groups & Recruiting Pods'}
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            {isAdminView
              ? 'Distinct Platform-Admin role (separate from group owners). Review pending proposals and record decision reasons.'
              : 'Discover approved study circles, view member capacity, or propose a new academic group.'}
          </p>
        </div>

        {!isAdminView && (
          <ProdButton variant="primary" onClick={() => setProposalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Propose Study Group</span>
          </ProdButton>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {groups.map((grp) => (
          <div
            key={grp.id}
            style={{ boxShadow: SHADOW_TOKENS.sm }}
            className="bg-white rounded-[16px] p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#EEF0F4] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569]">
                  {grp.topic}
                </span>
                <StatusPill
                  variant={
                    grp.approvalState === 'Approved'
                      ? 'completed'
                      : grp.approvalState === 'Pending'
                      ? 'pending-sync'
                      : 'missed'
                  }
                  label={grp.approvalState}
                />
              </div>

              <h3 className="text-[16px] font-semibold text-[#0F172A]">
                {grp.title}
              </h3>
              <p className="text-[13px] text-[#475569] leading-relaxed">
                {grp.description}
              </p>

              {grp.rejectionReason && (
                <div className="p-2.5 rounded-[10px] bg-[#FEE2E2] text-[#B91C1C] text-[12px]">
                  <strong>Rejection reason:</strong> {grp.rejectionReason}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E7EB]/60 space-y-3">
              <div className="flex items-center justify-between text-[12px] text-[#475569]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-[#185CFF]" />
                  {grp.id === 'grp-3'
                    ? `${grp.memberCount} members · No maximum (no owner cap)`
                    : `${grp.memberCount} / ${grp.capacity} members`}
                </span>
                <span className="font-semibold text-[#0F172A]">
                  {grp.recruitmentState}
                </span>
              </div>

              {isAdminView ? (
                <div className="flex items-center gap-2">
                  <ProdButton
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={() => onApproveGroup(grp.id)}
                  >
                    Approve
                  </ProdButton>
                  <ProdButton
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => setRejectingGroup(grp)}
                  >
                    Reject
                  </ProdButton>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-[#94A3B8]">
                    {grp.isOwner ? 'Role: Group Owner' : 'Role: Student'}
                  </span>
                  <ProdButton
                    size="sm"
                    variant={grp.isOwner ? 'secondary' : 'primary'}
                    disabled={grp.memberCount >= grp.capacity && !grp.isOwner}
                    onClick={() => {
                      if (grp.isOwner) {
                        setManagingGroup(grp);
                      } else {
                        setMembershipStateDemo('request pending');
                      }
                    }}
                  >
                    {grp.isOwner
                      ? 'Manage Members'
                      : grp.memberCount >= grp.capacity
                      ? 'Group Full'
                      : membershipStateDemo === 'request pending'
                      ? 'Request Pending'
                      : membershipStateDemo === 'accepted'
                      ? 'Joined (Member)'
                      : 'Request to Join'}
                  </ProdButton>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Group Owner Member Management Modal */}
      <ProdModal
        open={!!managingGroup}
        onClose={() => setManagingGroup(null)}
        title={`Member Management · ${managingGroup?.title ?? ''}`}
        subtitle="Frame: Groups/MemberManagement/Owner (Visible only to Group Owners/Admins)"
      >
        {managingGroup && (
          <div className="space-y-4">
            <p className="text-[13px] text-[#475569]">
              Review incoming join requests. Note: If membership drops below 3, see annotation <strong>OD-06</strong> regarding Recruiting vs. Active status.
            </p>
            <div className="space-y-2">
              {[
                { name: 'Sadiq Bello', level: '300L EEE', status: 'Pending Join Request' },
                { name: 'Adaeze Obi', level: '300L EEE', status: 'Active Member' },
              ].map((m) => (
                <div
                  key={m.name}
                  className="p-3 rounded-[12px] bg-[#F7F8FA] flex items-center justify-between text-[13px]"
                >
                  <div>
                    <p className="font-semibold text-[#0F172A]">{m.name}</p>
                    <p className="text-[11.5px] text-[#475569]">
                      {m.level} · {m.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProdButton
                      size="sm"
                      variant="primary"
                      onClick={() => setManagingGroup(null)}
                    >
                      Accept
                    </ProdButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ProdModal>

      {/* Propose Group Modal */}
      <ProdModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        title="Propose New Study Group"
        subtitle="Frame: Groups/ProposalForm/Default"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Group Title
            </label>
            <input
              type="text"
              value={propTitle}
              onChange={(e) => setPropTitle(e.target.value)}
              placeholder="e.g., Electromagnetic Waves Problem Lab"
              className="w-full px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Course / Topic Tag
            </label>
            <input
              type="text"
              value={propTopic}
              onChange={(e) => setPropTopic(e.target.value)}
              className="w-full px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#0F172A] mb-1">
              Description &amp; Weekly Cadence
            </label>
            <textarea
              rows={3}
              value={propDesc}
              onChange={(e) => setPropDesc(e.target.value)}
              placeholder="Describe the study goals and meeting schedule..."
              className="w-full px-3.5 py-2 rounded-[12px] bg-[#F7F8FA] text-[14px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <ProdButton variant="ghost" onClick={() => setProposalOpen(false)}>
              Cancel
            </ProdButton>
            <ProdButton
              variant="primary"
              onClick={() => {
                if (!propTitle.trim()) return;
                onProposeGroup(
                  propTitle.trim(),
                  propTopic.trim(),
                  propDesc.trim() || 'Weekly peer problem-solving session.'
                );
                setPropTitle('');
                setPropDesc('');
                setProposalOpen(false);
              }}
            >
              Submit Proposal for Admin Review
            </ProdButton>
          </div>
        </div>
      </ProdModal>

      {/* Admin Rejection Reason Modal */}
      <ProdModal
        open={!!rejectingGroup}
        onClose={() => setRejectingGroup(null)}
        title="Reject Group Proposal"
        subtitle="Frame: Admin/Proposals/Rejected"
      >
        {rejectingGroup && (
          <div className="space-y-4">
            <p className="text-[13px] text-[#475569]">
              Provide a clear rejection reason for the student proposer of{' '}
              <strong>{rejectingGroup.title}</strong>:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 rounded-[12px] bg-[#F7F8FA] text-[13px]"
            />
            <div className="flex justify-end gap-2">
              <ProdButton
                variant="ghost"
                onClick={() => setRejectingGroup(null)}
              >
                Cancel
              </ProdButton>
              <ProdButton
                variant="danger"
                onClick={() => {
                  onRejectGroup(rejectingGroup.id, rejectReason);
                  setRejectingGroup(null);
                }}
              >
                Confirm Rejection
              </ProdButton>
            </div>
          </div>
        )}
      </ProdModal>
    </div>
  );
}

/**
 * ============================================================================
 * 4.16 HISTORY PAGE
 * Chronological list + indented group for original missed attempt + later replanned attempt
 * ============================================================================
 */
export function HistoryScreen({
  history,
  dataState,
  onChangeDataState,
  showAnnotations,
}: {
  history: HistoryRecord[];
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('All');

  const filtered = history
    .filter((h) => (typeFilter === 'All' ? true : h.activityType === typeFilter))
    .filter((h) =>
      outcomeFilter === 'All' ? true : h.outcome === outcomeFilter
    );

  return (
    <div>
      <FrameStateBanner
        frameName={
          typeFilter !== 'All' || outcomeFilter !== 'All'
            ? 'History/Filtered'
            : 'History/Default'
        }
        dataState={dataState}
        onChangeDataState={onChangeDataState}
        showAnnotations={showAnnotations}
      />

      <OpenDecisionChip decisionId="OD-02" showAnnotations={showAnnotations} />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A]">
            Outcome &amp; Completion History
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            Chronological audit log. Original missed attempts are retained and indented beneath their replanned completion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Task', 'Habit', 'Schedule', 'Goal'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer ${
                typeFilter === t
                  ? 'bg-[#185CFF] text-white'
                  : 'bg-white text-[#475569]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((rec) => (
          <div
            key={rec.id}
            style={{ boxShadow: SHADOW_TOKENS.xs }}
            className="bg-white rounded-[14px] p-4 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#EEF0F4] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569]">
                    {rec.activityType}
                  </span>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    {rec.title}
                  </h3>
                </div>
                <p className="text-[12px] text-[#475569] mt-0.5">
                  {rec.action} · {rec.dateLabel} at {rec.completionTime}
                </p>
              </div>
              <StatusPill
                variant={
                  rec.outcome === 'completed'
                    ? 'completed'
                    : rec.outcome === 'missed'
                    ? 'missed'
                    : 'focus'
                }
                label={rec.outcome}
              />
            </div>

            {/* Indented related history for original missed attempt + later attempt */}
            {rec.relatedAttempt && (
              <div className="ml-6 pl-3.5 py-2 border-l-2 border-[#CBD5E1] bg-[#F7F8FA] rounded-r-[10px] text-[12px] text-[#475569]">
                <p className="font-semibold text-[#0F172A]">
                  ↳ Original Attempt Retained: {rec.relatedAttempt.originalTime}
                </p>
                <p className="text-[#94A3B8]">
                  Context: {rec.relatedAttempt.reason}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

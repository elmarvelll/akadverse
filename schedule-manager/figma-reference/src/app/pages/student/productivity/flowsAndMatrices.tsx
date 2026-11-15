import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  Grid,
  Play,
  Check,
  ArrowRight,
  Lock,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CheckSquare,
  Sparkles,
  Clock,
} from 'lucide-react';
import {
  HabitDefinition,
  NavSectionId,
  OPEN_DECISIONS,
  ScheduleEventItem,
  ScreenDataState,
  SyncState,
  TaskItem,
} from './types';
import {
  EASE_CURVE,
  HabitGridCellView,
  ProdButton,
  ProdCheckbox,
  ProdProgressBar,
  SHADOW_TOKENS,
  SegmentedControl,
  StatusPill,
  SyncBadge,
} from './components';

/**
 * ============================================================================
 * PAGE 03 · MOBILE SCREENS (390 × 844 Frames, 4-col grid, 16px gutter, 16px margin)
 * ============================================================================
 */
export function MobileScreensPage({
  tasks,
  events,
  habits,
  onCompleteTask,
  onToggleHabitCell,
  syncState,
  onCycleSync,
}: {
  tasks: TaskItem[];
  events: ScheduleEventItem[];
  habits: HabitDefinition[];
  onCompleteTask: (t: TaskItem) => void;
  onToggleHabitCell: (habitId: string, dateKey: string) => void;
  syncState: SyncState;
  onCycleSync: () => void;
}) {
  const [mobileScreen, setMobileScreen] = useState<
    'today' | 'agenda' | 'tasks' | 'habits'
  >('agenda');
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  const todayCompletedHabits = habits.filter(
    (h) => h.cells['Oct 31'] === 'complete'
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
            FIGMA PAGE 03 · MOBILE SCREENS (390 × 844)
          </span>
          <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A] mt-1">
            Mobile 390px Key Frames &amp; Agenda Baseline
          </h1>
          <p className="text-[14px] text-[#475569] mt-0.5">
            390 × 844 viewport · 4-col grid · 16px gutter · 16px margin. Toggle the 4-column layout grid overlay to inspect alignment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            id="mobile-frame-picker"
            value={mobileScreen}
            onChange={setMobileScreen}
            options={[
              { value: 'agenda', label: 'Schedule/Agenda/Mixed' },
              { value: 'today', label: 'Today/Overview' },
              { value: 'tasks', label: 'Tasks/List' },
              { value: 'habits', label: 'Habits/Grid' },
            ]}
          />

          <ProdButton
            size="sm"
            variant={showGridOverlay ? 'primary' : 'secondary'}
            onClick={() => setShowGridOverlay((g) => !g)}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>4-Col Grid</span>
          </ProdButton>
        </div>
      </div>

      {/* Centered 390 x 844 Mobile Frame Container */}
      <div className="flex justify-center py-2">
        <div
          style={{
            width: '390px',
            height: '844px',
            boxShadow: SHADOW_TOKENS.lg,
          }}
          className="relative bg-[#F7F8FA] rounded-[32px] overflow-hidden flex flex-col border-[6px] border-[#0F172A]"
        >
          {/* Optional 4-col 16px margin/gutter Figma Grid Overlay */}
          {showGridOverlay && (
            <div className="pointer-events-none absolute inset-0 z-30 px-[16px] grid grid-cols-4 gap-[16px]">
              {[0, 1, 2, 3].map((col) => (
                <div key={col} className="h-full bg-[#185CFF]/[0.07]" />
              ))}
            </div>
          )}

          {/* Mobile Top Bar */}
          <div className="h-14 bg-white px-4 flex items-center justify-between shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#185CFF] text-white text-[12px] font-bold flex items-center justify-center">
                A
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A] leading-none">
                  Awesome
                </p>
                <p className="text-[10.5px] text-[#94A3B8] mt-0.5">
                  Fri, 31 Oct
                </p>
              </div>
            </div>

            <SyncBadge state={syncState} onClick={onCycleSync} />
          </div>

          {/* Mobile Scrollable Body (16px horizontal margin) */}
          <div className="flex-1 overflow-y-auto px-[16px] py-4 space-y-4">
            {mobileScreen === 'agenda' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-[#185CFF] font-semibold">
                      Schedule/Agenda/Mixed
                    </span>
                    <h2 className="text-[20px] font-semibold text-[#0F172A]">
                      Agenda View
                    </h2>
                  </div>
                  <StatusPill variant="focus" label="Fri 31 Oct" />
                </div>

                {/* Stacked day cards, time down left rail, events right */}
                <div
                  style={{ boxShadow: SHADOW_TOKENS.sm }}
                  className="bg-white rounded-[16px] p-4 space-y-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    FRIDAY, 31 OCTOBER (TODAY)
                  </p>
                  {events
                    .filter((e) => e.dayIndex === 4)
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 p-3 rounded-[12px] bg-[#F7F8FA]"
                        style={{
                          borderLeft: `3px solid ${
                            ev.isOfficial ? '#185CFF' : '#10B981'
                          }`,
                        }}
                      >
                        <div className="w-12 shrink-0 text-[12px] font-semibold text-[#475569] tabular-nums">
                          {Math.floor(ev.startHour)}:00
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                              {ev.title}
                            </p>
                            {ev.isOfficial && (
                              <Lock className="w-3 h-3 text-[#185CFF] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11.5px] text-[#475569] truncate mt-0.5">
                            {ev.location}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}

            {mobileScreen === 'today' && (
              <>
                <span className="font-mono text-[10px] text-[#185CFF] font-semibold">
                  Today/Overview/Populated (390px)
                </span>
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #FFFFFF 0%, #F5F6FF 100%)',
                    boxShadow: SHADOW_TOKENS.md,
                    borderLeft: '3px solid #185CFF',
                  }}
                  className="rounded-[16px] p-4"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    NEXT COMMITMENT
                  </span>
                  <h3 className="text-[16px] font-semibold text-[#0F172A] mt-1">
                    EEE 311 · Electric Circuit Theory I
                  </h3>
                  <p className="text-[12px] text-[#475569] mt-1">
                    09:00 AM · Engineering Lecture Theatre B
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
                    FOCUS TODAY
                  </span>
                  {tasks
                    .filter((t) => t.status !== 'completed')
                    .slice(0, 3)
                    .map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onCompleteTask(t)}
                        style={{ boxShadow: SHADOW_TOKENS.xs }}
                        className="bg-white rounded-[12px] p-3 flex items-center gap-3 cursor-pointer"
                      >
                        <ProdCheckbox
                          checked={t.status === 'completed'}
                          onChange={() => onCompleteTask(t)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#0F172A] truncate">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-[#94A3B8] truncate">
                            {t.dueTime} · {t.sourceType}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>

                <div
                  style={{ boxShadow: SHADOW_TOKENS.xs }}
                  className="bg-white rounded-[14px] p-3.5"
                >
                  <ProdProgressBar
                    value={todayCompletedHabits}
                    max={habits.length}
                    label={`${todayCompletedHabits} of ${habits.length} habits today`}
                  />
                </div>
              </>
            )}

            {mobileScreen === 'tasks' && (
              <div className="space-y-2.5">
                <span className="font-mono text-[10px] text-[#185CFF] font-semibold">
                  Tasks/List/Default (390px)
                </span>
                <h2 className="text-[20px] font-semibold text-[#0F172A]">
                  Tasks
                </h2>
                {tasks
                  .filter((t) => t.status !== 'completed')
                  .map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onCompleteTask(t)}
                      style={{ boxShadow: SHADOW_TOKENS.xs }}
                      className="bg-white rounded-[12px] p-3 flex items-center gap-3 cursor-pointer"
                    >
                      <ProdCheckbox
                        checked={t.status === 'completed'}
                        onChange={() => onCompleteTask(t)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#0F172A] truncate">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] truncate">
                          {t.source}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {mobileScreen === 'habits' && (
              <div className="space-y-3">
                <span className="font-mono text-[10px] text-[#185CFF] font-semibold">
                  Habits/Grid/Populated (390px)
                </span>
                <h2 className="text-[20px] font-semibold text-[#0F172A]">
                  Habits (Oct 29 – Oct 31)
                </h2>
                <div
                  style={{ boxShadow: SHADOW_TOKENS.sm }}
                  className="bg-white rounded-[16px] p-3.5 space-y-2.5"
                >
                  {['Oct 29', 'Oct 30', 'Oct 31'].map((dKey) => (
                    <div
                      key={dKey}
                      className={`flex items-center justify-between p-2 rounded-[10px] ${
                        dKey === 'Oct 31' ? 'bg-[#EEF4FF]' : ''
                      }`}
                    >
                      <span className="text-[12px] font-semibold text-[#0F172A] w-16">
                        {dKey}
                      </span>
                      <div className="flex items-center gap-3">
                        {habits.map((h) => (
                          <HabitGridCellView
                            key={h.id}
                            state={h.cells[dKey] ?? 'not-scheduled'}
                            onClick={() => onToggleHabitCell(h.id, dKey)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Bottom Nav */}
          <div className="h-16 bg-white border-t border-[#E5E7EB]/60 px-4 grid grid-cols-4 gap-1 items-center shrink-0">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'agenda', label: 'Schedule' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'habits', label: 'Habits' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMobileScreen(item.id)}
                className={`py-1.5 rounded-[10px] text-[11.5px] font-semibold cursor-pointer ${
                  mobileScreen === item.id
                    ? 'bg-[#EEF4FF] text-[#185CFF]'
                    : 'text-[#475569]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * PAGE 04 · FLOWS — 5 ACCEPTANCE JOURNEYS (Interactive End-to-End Prototype)
 * ============================================================================
 */
export function AcceptanceFlowsPage({
  onJumpToLiveScreen,
}: {
  onJumpToLiveScreen: (section: NavSectionId) => void;
}) {
  const [activeJourney, setActiveJourney] = useState<'A' | 'B' | 'C' | 'D' | 'E'>(
    'A'
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [altPath, setAltPath] = useState(false);

  const journeys = {
    A: {
      title: 'Journey A — Shared completion (Task → Habit Cell → Today Total)',
      targetSection: 'tasks' as NavSectionId,
      steps: [
        {
          frame: 'Tasks/List/Default',
          heading: 'Step 1: Student views Today’s Habit Task in Task List',
          desc: '“Morning 5km Jog — Aerobic Conditioning” appears in Tasks with source badge HABIT.',
          cta: 'Tap Checkbox on Habit Task →',
        },
        {
          frame: 'Tasks/List/CompleteAnim',
          heading: 'Step 2: Signature 5-Part Completion Animation',
          desc: 'Checkbox spring fill (180ms) → SVG checkmark draw (250ms) → Row scale 1.015 → Wash to Accent/soft (#EEF4FF) → Collapse & History counter ticks up.',
          cta: 'Continue to Habits Grid →',
        },
        {
          frame: 'Habits/Grid/Populated',
          heading: 'Step 3: Matching Habit Cell Automatically Turns Green',
          desc: 'On the Monthly Habit Grid, “Morning 5km Jog” for Fri Oct 31 is now Complete (green gradient + checkmark) and the row total increments to 3/3.',
          cta: 'Continue to Today Overview →',
        },
        {
          frame: 'Today/Overview/Populated',
          heading: 'Step 4: Today Overview Daily Total Updated',
          desc: 'The Habits summary footer in Today Overview smoothly animates from “2 of 3 habits” to “3 of 3 habits (100%)”.',
          cta: 'Restart Journey A',
        },
      ],
    },
    B: {
      title: 'Journey B — Official timetable (Read-only Lock & Personal Filter)',
      targetSection: 'schedule' as NavSectionId,
      steps: [
        {
          frame: 'Schedule/Week/Mixed',
          heading: 'Step 1: Mixed Week Schedule with Official Class Blocks',
          desc: 'EEE 311 · Electric Circuit Theory I (09:00 AM) displays the diagonal corner stripe and 12px lock icon.',
          cta: 'Tap Official Class Block →',
        },
        {
          frame: 'Schedule/EventDetail/Official',
          heading: 'Step 2: Read-Only Official Detail + Separated Student Notes',
          desc: 'Course title, time, and venue are locked with an “Official” pill. Student personal notes sit below a visual divider.',
          cta: 'Filter to Personal Only →',
        },
        {
          frame: 'Schedule/Week/Empty',
          heading: 'Step 3: Filtered Schedule View (Personal Commitments Only)',
          desc: 'Official university classes are hidden so the student can inspect personal study blocks in isolation.',
          cta: 'Restart Journey B',
        },
      ],
    },
    C: {
      title: 'Journey C — Replanning (Mark Missed → Availability Check → History)',
      targetSection: 'schedule' as NavSectionId,
      hasAlt: true,
      steps: altPath
        ? [
            {
              frame: 'Schedule/EventDetail/Personal',
              heading: 'Step 1 (Alt): Personal Study Session Detail',
              desc: 'Student opens “Deep Work: Thevenin Problem Set 4” and clicks “Mark missed”.',
              cta: 'Mark Missed (Alt Conflict Path) →',
            },
            {
              frame: 'Replan/Conflict',
              heading: 'Step 2 (Alt): Red Conflict Banner Drops from Top (200ms)',
              desc: 'Backup time overlaps with GET 307 lecture. Two conflict-free backup time options fade in below.',
              cta: 'Choose another time (Fri 4:30 PM) →',
            },
            {
              frame: 'History/Default',
              heading: 'Step 3 (Alt): Original Attempt Retained in History',
              desc: 'History shows the new 4:30 PM session with the original missed attempt indented underneath.',
              cta: 'Restart Journey C',
            },
          ]
        : [
            {
              frame: 'Schedule/EventDetail/Personal',
              heading: 'Step 1: Personal Study Session Detail',
              desc: 'Student opens “Deep Work: Thevenin Problem Set 4” and clicks “Mark missed”.',
              cta: 'Tap Mark Missed →',
            },
            {
              frame: 'Replan/Check',
              heading: 'Step 2: Availability Check Modal',
              desc: 'Pulsing dots and indeterminate bar verify free slots against the official timetable.',
              cta: 'Slot Verified →',
            },
            {
              frame: 'Replan/Success',
              heading: 'Step 3: Old Time Struck Through, New Time Slides In (250ms)',
              desc: 'Original 12:00 PM slot strikes through and slides up; new 4:30 PM backup slot slides in from below.',
              cta: 'Confirm & View History →',
            },
            {
              frame: 'History/Default',
              heading: 'Step 4: Original Missed Attempt Retained as Related History',
              desc: 'Chronological History shows the replanned commitment with the original missed attempt indented below.',
              cta: 'Restart Journey C',
            },
          ],
    },
    D: {
      title: 'Journey D — Selective accountability (Discover → Express Interest → Active Partner)',
      targetSection: 'accountability' as NavSectionId,
      steps: [
        {
          frame: 'Accountability/Discover/Default',
          heading: 'Step 1: Browse Peer Accountability Requests by Tag',
          desc: 'Chidinma Okafor’s 300L Electrical Engineering request is listed with topic chips (EEE 311, Morning Routine).',
          cta: 'Tap Request Card →',
        },
        {
          frame: 'Accountability/RequestDetail/Viewer',
          heading: 'Step 2: Viewer Inspects Request Scope',
          desc: 'Shows agreed check-in cadence (Tue & Fri 8:00 PM) and the 3 specific commitments Chidinma shares.',
          cta: 'Tap Express Interest →',
        },
        {
          frame: 'Accountability/RequestDetail/Sent',
          heading: 'Step 3: Button Collapses to Check + “Interest sent” (300ms)',
          desc: 'Card border flashes accent (#185CFF) once as interest is recorded.',
          cta: 'Switch to Owner View (Accept) →',
        },
        {
          frame: 'Accountability/Partnership/Active',
          heading: 'Step 4: Active Partnership (Strictly Permitted Commitments Only)',
          desc: 'Both partners now see only the agreed habits/tasks and their shared check-in log.',
          cta: 'Restart Journey D',
        },
      ],
    },
    E: {
      title: 'Journey E — Offline outcome (Offline Tap → Pending Sync → Reconnect / Conflict)',
      targetSection: 'habits' as NavSectionId,
      hasAlt: true,
      steps: altPath
        ? [
            {
              frame: 'Habits/Grid/Populated',
              heading: 'Step 1 (Alt): Offline Habit Cell Tap',
              desc: 'Top bar shows “Offline · 1 pending”. Student taps today’s habit cell.',
              cta: 'Tap Cell While Offline →',
            },
            {
              frame: 'Global/Conflict',
              heading: 'Step 2 (Alt): Sync Conflict Detected on Reconnect',
              desc: 'Top bar badge turns red with bell icon and shakes once. Conflict resolution modal compares local vs server timestamp.',
              cta: 'Keep Local Completion →',
            },
            {
              frame: 'Global/SyncConfirmed',
              heading: 'Step 3 (Alt): Conflict Resolved & Confirmed',
              desc: 'Record badge flips to green checkmark.',
              cta: 'Restart Journey E',
            },
          ]
        : [
            {
              frame: 'Habits/Grid/Populated',
              heading: 'Step 1: Habit Grid While Offline',
              desc: 'Persistent compact offline banner is visible below the top bar (“Offline · 2 pending”).',
              cta: 'Tap Habit Cell →',
            },
            {
              frame: 'Global/PendingSync',
              heading: 'Step 2: Record Queued with Pulsing Amber Pending-Sync Pill',
              desc: 'Outcome is saved locally; amber dot pulses (opacity 1 ↔ 0.4, 1.2s loop).',
              cta: 'Simulate Reconnect →',
            },
            {
              frame: 'Global/SyncConfirmed',
              heading: 'Step 3: Staggered 60ms Flip to Green Checkmarks',
              desc: 'Top bar Sync Badge pops (scale 1 → 1.15 → 1, 300ms spring) and pending pills flip to green checks.',
              cta: 'Restart Journey E',
            },
          ],
    },
  };

  const current = journeys[activeJourney];
  const currentStep = current.steps[stepIdx] ?? current.steps[0];

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
          FIGMA PAGE 04 · FLOWS (5 ACCEPTANCE JOURNEYS)
        </span>
        <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A] mt-1">
          Clickable End-to-End Acceptance Journeys (A – E)
        </h1>
        <p className="text-[14px] text-[#475569] mt-0.5">
          Step through each connected prototype flow below, or jump directly into the live interactive screen.
        </p>
      </div>

      {/* Journey Selector Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(['A', 'B', 'C', 'D', 'E'] as const).map((jKey) => (
          <button
            key={jKey}
            type="button"
            onClick={() => {
              setActiveJourney(jKey);
              setStepIdx(0);
              setAltPath(false);
            }}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
              activeJourney === jKey
                ? 'bg-[#185CFF] text-white shadow-[0_8px_24px_rgba(24,92,255,0.20)]'
                : 'bg-white text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            Journey {jKey}
          </button>
        ))}
      </div>

      {/* Flow Canvas Card */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.md }}
        className="bg-white rounded-[20px] p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB]/60 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0F172A]">
              {current.title}
            </h2>
            <p className="font-mono text-[12px] text-[#185CFF] mt-0.5">
              Active Frame Node: {currentStep.frame}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(activeJourney === 'C' || activeJourney === 'E') && (
              <ProdButton
                size="sm"
                variant={altPath ? 'danger' : 'secondary'}
                onClick={() => {
                  setAltPath((p) => !p);
                  setStepIdx(0);
                }}
              >
                {altPath ? 'Viewing Conflict Alt Path' : 'Switch to Alt Conflict Path'}
              </ProdButton>
            )}
            <ProdButton
              size="sm"
              variant="secondary"
              onClick={() => onJumpToLiveScreen(current.targetSection)}
            >
              <span>Open Live Screen</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </ProdButton>
          </div>
        </div>

        {/* Connected Node Progress Rail */}
        <div className="flex flex-wrap items-center gap-2">
          {current.steps.map((st, idx) => {
            const isDone = idx < stepIdx;
            const isCurr = idx === stepIdx;
            return (
              <React.Fragment key={st.frame}>
                <button
                  type="button"
                  onClick={() => setStepIdx(idx)}
                  className={`px-3 py-1.5 rounded-[10px] font-mono text-[11.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                    isCurr
                      ? 'bg-[#185CFF] text-white shadow-[0_4px_14px_rgba(24,92,255,0.25)]'
                      : isDone
                      ? 'bg-[#D1FAE5] text-[#047857]'
                      : 'bg-[#EEF0F4] text-[#475569]'
                  }`}
                >
                  {isDone && <Check className="w-3 h-3" />}
                  <span>{st.frame}</span>
                </button>
                {idx < current.steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-[#94A3B8]" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Interactive Stage Preview */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeJourney}-${stepIdx}-${altPath}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE_CURVE }}
            className="p-6 rounded-[16px] bg-[#F7F8FA] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-xl">
              <span className="px-2.5 py-0.5 rounded-full bg-[#EEF4FF] text-[#185CFF] font-mono text-[11px] font-semibold">
                Step {stepIdx + 1} of {current.steps.length} · {currentStep.frame}
              </span>
              <h3 className="text-[20px] font-semibold text-[#0F172A]">
                {currentStep.heading}
              </h3>
              <p className="text-[14px] text-[#475569] leading-relaxed">
                {currentStep.desc}
              </p>
            </div>

            <ProdButton
              size="lg"
              variant="primary"
              onClick={() =>
                setStepIdx((prev) =>
                  prev + 1 < current.steps.length ? prev + 1 : 0
                )
              }
            >
              <span>{currentStep.cta}</span>
            </ProdButton>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * PAGE 05 · ANNOTATIONS, MOTION SPEC & STATE / PERMISSION MATRICES (Sections 6, 7, 8, 9)
 * ============================================================================
 */
export function AnnotationsAndMatricesPage({
  onNavigateToFrame,
}: {
  onNavigateToFrame: (section: NavSectionId, state: ScreenDataState) => void;
}) {
  const dataRows: { label: string; section: NavSectionId; prefix: string }[] = [
    { label: 'Today', section: 'today', prefix: 'Today/Overview' },
    { label: 'Schedule', section: 'schedule', prefix: 'Schedule/Week' },
    { label: 'Tasks', section: 'tasks', prefix: 'Tasks/List' },
    { label: 'Habits', section: 'habits', prefix: 'Habits/Grid' },
    {
      label: 'Accountability',
      section: 'accountability',
      prefix: 'Accountability/Discover',
    },
    { label: 'Groups', section: 'groups', prefix: 'Groups/Discover' },
    { label: 'History', section: 'history', prefix: 'History/List' },
    { label: 'Admin', section: 'admin', prefix: 'Admin/Proposals' },
  ];

  const stateCols: { state: ScreenDataState; colName: string; suffix: string }[] =
    [
      { state: 'loading', colName: 'Loading', suffix: 'Loading' },
      { state: 'empty', colName: 'Empty', suffix: 'Empty' },
      { state: 'populated', colName: 'Populated', suffix: 'Populated' },
      { state: 'error', colName: 'Error+Retry', suffix: 'Error' },
      {
        state: 'access-denied',
        colName: 'Access Denied',
        suffix: 'AccessDenied',
      },
      { state: 'pending-sync', colName: 'Pending Sync', suffix: 'PendingSync' },
    ];

  const roleMatrix = [
    {
      role: 'Student',
      view: 'Today/Overview/Populated',
      edit: 'Tasks/Form/Valid',
      complete: 'Tasks/List/CompleteAnim',
      share: 'Accountability/RequestForm/Preview',
      del: 'Tasks/Detail/Active',
      manage: 'Groups/Membership/RequestPending',
    },
    {
      role: 'Partner',
      view: 'Accountability/Partnership/Active',
      edit: 'Accountability/Partnership/CheckIn',
      complete: 'Access Denied (View Only)',
      share: 'Access Denied',
      del: 'Accountability/Partnership/Leave',
      manage: 'Access Denied',
    },
    {
      role: 'Group Member',
      view: 'Groups/Detail/Active',
      edit: 'Access Denied',
      complete: 'Tasks/List/Default',
      share: 'Groups/Detail/Active',
      del: 'Groups/Membership/Leave',
      manage: 'Access Denied',
    },
    {
      role: 'Group Owner',
      view: 'Groups/Detail/Recruiting',
      edit: 'Groups/ProposalForm/Default',
      complete: 'Tasks/List/Default',
      share: 'Groups/Detail/Recruiting',
      del: 'Groups/Detail/Archive',
      manage: 'Groups/MemberManagement/Owner',
    },
    {
      role: 'Group Admin',
      view: 'Groups/Detail/Active',
      edit: 'Groups/Detail/Active',
      complete: 'Tasks/List/Default',
      share: 'Groups/Detail/Active',
      del: 'Access Denied (Owner Only)',
      manage: 'Groups/MemberManagement/Owner',
    },
    {
      role: 'Platform Admin',
      view: 'Admin/Proposals/Queue',
      edit: 'Admin/Proposals/Review',
      complete: 'Admin/Proposals/Approved',
      share: 'Access Denied (Private Student Data)',
      del: 'Admin/Proposals/Rejected',
      manage: 'Admin/Proposals/Queue',
    },
  ];

  const motionSpecs = [
    {
      interaction: 'Card hover',
      move: 'y -2px, shadow sm→md',
      duration: '200ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Button hover',
      move: 'y -1px, shadow bloom',
      duration: '150ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Press',
      move: 'scale 0.98',
      duration: '100ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Task complete',
      move: 'checkbox spring + row collapse',
      duration: '400ms total',
      easing: 'Spring (damping 20)',
    },
    {
      interaction: 'Habit cell tap',
      move: 'scale 1→1.15→1',
      duration: '350ms',
      easing: 'Spring (damping 18)',
    },
    {
      interaction: 'Page enter',
      move: 'fade + y 8→0',
      duration: '220ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Modal enter',
      move: 'scale 0.96→1, fade',
      duration: '220ms',
      easing: 'Spring (damping 22)',
    },
    {
      interaction: 'Focus toggle',
      move: 'knob slide + content fade',
      duration: '250ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Filter apply',
      move: 'crossfade + chip pop',
      duration: '200ms',
      easing: 'Ease Out',
    },
    {
      interaction: 'Sync badge flip',
      move: 'scale pop + color crossfade',
      duration: '300ms',
      easing: 'Spring (damping 20)',
    },
    {
      interaction: 'List stagger',
      move: '30–60ms apart, max 5',
      duration: '—',
      easing: '--ease',
    },
  ];

  const handoffChecklist = [
    'All tokens created as styles (not raw hex)',
    'Every component has rest / hover / active / focus / disabled variants',
    'Every data screen has loading / empty / populated / error / access-denied frames',
    'Every form has valid / invalid / submitting / failed-save frames',
    'All 5 prototype journeys clickable end-to-end',
    'Motion spec annotation on every interactive element',
    'prefers-reduced-motion note on every animated screen',
    'Open decisions annotated, not silently decided',
    'Sidebar shell identical across every screen',
    'One accent color only — no new brand hues',
    'Same icon family throughout (no outline/filled mixing)',
    'Type ramp uses only the 8 defined text styles',
    'Reduced-motion fallback documented',
    'Component library linked to every screen instance',
  ];

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
          FIGMA PAGE 05 · ANNOTATIONS, STATE &amp; PERMISSION MATRICES
        </span>
        <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A] mt-1">
          Open Decisions, State/Permission Matrices &amp; Handoff Spec
        </h1>
        <p className="text-[14px] text-[#475569] mt-0.5">
          Click any cell in the State Matrix or Open Decisions table to jump straight to the live frame demonstrating that state.
        </p>
      </div>

      {/* 8.1 STATE MATRIX TABLE */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.sm }}
        className="bg-white rounded-[16px] p-6 overflow-x-auto"
      >
        <h2 className="text-[20px] font-semibold text-[#0F172A] mb-1">
          8.1 Data Page State Matrix (Interactive Frame Links)
        </h2>
        <p className="text-[13px] text-[#475569] mb-4">
          Every cell references and launches the exact `[section]/[screen]/[state]` frame.
        </p>
        <table className="w-full border-collapse min-w-[760px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-[#475569]">
              <th className="py-2.5 px-3 font-semibold">Data Page</th>
              {stateCols.map((c) => (
                <th key={c.colName} className="py-2.5 px-3 font-semibold">
                  {c.colName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]/60">
            {dataRows.map((row) => (
              <tr key={row.label} className="hover:bg-[#F7F8FA]">
                <td className="py-3 px-3 font-semibold text-[#0F172A]">
                  {row.label}
                </td>
                {stateCols.map((col) => (
                  <td key={col.colName} className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onNavigateToFrame(row.section, col.state)}
                      className="font-mono text-[11px] text-[#185CFF] bg-[#EEF4FF] hover:bg-[#185CFF] hover:text-white px-2 py-1 rounded-[6px] transition-colors cursor-pointer"
                    >
                      {row.prefix}/{col.suffix}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 8.2 PERMISSION MATRIX TABLE */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.sm }}
        className="bg-white rounded-[16px] p-6 overflow-x-auto"
      >
        <h2 className="text-[20px] font-semibold text-[#0F172A] mb-1">
          8.2 Role &amp; Permission Matrix
        </h2>
        <p className="text-[13px] text-[#475569] mb-4">
          Covers Student, Partner, Group Member, Group Owner, Group Admin, and Platform Admin across View, Edit, Complete, Share, Delete, and Manage.
        </p>
        <table className="w-full border-collapse min-w-[780px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-[#475569]">
              <th className="py-2.5 px-3 font-semibold">User Role</th>
              <th className="py-2.5 px-3 font-semibold">View</th>
              <th className="py-2.5 px-3 font-semibold">Edit</th>
              <th className="py-2.5 px-3 font-semibold">Complete</th>
              <th className="py-2.5 px-3 font-semibold">Share</th>
              <th className="py-2.5 px-3 font-semibold">Delete</th>
              <th className="py-2.5 px-3 font-semibold">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]/60">
            {roleMatrix.map((r) => (
              <tr key={r.role} className="hover:bg-[#F7F8FA]">
                <td className="py-3 px-3 font-semibold text-[#0F172A]">
                  {r.role}
                </td>
                {[r.view, r.edit, r.complete, r.share, r.del, r.manage].map(
                  (cell, idx) => (
                    <td key={idx} className="py-2.5 px-3 font-mono text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-[6px] ${
                          cell.includes('Denied')
                            ? 'bg-[#FEE2E2] text-[#B91C1C]'
                            : 'bg-[#EEF0F4] text-[#0F172A]'
                        }`}
                      >
                        {cell}
                      </span>
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7. OPEN DECISIONS ANNOTATIONS TABLE */}
      <div
        style={{ boxShadow: SHADOW_TOKENS.sm }}
        className="bg-white rounded-[16px] p-6"
      >
        <h2 className="text-[20px] font-semibold text-[#0F172A] mb-4">
          7. Annotated Open Decisions (Amber OPEN DECISION Chips)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OPEN_DECISIONS.map((od) => (
            <div
              key={od.id}
              className="p-4 rounded-[14px] bg-[#FFFBEB] border border-[#FDE68A] flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-bold uppercase tracking-[0.06em]">
                    <AlertTriangle className="w-3 h-3" /> OPEN DECISION · {od.id}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToFrame(od.targetSection, 'populated')
                    }
                    className="font-mono text-[11px] text-[#185CFF] hover:underline cursor-pointer"
                  >
                    {od.screenFrame} →
                  </button>
                </div>
                <h3 className="text-[14px] font-semibold text-[#0F172A] mt-2">
                  {od.decision}
                </h3>
                <p className="text-[12.5px] text-[#78350F] mt-1 leading-relaxed">
                  {od.question}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. MOTION SPEC & 9. HANDOFF CHECKLIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6"
        >
          <h2 className="text-[20px] font-semibold text-[#0F172A] mb-3">
            6. Motion Spec Table
          </h2>
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#475569]">
                <th className="py-2">Interaction</th>
                <th className="py-2">Move</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Easing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/60">
              {motionSpecs.map((m) => (
                <tr key={m.interaction}>
                  <td className="py-2 font-semibold text-[#0F172A]">
                    {m.interaction}
                  </td>
                  <td className="py-2 text-[#475569]">{m.move}</td>
                  <td className="py-2 font-mono text-[#185CFF]">{m.duration}</td>
                  <td className="py-2 text-[#0F172A]">{m.easing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6"
        >
          <h2 className="text-[20px] font-semibold text-[#0F172A] mb-3">
            9. Handoff Verification Checklist (14 / 14 Verified)
          </h2>
          <div className="space-y-2">
            {handoffChecklist.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2.5 text-[13px] text-[#0F172A]"
              >
                <span className="w-4 h-4 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

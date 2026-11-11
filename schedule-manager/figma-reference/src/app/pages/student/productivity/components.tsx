import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  X,
  Bell,
  Loader2,
  AlertTriangle,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  HabitCellState,
  OPEN_DECISIONS,
  PriorityLevel,
  ScreenDataState,
  StatusOutcome,
  SyncState,
  TaskItem,
} from './types';

export const EASE_CURVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SHADOW_TOKENS = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
  sm: '0 2px 8px rgba(15, 23, 42, 0.06)',
  md: '0 8px 24px rgba(15, 23, 42, 0.08)',
  lg: '0 16px 40px rgba(15, 23, 42, 0.12)',
  accent: '0 8px 24px rgba(24, 92, 255, 0.20)',
  focus: '0 0 0 3px rgba(24, 92, 255, 0.18)',
};

export function ProdButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  reducedMotion = false,
  onClick,
  children,
  className = '',
  title,
  type = 'button',
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  reducedMotion?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const sizeClasses = {
    sm: variant === 'icon-only' ? 'h-8 w-8' : 'h-8 px-3 text-[13px]',
    md: variant === 'icon-only' ? 'h-10 w-10' : 'h-10 px-4 text-[13px]',
    lg: variant === 'icon-only' ? 'h-12 w-12' : 'h-12 px-5 text-[14px]',
  }[size];

  const variantClasses = {
    primary:
      'bg-[#185CFF] text-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(24,92,255,0.20)]',
    secondary:
      'bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_#E5E7EB] hover:bg-[#EEF0F4]',
    ghost: 'bg-transparent text-[#475569] hover:bg-[#EEF0F4] hover:text-[#0F172A]',
    danger:
      'bg-white text-[#EF4444] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(239,68,68,0.35)] hover:bg-[#FEF2F2]',
    'icon-only':
      'bg-white text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_#E5E7EB] hover:bg-[#EEF0F4] hover:text-[#0F172A]',
  }[variant];

  return (
    <motion.button
      type={type}
      title={title}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={
        disabled || loading || reducedMotion
          ? undefined
          : { y: -1, transition: { duration: 0.15, ease: EASE_CURVE } }
      }
      whileTap={
        disabled || loading || reducedMotion
          ? undefined
          : { scale: 0.98, transition: { duration: 0.1, ease: EASE_CURVE } }
      }
      className={`relative inline-flex items-center justify-center gap-2 rounded-[12px] font-medium transition-colors focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(24,92,255,0.18)] select-none ${sizeClasses} ${variantClasses} ${
        disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        className={`inline-flex items-center gap-2 transition-opacity duration-150 ${
          loading ? 'opacity-40' : 'opacity-100'
        }`}
      >
        {children}
      </span>
      <AnimatePresence>
        {loading && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE_CURVE }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function ProdCheckbox({
  checked,
  onChange,
  disabled = false,
  reducedMotion = false,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  reducedMotion?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onChange) onChange();
      }}
      whileTap={
        disabled || reducedMotion
          ? undefined
          : {
              scale: 0.9,
              transition: { type: 'spring', damping: 20, stiffness: 380 },
            }
      }
      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(24,92,255,0.18)] ${
        checked
          ? 'bg-[#185CFF] ring-[1.5px] ring-[#185CFF]'
          : 'bg-white ring-[1.5px] ring-[#CBD5E1] hover:ring-[#185CFF]'
      } ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-white"
          >
            <motion.path
              d="M2.5 6.2L5 8.6L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reducedMotion ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.05 : 0.25, ease: EASE_CURVE }}
            />
          </svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function StatusPill({
  variant,
  label,
}: {
  variant: StatusOutcome;
  label?: string;
}) {
  const config: Record<
    StatusOutcome,
    { bg: string; text: string; defaultLabel: string }
  > = {
    unrecorded: {
      bg: 'rgba(148, 163, 184, 0.14)',
      text: '#475569',
      defaultLabel: 'Not recorded',
    },
    completed: {
      bg: 'rgba(16, 185, 129, 0.12)',
      text: '#059669',
      defaultLabel: 'Completed',
    },
    missed: {
      bg: 'rgba(239, 68, 68, 0.12)',
      text: '#DC2626',
      defaultLabel: 'Missed',
    },
    'pending-sync': {
      bg: 'rgba(245, 158, 11, 0.14)',
      text: '#D97706',
      defaultLabel: 'Pending sync',
    },
    official: {
      bg: 'rgba(59, 130, 246, 0.12)',
      text: '#2563EB',
      defaultLabel: 'Official',
    },
    focus: {
      bg: 'rgba(24, 92, 255, 0.12)',
      text: '#185CFF',
      defaultLabel: 'Focus',
    },
  };

  const item = config[variant];

  return (
    <span
      style={{ backgroundColor: item.bg, color: item.text }}
      className="inline-flex items-center gap-1.5 px-[10px] py-[4px] rounded-full text-[12px] font-medium leading-none shrink-0"
    >
      {variant === 'pending-sync' && (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"
        />
      )}
      <span>{label ?? item.defaultLabel}</span>
    </span>
  );
}

export interface ActivityCardRowProps {
  task: TaskItem;
  onToggleComplete: (task: TaskItem) => void;
  onClickRow?: (task: TaskItem) => void;
  isCompleting?: boolean;
  isFocusStyled?: boolean;
  showPendingSync?: boolean;
  reducedMotion?: boolean;
}

export const ActivityCardRow = React.forwardRef<
  HTMLDivElement,
  ActivityCardRowProps
>(function ActivityCardRow(
  {
    task,
    onToggleComplete,
    onClickRow,
    isCompleting = false,
    isFocusStyled = false,
    showPendingSync = false,
    reducedMotion = false,
  },
  ref
) {
  const priorityColor: Record<PriorityLevel, string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#3B82F6',
  };

  const checked = task.status === 'completed' || isCompleting;

  return (
    <motion.div
      ref={ref}
      layout={!reducedMotion}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isCompleting && !reducedMotion ? 1.015 : 1,
        backgroundColor: isCompleting
          ? '#EEF4FF'
          : isFocusStyled
          ? '#F5F7FF'
          : '#FFFFFF',
      }}
      exit={{
        opacity: 0,
        height: 0,
        marginBottom: 0,
        transition: { duration: reducedMotion ? 0.05 : 0.28, ease: EASE_CURVE },
      }}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -1,
              backgroundColor: isCompleting ? '#EEF4FF' : '#FCFCFD',
              boxShadow: SHADOW_TOKENS.sm,
              transition: { duration: 0.2, ease: EASE_CURVE },
            }
      }
      transition={
        isCompleting
          ? { type: 'spring', damping: 20, stiffness: 320 }
          : { duration: 0.22, ease: EASE_CURVE }
      }
      onClick={() => onClickRow && onClickRow(task)}
      style={{
        boxShadow: SHADOW_TOKENS.xs,
        borderLeft: isFocusStyled ? '2px solid #185CFF' : undefined,
      }}
      className="min-h-[56px] px-4 py-2.5 rounded-[12px] flex items-center justify-between gap-3 cursor-pointer select-none"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <ProdCheckbox
          checked={checked}
          onChange={() => onToggleComplete(task)}
          reducedMotion={reducedMotion}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[14px] font-medium truncate transition-colors ${
              checked ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
            }`}
          >
            {task.title}
          </p>
          <p className="text-[12px] text-[#94A3B8] truncate leading-tight mt-0.5">
            {task.source}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {showPendingSync ? (
          <StatusPill variant="pending-sync" />
        ) : task.awaitingOutcome ? (
          <StatusPill variant="unrecorded" />
        ) : task.status === 'missed' ? (
          <StatusPill variant="missed" />
        ) : null}

        <span
          title={`Priority: ${task.priority}`}
          style={{ backgroundColor: priorityColor[task.priority] }}
          className="w-2 h-2 rounded-full shrink-0"
        />

        <span className="text-[12px] text-[#475569] tabular-nums hidden sm:inline-block">
          {task.dueDate} · {task.dueTime}
        </span>

        <span className="px-2.5 py-1 rounded-full bg-[#EEF0F4] text-[#475569] text-[11px] font-semibold uppercase tracking-[0.08em]">
          {task.sourceType}
        </span>
      </div>
    </motion.div>
  );
});

export function SyncBadge({
  state,
  pendingCount = 2,
  onClick,
  reducedMotion = false,
}: {
  state: SyncState;
  pendingCount?: number;
  onClick?: () => void;
  reducedMotion?: boolean;
}) {
  return (
    <motion.button
      key={state}
      type="button"
      onClick={onClick}
      initial={reducedMotion ? { opacity: 0.9 } : { scale: 1.15 }}
      animate={reducedMotion ? { opacity: 1 } : { scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 340 }}
      title="Click to cycle Offline / Syncing / Conflict states"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
        state === 'online'
          ? 'bg-[#EEF0F4]/80 text-[#0F172A] hover:bg-[#EEF0F4]'
          : state === 'offline'
          ? 'bg-[#FEF3C7] text-[#B45309]'
          : state === 'syncing'
          ? 'bg-[#EEF4FF] text-[#185CFF]'
          : state === 'confirmed'
          ? 'bg-[#D1FAE5] text-[#047857]'
          : 'bg-[#FEE2E2] text-[#B91C1C]'
      }`}
    >
      {state === 'online' && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>Synced</span>
        </>
      )}
      {state === 'offline' && (
        <>
          <motion.span
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"
          />
          <span>Offline · {pendingCount} pending</span>
        </>
      )}
      {state === 'syncing' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#185CFF]" />
          <span>Syncing records…</span>
        </>
      )}
      {state === 'confirmed' && (
        <>
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
          <span>All changes synced</span>
        </>
      )}
      {state === 'conflict' && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          <Bell className="w-3.5 h-3.5 text-[#EF4444]" />
          <span>1 Sync Conflict</span>
        </>
      )}
    </motion.button>
  );
}

export function SegmentedControl<T extends string>({
  id,
  options,
  value,
  onChange,
  size = 'md',
}: {
  id: string;
  options: { value: T; label: string; badge?: string | number }[];
  value: T;
  onChange: (val: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex items-center p-1 rounded-full bg-[#EEF0F4]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative ${
              size === 'sm' ? 'px-3 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]'
            } rounded-full font-medium transition-colors cursor-pointer select-none ${
              active ? 'text-[#0F172A]' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            {active && (
              <motion.div
                layoutId={`seg-${id}`}
                transition={{ duration: 0.25, ease: EASE_CURVE }}
                style={{ boxShadow: SHADOW_TOKENS.xs }}
                className="absolute inset-0 bg-white rounded-full"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? 'bg-[#EEF4FF] text-[#185CFF]'
                      : 'bg-white/70 text-[#475569]'
                  }`}
                >
                  {opt.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ProdModal({
  open,
  onClose,
  title,
  subtitle,
  variant = 'modal',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: 'modal' | 'sheet';
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_CURVE }}
          onClick={onClose}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.40)' }}
          className="fixed inset-0 z-50 backdrop-blur-[4px] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: SHADOW_TOKENS.lg }}
            className={`w-full ${
              variant === 'sheet' ? 'max-w-[640px]' : 'max-w-[480px]'
            } bg-white rounded-[20px] p-6 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-[20px] leading-[28px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[13px] text-[#475569] mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#EEF0F4] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  const barColors = {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#185CFF',
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.slice(0, 3).map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.75,
              x: 80,
              transition: { duration: 0.2, ease: EASE_CURVE },
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              boxShadow: SHADOW_TOKENS.md,
              borderLeft: `4px solid ${barColors[t.tone]}`,
            }}
            className="pointer-events-auto bg-white rounded-[12px] px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#0F172A]">{t.title}</p>
              {t.subtitle && (
                <p className="text-[12px] text-[#475569] mt-0.5">{t.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function EmptyStateBlock({
  title,
  description,
  ctaLabel,
  onCta,
  variant = 'empty',
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  variant?: 'empty' | 'error' | 'access-denied' | 'all-complete';
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center text-center max-w-[320px] mx-auto">
      <div className="w-[110px] h-[90px] rounded-[16px] bg-[#EEF4FF]/70 flex items-center justify-center mb-4 relative overflow-hidden">
        <svg width="86" height="68" viewBox="0 0 86 68" fill="none">
          <rect
            x="10"
            y="12"
            width="66"
            height="44"
            rx="8"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />
          <rect x="20" y="22" width="28" height="5" rx="2.5" fill="#185CFF" fillOpacity="0.25" />
          <rect x="20" y="32" width="44" height="4" rx="2" fill="#E2E8F0" />
          <rect x="20" y="41" width="34" height="4" rx="2" fill="#E2E8F0" />
          <circle
            cx="64"
            cy="24"
            r="8"
            fill={
              variant === 'error'
                ? '#FEE2E2'
                : variant === 'access-denied'
                ? '#FEF3C7'
                : '#DCFCE7'
            }
          />
          <path
            d={
              variant === 'error'
                ? 'M61.5 21.5L66.5 26.5M66.5 21.5L61.5 26.5'
                : 'M60.5 24L63 26.5L67.5 21.5'
            }
            stroke={
              variant === 'error'
                ? '#EF4444'
                : variant === 'access-denied'
                ? '#D97706'
                : '#10B981'
            }
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h3 className="text-[20px] leading-[28px] font-semibold tracking-[-0.01em] text-[#0F172A]">
        {title}
      </h3>
      <p className="text-[14px] leading-[20px] text-[#475569] mt-1.5 mb-5">
        {description}
      </p>
      {ctaLabel && onCta && (
        <ProdButton variant="primary" size="md" onClick={onCta}>
          {ctaLabel}
        </ProdButton>
      )}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading commitments">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{ boxShadow: SHADOW_TOKENS.xs }}
          className="h-[56px] rounded-[12px] bg-white px-4 flex items-center justify-between gap-4 overflow-hidden relative"
        >
          <div className="flex items-center gap-3.5 flex-1">
            <div className="w-5 h-5 rounded-full bg-[#EEF0F4] shrink-0" />
            <div className="space-y-2 flex-1 max-w-md">
              <motion.div
                animate={{ backgroundPosition: ['0% 50%', '200% 50%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #EEF0F4 0%, #F7F8FA 50%, #EEF0F4 100%)',
                  backgroundSize: '200% 100%',
                }}
                className="h-3.5 w-3/4 rounded-md"
              />
              <div className="h-2.5 w-1/2 rounded-md bg-[#EEF0F4]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#EEF0F4]" />
            <div className="w-20 h-3 rounded-md bg-[#EEF0F4] hidden sm:block" />
            <div className="w-14 h-5 rounded-full bg-[#EEF0F4]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HabitGridCellView({
  state,
  onClick,
  reducedMotion = false,
}: {
  state: HabitCellState;
  onClick?: () => void;
  reducedMotion?: boolean;
}) {
  return (
    <motion.button
      key={state}
      type="button"
      onClick={onClick}
      initial={reducedMotion ? false : { scale: 1.15 }}
      animate={{ scale: 1 }}
      whileHover={reducedMotion ? undefined : { scale: 1.05 }}
      whileTap={
        reducedMotion
          ? undefined
          : {
              scale: 0.92,
            }
      }
      transition={{ type: 'spring', damping: 18, stiffness: 360 }}
      className={`w-[28px] h-[28px] rounded-[6px] inline-flex items-center justify-center transition-colors cursor-pointer select-none focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(24,92,255,0.18)] ${
        state === 'complete'
          ? 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_2px_6px_rgba(16,185,129,0.25)]'
          : state === 'missed'
          ? 'bg-[#FEE2E2] text-[#EF4444]'
          : state === 'today-scheduled'
          ? 'bg-white ring-[1.5px] ring-[#185CFF]'
          : state === 'scheduled'
          ? 'bg-white ring-[1.5px] ring-[#CBD5E1] hover:ring-[#185CFF]'
          : 'bg-transparent'
      }`}
    >
      {state === 'complete' && (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
          <motion.path
            d="M2.5 6.2L5 8.6L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reducedMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.22, ease: EASE_CURVE }}
          />
        </svg>
      )}
      {state === 'missed' && <X className="w-3.5 h-3.5 stroke-[2.2]" />}
      {state === 'not-scheduled' && (
        <span className="w-1 h-1 rounded-full bg-[#94A3B8]" />
      )}
    </motion.button>
  );
}

export function ProdProgressBar({
  value,
  max,
  label,
  reducedMotion = false,
}: {
  value: number;
  max: number;
  label?: string;
  reducedMotion?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const [displayPct, setDisplayPct] = useState(reducedMotion ? pct : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayPct(pct);
      return;
    }
    const timeout = setTimeout(() => setDisplayPct(pct), 60);
    return () => clearTimeout(timeout);
  }, [pct, reducedMotion]);

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span className="font-medium text-[#475569]">{label}</span>
          <span className="font-semibold text-[#0F172A] tabular-nums">
            {value} of {max} ({displayPct}%)
          </span>
        </div>
      )}
      <div className="w-full h-[6px] rounded-full bg-[#EEF0F4] overflow-hidden">
        <motion.div
          initial={{ width: reducedMotion ? `${pct}%` : '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reducedMotion ? 0.05 : 0.4, ease: EASE_CURVE }}
          className="h-full rounded-full bg-[#185CFF]"
        />
      </div>
    </div>
  );
}

export function OpenDecisionChip({
  decisionId,
  showAnnotations,
}: {
  decisionId: string;
  showAnnotations: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!showAnnotations) return null;

  const item = OPEN_DECISIONS.find((d) => d.id === decisionId);
  if (!item) return null;

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-semibold tracking-[0.06em] uppercase shadow-[0_2px_6px_rgba(245,158,11,0.18)] cursor-pointer hover:bg-[#FDE68A] transition-colors"
      >
        <AlertTriangle className="w-3 h-3 text-[#D97706]" />
        <span>
          OPEN DECISION · {item.id}: {item.decision}
        </span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE_CURVE }}
            className="mt-1.5 p-3 rounded-[12px] bg-[#FFFBEB] text-[#78350F] text-[12px] shadow-[0_4px_12px_rgba(245,158,11,0.12)] max-w-xl"
          >
            <p className="font-semibold mb-0.5">
              Screen Frame: <span className="font-mono">{item.screenFrame}</span>
            </p>
            <p className="leading-relaxed">PO Question: {item.question}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FrameStateBanner({
  frameName,
  dataState,
  onChangeDataState,
  showAnnotations,
  extraBadges,
}: {
  frameName: string;
  dataState: ScreenDataState;
  onChangeDataState: (s: ScreenDataState) => void;
  showAnnotations: boolean;
  extraBadges?: React.ReactNode;
}) {
  const states: { id: ScreenDataState; label: string }[] = [
    { id: 'populated', label: 'Populated' },
    { id: 'loading', label: 'Loading' },
    { id: 'empty', label: 'Empty' },
    { id: 'error', label: 'Error+Retry' },
    { id: 'access-denied', label: 'Access Denied' },
    { id: 'pending-sync', label: 'Pending Sync' },
  ];

  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EEF0F4]/85 px-3.5 py-2 rounded-[12px]">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#185CFF]" />
          <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
            {frameName}
          </span>
          {extraBadges}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {states.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onChangeDataState(st.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                dataState === st.id
                  ? 'bg-[#185CFF] text-white'
                  : 'bg-white/80 text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {showAnnotations && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-[10px] bg-[#EEF4FF] text-[#185CFF] text-[11.5px]">
          <span className="font-medium">
            💬 Figma Motion Comment: One spring per interaction, everything else --ease · Animate max 2 properties at once · Respects prefers-reduced-motion
          </span>
          <span className="font-mono text-[11px] opacity-80">
            1440×900 · 12-col · 8px grid
          </span>
        </div>
      )}
    </div>
  );
}

export function TokensSpecPage() {
  const colorTokens = [
    { name: 'Surface/app', hex: '#F7F8FA', desc: 'Portal canvas background' },
    { name: 'Surface/card', hex: '#FFFFFF', desc: 'Elevated card surface' },
    { name: 'Surface/sunken', hex: '#EEF0F4', desc: 'Segmented track & pills' },
    { name: 'Surface/hover', hex: '#FCFCFD', desc: 'Subtle row hover lift' },
    { name: 'Accent/base', hex: '#185CFF', desc: 'Akadverse primary interactive blue' },
    { name: 'Accent/soft', hex: '#EEF4FF', desc: 'Focus row & today highlight tint' },
    { name: 'Semantic/success', hex: '#10B981', desc: 'Completed task & habit cell' },
    { name: 'Semantic/warning', hex: '#F59E0B', desc: 'Pending sync & awaiting outcome' },
    { name: 'Semantic/danger', hex: '#EF4444', desc: 'Missed outcome & schedule conflict' },
    { name: 'Semantic/info', hex: '#3B82F6', desc: 'Official timetable lock badge' },
    { name: 'Text/primary', hex: '#0F172A', desc: 'High-contrast titles & headings' },
    { name: 'Text/secondary', hex: '#475569', desc: 'Supporting body copy' },
    { name: 'Text/muted', hex: '#94A3B8', desc: 'Source metadata & captions' },
  ];

  const typeRamp = [
    { style: 'Display/32', spec: '32 / 40 · -0.02em · 600', sample: 'Productivity Layer' },
    { style: 'Heading/24', spec: '24 / 32 · -0.01em · 600', sample: 'Friday, 31 October' },
    { style: 'Heading/20', spec: '20 / 28 · -0.01em · 600', sample: 'EEE 311 · Electric Circuit Theory I' },
    { style: 'Body/16', spec: '16 / 24 · 0 · 400', sample: 'See commitments, act on them quickly, and understand progress.' },
    { style: 'Body/14', spec: '14 / 20 · 0 · 400', sample: 'Solve Thevenin & Norton Problem Set 4 before 2:00 PM.' },
    { style: 'Label/13', spec: '13 / 18 · 0 · 500', sample: 'Complete · Mark missed · Choose another time' },
    { style: 'Caption/12', spec: '12 / 16 · 0.01em · 400', sample: 'Habit · Mon, Wed, Fri at 6:00 AM' },
    { style: 'Overline/11', spec: '11 / 14 · 0.08em · 600 · UPPERCASE', sample: 'FOCUS TODAY · AWAITING OUTCOME' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
          FIGMA PAGE 00 · TOKENS
        </span>
        <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A] mt-1">
          Design Tokens &amp; Portal Style Foundation
        </h1>
        <p className="text-[14px] text-[#475569] mt-1">
          Aligned to Akadverse portal tokens: one accent color (#185CFF), neutral surfaces, soft depth shadows instead of hard borders, 12–16px radius, 8px spacing grid.
        </p>
      </div>

      <div
        style={{ boxShadow: SHADOW_TOKENS.sm }}
        className="bg-white rounded-[16px] p-6"
      >
        <h2 className="text-[20px] font-semibold text-[#0F172A] mb-4">
          Color Styles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {colorTokens.map((tok) => (
            <div
              key={tok.name}
              style={{ boxShadow: SHADOW_TOKENS.xs }}
              className="p-3.5 rounded-[12px] bg-[#F7F8FA] flex items-center gap-3.5"
            >
              <div
                style={{
                  backgroundColor: tok.hex,
                  boxShadow: SHADOW_TOKENS.xs,
                }}
                className="w-11 h-11 rounded-[10px] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">
                  {tok.name}
                </p>
                <p className="font-mono text-[11.5px] text-[#185CFF]">{tok.hex}</p>
                <p className="text-[11.5px] text-[#475569] truncate">{tok.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{ boxShadow: SHADOW_TOKENS.sm }}
        className="bg-white rounded-[16px] p-6"
      >
        <h2 className="text-[20px] font-semibold text-[#0F172A] mb-4">
          8-Style Type Ramp (Portal Font Family)
        </h2>
        <div className="divide-y divide-[#E5E7EB]/60">
          {typeRamp.map((t) => (
            <div
              key={t.style}
              className="py-3.5 flex flex-col md:flex-row md:items-baseline justify-between gap-2"
            >
              <div className="w-56 shrink-0">
                <p className="font-mono text-[12px] font-semibold text-[#185CFF]">
                  {t.style}
                </p>
                <p className="text-[12px] text-[#94A3B8]">{t.spec}</p>
              </div>
              <div className="flex-1 text-[#0F172A] font-medium">{t.sample}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6"
        >
          <h2 className="text-[20px] font-semibold text-[#0F172A] mb-4">
            Effect Styles (Soft Depth Shadows)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'Shadow/xs', val: SHADOW_TOKENS.xs },
              { name: 'Shadow/sm', val: SHADOW_TOKENS.sm },
              { name: 'Shadow/md', val: SHADOW_TOKENS.md },
              { name: 'Shadow/lg', val: SHADOW_TOKENS.lg },
              { name: 'Shadow/accent', val: SHADOW_TOKENS.accent },
              { name: 'Glow/focus', val: SHADOW_TOKENS.focus },
            ].map((ef) => (
              <div
                key={ef.name}
                style={{ boxShadow: ef.val }}
                className="p-4 rounded-[12px] bg-white"
              >
                <p className="font-mono text-[12px] font-semibold text-[#0F172A]">
                  {ef.name}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1 truncate">{ef.val}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6"
        >
          <h2 className="text-[20px] font-semibold text-[#0F172A] mb-4">
            Radius &amp; Frame Grid Tokens
          </h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { label: 'r/sm · 8px', r: '8px' },
              { label: 'r/md · 12px', r: '12px' },
              { label: 'r/lg · 16px', r: '16px' },
              { label: 'r/xl · 20px', r: '20px' },
              { label: 'r/pill · 999px', r: '999px' },
            ].map((rad) => (
              <div
                key={rad.label}
                style={{
                  borderRadius: rad.r,
                  boxShadow: SHADOW_TOKENS.xs,
                }}
                className="px-4 py-3 bg-[#EEF4FF] text-[#185CFF] font-mono text-[12px] font-semibold"
              >
                {rad.label}
              </div>
            ))}
          </div>
          <div className="p-4 rounded-[12px] bg-[#F7F8FA] space-y-1.5 text-[13px] text-[#475569]">
            <p>
              <strong className="text-[#0F172A]">Desktop Frame:</strong> 1440 × 900 · 12-col grid · 24px gutter · 80px margin
            </p>
            <p>
              <strong className="text-[#0F172A]">Mobile Frame:</strong> 390 × 844 · 4-col grid · 16px gutter · 16px margin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComponentsLibraryPage({
  onTriggerToast,
}: {
  onTriggerToast: (t: Omit<ToastMessage, 'id'>) => void;
}) {
  const [demoChecked, setDemoChecked] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoTab, setDemoTab] = useState<'week' | 'agenda'>('week');
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#185CFF]">
          FIGMA PAGE 01 · COMPONENTS
        </span>
        <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-[#0F172A] mt-1">
          Reusable Component Library (3.1 – 3.12)
        </h1>
        <p className="text-[14px] text-[#475569] mt-1">
          Interactive instances across rest / hover / active / focus / disabled states, sizes (sm / md / lg), and content states.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.1 Button (Variants, Sizes &amp; Width-Locked Loading)
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <ProdButton variant="primary">Primary</ProdButton>
            <ProdButton variant="secondary">Secondary</ProdButton>
            <ProdButton variant="ghost">Ghost</ProdButton>
            <ProdButton variant="danger">Danger</ProdButton>
            <ProdButton variant="icon-only" title="Icon only">
              <Sparkles className="w-4 h-4" />
            </ProdButton>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <ProdButton size="sm" variant="primary">
              Size sm (32h)
            </ProdButton>
            <ProdButton size="md" variant="primary">
              Size md (40h)
            </ProdButton>
            <ProdButton size="lg" variant="primary">
              Size lg (48h)
            </ProdButton>
            <ProdButton
              variant="primary"
              loading={demoLoading}
              onClick={() => {
                setDemoLoading(true);
                setTimeout(() => setDemoLoading(false), 1200);
              }}
            >
              Click to Test Loading
            </ProdButton>
            <ProdButton variant="secondary" disabled>
              Disabled
            </ProdButton>
          </div>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.2 Checkbox (SVG Draw + 120ms Spring) &amp; 3.4 Status Pill
          </h3>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2.5 text-[13px] text-[#0F172A] cursor-pointer">
              <ProdCheckbox
                checked={demoChecked}
                onChange={() => setDemoChecked((p) => !p)}
              />
              <span>Interactive SVG Draw Checkbox</span>
            </label>
            <ProdCheckbox checked={false} />
            <ProdCheckbox checked={true} disabled />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <StatusPill variant="unrecorded" />
            <StatusPill variant="completed" />
            <StatusPill variant="missed" />
            <StatusPill variant="pending-sync" />
            <StatusPill variant="official" />
            <StatusPill variant="focus" />
          </div>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.5 Sync Badge (300ms Spring Pop) &amp; 3.6 Segmented Control
          </h3>
          <div className="flex flex-wrap items-center gap-2.5">
            {(['online', 'offline', 'syncing', 'confirmed', 'conflict'] as SyncState[]).map(
              (st) => (
                <SyncBadge key={st} state={st} />
              )
            )}
          </div>
          <div className="pt-2 flex items-center justify-between">
            <SegmentedControl
              id="demo-seg"
              value={demoTab}
              onChange={setDemoTab}
              options={[
                { value: 'week', label: 'Week View', badge: 9 },
                { value: 'agenda', label: 'Agenda View' },
              ]}
            />
            <ProdButton
              size="sm"
              variant="secondary"
              onClick={() => setDemoModalOpen(true)}
            >
              3.7 Open Modal
            </ProdButton>
          </div>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.11 Habit Grid Cell (28×28) &amp; 3.12 Progress Bar
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            {(
              [
                'complete',
                'missed',
                'today-scheduled',
                'scheduled',
                'not-scheduled',
              ] as HabitCellState[]
            ).map((st) => (
              <div key={st} className="flex flex-col items-center gap-1">
                <HabitGridCellView state={st} />
                <span className="text-[11px] text-[#94A3B8]">{st}</span>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <ProdProgressBar value={2} max={3} label="3.12 Habits Progress Mount Count-Up" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-4"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.8 Toast Stack (Bottom-Center, Max 3, 4px Semantic Left Bar)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            <ProdButton
              size="sm"
              variant="primary"
              onClick={() =>
                onTriggerToast({
                  title: 'Commitment Completed',
                  subtitle: 'Habit cell & daily total updated',
                  tone: 'success',
                })
              }
            >
              Trigger Success Toast
            </ProdButton>
            <ProdButton
              size="sm"
              variant="secondary"
              onClick={() =>
                onTriggerToast({
                  title: 'Saved Offline · Pending Sync',
                  subtitle: 'Will sync automatically when connection returns',
                  tone: 'warning',
                })
              }
            >
              Trigger Warning Toast
            </ProdButton>
            <ProdButton
              size="sm"
              variant="danger"
              onClick={() =>
                onTriggerToast({
                  title: 'Failed to Save Task',
                  subtitle: 'Network timeout — your input was preserved',
                  tone: 'danger',
                })
              }
            >
              Trigger Danger Toast
            </ProdButton>
          </div>
        </div>

        <div
          style={{ boxShadow: SHADOW_TOKENS.sm }}
          className="bg-white rounded-[16px] p-6 space-y-3"
        >
          <h3 className="text-[16px] font-semibold text-[#0F172A]">
            3.10 Skeleton Shimmer (1.4s Infinite)
          </h3>
          <SkeletonList rows={2} />
        </div>
      </div>

      <ProdModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="3.7 Modal / Sheet Spec"
        subtitle="Scale 0.96 → 1, y 8 → 0, opacity 0 → 1 (220ms spring)"
      >
        <p className="text-[14px] text-[#475569] leading-relaxed mb-4">
          Backdrop uses rgba(15,23,42,0.40) + blur(4px). Panel uses white surface, r/xl (20px), Shadow/lg, and 20ms field stagger.
        </p>
        <div className="flex justify-end">
          <ProdButton onClick={() => setDemoModalOpen(false)}>Done</ProdButton>
        </div>
      </ProdModal>
    </div>
  );
}

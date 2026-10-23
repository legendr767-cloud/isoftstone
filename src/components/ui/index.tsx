import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ───────── Button ─────────
const variants = {
  primary: 'bg-brand-500 text-ink-950 font-bold hover:bg-brand-400 shadow-glow disabled:opacity-50 disabled:shadow-none',
  secondary: 'border border-line bg-ink-700 text-white hover:bg-ink-600 disabled:opacity-50',
  ghost: 'text-slate-300 hover:bg-ink-700 hover:text-white disabled:opacity-50',
  danger: 'bg-red-500/90 text-white hover:bg-red-500 disabled:opacity-50',
} as const;
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-7 text-base' } as const;
const btn = (v: keyof typeof variants, s: keyof typeof sizes, extra?: string) =>
  cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed', variants[v], sizes[s], extra);

type BProps = { variant?: keyof typeof variants; size?: keyof typeof sizes; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & BProps>(({ variant = 'primary', size = 'md', loading, className, children, disabled, ...p }, ref) => (
  <button ref={ref} disabled={disabled || loading} className={btn(variant, size, className)} {...p}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
  </button>
));
Button.displayName = 'Button';
export const ButtonLink = ({ variant = 'primary', size = 'md', className, ...p }: LinkProps & BProps) => <Link className={btn(variant, size, className)} {...p} />;

// ───────── Form controls ─────────
interface FieldProps { label: string; error?: string; hint?: string; id: string }
const fieldBase = 'w-full rounded-lg border bg-ink-800 px-3.5 text-sm text-white placeholder:text-slate-500 transition-colors focus-visible:border-brand-400 disabled:opacity-60';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(({ label, error, hint, id, className, ...p }, ref) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-200">{label}</label>
    <input id={id} ref={ref} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={cn(fieldBase, 'h-11', error ? 'border-red-400' : 'border-line', className)} {...p} />
    {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-400">{hint}</p>}
    {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
  </div>
));
Input.displayName = 'Input';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(({ label, error, hint, id, className, ...p }, ref) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-200">{label}</label>
    <textarea id={id} ref={ref} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className={cn(fieldBase, 'min-h-28 py-2.5', error ? 'border-red-400' : 'border-line', className)} {...p} />
    {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(({ label, error, id, className, children, ...p }, ref) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-200">{label}</label>
    <select id={id} ref={ref} aria-invalid={!!error} className={cn(fieldBase, 'h-11', error ? 'border-red-400' : 'border-line', className)} {...p}>{children}</select>
    {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
  </div>
));
Select.displayName = 'Select';
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }>(({ label, error, id, className, ...p }, ref) => (
  <div>
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
      <input id={id} ref={ref} type="checkbox" className={cn('mt-0.5 h-4 w-4 rounded border-line bg-ink-800 accent-emerald-500', className)} {...p} />
      <span>{label}</span>
    </label>
    {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
  </div>
));
Checkbox.displayName = 'Checkbox';

// ───────── Display ─────────
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('card', className)} {...p} />;
const tones = {
  green: 'bg-brand-500/15 text-brand-300 ring-brand-500/30', amber: 'bg-amber-400/15 text-amber-200 ring-amber-400/30',
  red: 'bg-red-400/15 text-red-200 ring-red-400/30', blue: 'bg-royal-500/20 text-blue-200 ring-royal-500/40', slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
} as const;
export const Badge = ({ tone = 'slate', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>
);
export const statusTone = (s: string): keyof typeof tones =>
  ({ PAID: 'green', ACTIVE: 'green', APPROVED: 'green', PROCESSED: 'green', PASSED: 'green', RESOLVED: 'green', PUBLISHED: 'green', PENDING: 'amber', AWAITING_PAYMENT: 'amber', PENDING_PROVISIONING: 'amber',
    OPEN: 'amber', DRAFT: 'amber', SUBMITTED: 'blue', FAILED: 'red', BREACHED: 'red', REJECTED: 'red', SUSPENDED: 'red', CANCELLED: 'slate', CLOSED: 'slate', REFUNDED: 'slate' } as Record<string, keyof typeof tones>)[s] ?? 'slate';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-lg bg-ink-600/60', className)} />;
export const PageLoader = () => <div role="status" aria-label="Loading" className="space-y-4 py-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-4 text-brand-400" aria-hidden>{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-2 max-w-md text-sm text-slate-400">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const alertCfg = { info: [Info, 'border-royal-500/40 bg-royal-500/10 text-blue-100'], success: [CheckCircle2, 'border-brand-500/40 bg-brand-500/10 text-brand-50'], warning: [AlertTriangle, 'border-amber-400/40 bg-amber-400/10 text-amber-100'], error: [AlertTriangle, 'border-red-400/40 bg-red-400/10 text-red-100'] } as const;
export function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof alertCfg; title?: string; children?: ReactNode; className?: string }) {
  const [Icon, cls] = alertCfg[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border p-4 text-sm', cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{title && <p className="font-semibold">{title}</p>}{children && <div className={title ? 'mt-1 opacity-90' : ''}>{children}</div>}</div>
    </div>
  );
}

export const Progress = ({ value, label, tone = 'green' }: { value: number; label: string; tone?: 'green' | 'amber' | 'red' }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-ink-600">
    <div className={cn('h-full rounded-full transition-all', tone === 'green' ? 'bg-brand-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

// ───────── Table (scrolls inside its own container on small screens) ─────────
export const TableWrap = ({ children, caption }: { children: ReactNode; caption?: string }) => (
  <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={caption ?? 'Data table'}>
    <table className="w-full min-w-[560px] border-collapse text-left text-sm">{caption && <caption className="sr-only">{caption}</caption>}{children}</table>
  </div>
);
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <th scope="col" className={cn('whitespace-nowrap border-b border-line bg-ink-700/60 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400', className)}>{children}</th>;
export const Td = ({ children, className, title }: { children?: ReactNode; className?: string; title?: string }) => <td title={title} className={cn('border-b border-line/60 px-4 py-3 align-middle', className)}>{children}</td>;

// ───────── Modal (native <dialog>: focus trap, Esc to close) ─────────
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="modal-title"
      className="w-[min(92vw,34rem)] rounded-xl border border-line bg-ink-800 p-0 text-slate-200 shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-slate-400 hover:bg-ink-600 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

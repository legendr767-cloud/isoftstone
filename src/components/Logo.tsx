import { cn } from '@/lib/utils';

/**
 * iSoftStone logo. Icon geometry is taken directly from the supplied brand SVG; the wordmark is live text
 * (Montserrat) so it adapts to light/dark surfaces. The original file remains at /logo.svg.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="15 4 90 106" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="isoft-accent" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#34D399" /></linearGradient></defs>
      <path d="M 20,95 L 50,105 L 80,85 L 50,65 Z" fill="#475569" />
      <path d="M 50,65 L 80,85 L 85,45 L 50,35 Z" fill="#64748B" />
      <path d="M 50,35 L 85,45 L 95,10 L 55,20 Z" fill="url(#isoft-accent)" />
      <circle cx="75" cy="12" r="6" fill="#10B981" />
    </svg>
  );
}

export function Logo({ className, showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="iSoftStone — Proprietary Trading" role="img">
      <LogoMark className="h-9 w-auto" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] text-white"><span className="font-light">i</span><span className="font-black">SOFTSTONE</span></span>
        {showTagline && <span className="mt-1 font-display text-[0.5rem] font-bold uppercase tracking-[0.32em] text-brand-500">Proprietary Trading</span>}
      </span>
    </span>
  );
}

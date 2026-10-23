import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PageLoader } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { Seo } from '@/components/Seo';
import { cn } from '@/lib/utils';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; perm?: string }

/** Shared chrome for the customer dashboard and the admin area. Authentication is verified server-side on every API call. */
export function AppShell({ title, items, requirePerm }: { title: string; items: NavItem[]; requirePerm?: string }) {
  const { user, loading, can, logout } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="container py-10"><PageLoader /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (requirePerm && !can(requirePerm)) return <Navigate to="/dashboard" replace />;
  const visible = items.filter((i) => !i.perm || can(i.perm));
  return (
    <div className="min-h-screen bg-ink-900 lg:flex">
      <Seo title={title} noindex />
      <aside className="border-b border-line bg-ink-950 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link to="/" aria-label="iSoftStone home"><Logo showTagline={false} /></Link>
          <button onClick={() => logout()} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-ink-700 hover:text-white lg:hidden"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
        </div>
        <nav aria-label={`${title} navigation`} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {visible.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-500/15 text-brand-300' : 'text-slate-300 hover:bg-ink-700 hover:text-white')}>
              <Icon className="h-4 w-4" aria-hidden />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-line p-4 lg:absolute lg:bottom-0 lg:block lg:w-64">
          <p className="truncate text-xs text-slate-400">{user.email}</p>
          <button onClick={() => logout()} className="mt-2 flex items-center gap-2 text-sm text-slate-300 hover:text-white"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main>
    </div>
  );
}

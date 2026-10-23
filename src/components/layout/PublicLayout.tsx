import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSite } from '@/hooks/useSite';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const link = ({ isActive }: { isActive: boolean }) => cn('rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-white', isActive ? 'text-brand-400' : 'text-slate-300');
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ink-900/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" aria-label="iSoftStone home"><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {brand.nav.map((n) => <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? <ButtonLink to={user.permissions?.includes('admin:overview') ? '/admin' : '/dashboard'} size="sm">{user.permissions?.includes('admin:overview') ? 'Admin' : 'Dashboard'}</ButtonLink> : (
            <><ButtonLink to="/login" variant="ghost" size="sm">Sign in</ButtonLink><ButtonLink to="/challenges" size="sm">Get started</ButtonLink></>
          )}
        </div>
        <button className="rounded-md p-2 text-slate-200 hover:bg-ink-700 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-ink-900 lg:hidden">
          <div className="container flex flex-col gap-1 py-4">
            {brand.nav.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-md px-3 py-3 text-base font-medium', isActive ? 'bg-ink-700 text-brand-400' : 'text-slate-200')}>{n.label}</NavLink>)}
            <div className="mt-3 flex gap-2">
              {user ? <ButtonLink to="/dashboard" className="flex-1">Dashboard</ButtonLink> : <><ButtonLink to="/login" variant="secondary" className="flex-1">Sign in</ButtonLink><ButtonLink to="/register" className="flex-1">Register</ButtonLink></>}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const { data: site } = useSite();
  const socials = Object.entries(brand.social).filter(([, v]) => v);
  return (
    <footer className="border-t border-line bg-ink-950">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Forex-only simulated trading evaluations with transparent rules. Built for traders who want clarity.</p>
          {site?.supportEmail && <p className="mt-4 text-sm text-slate-300">Support: <a className="text-brand-400 hover:underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>}
          {socials.length > 0 && <ul className="mt-4 flex gap-4 text-sm">{socials.map(([k, v]) => <li key={k}><a className="capitalize text-slate-300 hover:text-white" href={v} rel="noopener noreferrer" target="_blank">{k}</a></li>)}</ul>}
        </div>
        <nav aria-label="Company"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Company</h2>
          <ul className="mt-4 space-y-2.5 text-sm">{[{ to: '/challenges', label: 'Challenges' }, { to: '/how-it-works', label: 'How it works' }, { to: '/calculator', label: 'Profit calculator' }, ...brand.footer.company].map((l) => <li key={l.to}><Link className="text-slate-300 hover:text-white" to={l.to}>{l.label}</Link></li>)}</ul></nav>
        <nav aria-label="Legal"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Legal</h2>
          <ul className="mt-4 space-y-2.5 text-sm">{brand.footer.legal.map((l) => <li key={l.to}><Link className="text-slate-300 hover:text-white" to={l.to}>{l.label}</Link></li>)}</ul></nav>
      </div>
      <div className="border-t border-line/70">
        <div className="container py-6 text-xs leading-6 text-slate-500">
          <p>{brand.riskNotice}</p>
          <p className="mt-2">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:font-bold focus:text-ink-950">Skip to content</a>
      <Header />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

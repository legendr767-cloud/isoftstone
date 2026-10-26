import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorText } from '@/lib/api';
import { Seo } from '@/components/Seo';
import { Alert, Button, Card, Checkbox, Input } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useSite } from '@/hooks/useSite';
import type { User } from '@/lib/types';

const pw = z.string().min(10, 'Use at least 10 characters').max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number');

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12"><Seo title={title} noindex />
      <div className="w-full max-w-md"><Link to="/" className="mb-8 flex justify-center" aria-label="iSoftStone home"><Logo /></Link>
        <Card className="p-6 sm:p-8"><h1 className="text-2xl font-extrabold">{title}</h1>{subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}<div className="mt-6">{children}</div></Card></div>
    </div>
  );
}
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null); // prevent open redirects

export function Login() {
  const [params] = useSearchParams(); const nav = useNavigate(); const qc = useQueryClient(); const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })) });
  if (user) return <Navigate to={safeNext(params.get('next')) ?? (user.permissions?.includes('admin:overview') ? '/admin' : '/dashboard')} replace />;
  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await api.post<User>('/auth/login', v);
      const me = await qc.fetchQuery({ queryKey: ['me'], queryFn: async () => (await api.get<User | null>('/auth/me')).data, staleTime: 0 });
      const home = me?.permissions?.includes('admin:overview') ? '/admin' : '/dashboard';
      nav(safeNext(params.get('next')) ?? home, { replace: true });
    } catch (e) { setErr(errorText(e)); }
  });
  return (
    <Shell title="Sign in" subtitle="Welcome back. Access your dashboard.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {err && <Alert tone="error">{err}</Alert>}
        <Input id="l-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input id="l-pw" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400"><Link className="text-brand-400 hover:underline" to="/forgot-password">Forgot password?</Link></p>
      <p className="mt-2 text-center text-sm text-slate-400">New here? <Link className="font-semibold text-brand-400 hover:underline" to="/register">Create an account</Link></p>
    </Shell>
  );
}

const regSchema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(60), lastName: z.string().trim().min(1, 'Required').max(60),
  email: z.string().trim().email('Enter a valid email'), password: pw,
  country: z.string().trim().length(2, 'Use a 2-letter country code').or(z.literal('')),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions' }) }),
});
export function Register() {
  const [params] = useSearchParams(); const nav = useNavigate(); const qc = useQueryClient(); const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof regSchema>>({ resolver: zodResolver(regSchema), defaultValues: { country: '' } });
  if (user) return <Navigate to="/dashboard" replace />;
  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try { await api.post('/auth/register', { ...v, country: v.country || undefined }); await qc.invalidateQueries({ queryKey: ['me'] }); nav(safeNext(params.get('next')) ?? '/dashboard', { replace: true }); } catch (e) { setErr(errorText(e)); }
  });
  return (
    <Shell title="Create your account" subtitle="Register to purchase challenges and track your progress.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {err && <Alert tone="error">{err}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2"><Input id="r-fn" label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} /><Input id="r-ln" label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} /></div>
        <Input id="r-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input id="r-pw" label="Password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <Input id="r-country" label="Country code (optional)" maxLength={2} placeholder="GB" error={errors.country?.message} {...register('country')} />
        <Checkbox id="r-terms" label={<>I accept the <Link className="text-brand-400 underline" to="/legal/terms" target="_blank">Terms and Conditions</Link> and acknowledge the <Link className="text-brand-400 underline" to="/legal/risk-disclosure" target="_blank">Risk Disclosure</Link>.</>} error={errors.acceptTerms?.message} {...register('acceptTerms')} />
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">Already registered? <Link className="font-semibold text-brand-400 hover:underline" to="/login">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const { data: site } = useSite();
  const [done, setDone] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  return (
    <Shell title="Reset your password" subtitle="Enter your email and we will send a reset link if an account exists.">
      {site && !site.emailDelivery && <Alert tone="warning" className="mb-5" title="Email delivery is not enabled yet">Reset links cannot be sent right now. Please <Link className="underline" to="/contact">contact support</Link> to recover your account.</Alert>}
      {done ? <Alert tone="success">If an account exists for that email, a reset link has been sent. The link is valid for one hour.</Alert> : (
        <form onSubmit={handleSubmit(async (v) => { setErr(null); try { await api.post('/auth/forgot-password', v); setDone(true); } catch (e) { setErr(errorText(e)); } })} noValidate className="space-y-5">
          {err && <Alert tone="error">{err}</Alert>}
          <Input id="f-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Send reset link</Button>
        </form>)}
      <p className="mt-5 text-center text-sm"><Link className="text-brand-400 hover:underline" to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams(); const [done, setDone] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: pw })) });
  const token = params.get('token') ?? '';
  return (
    <Shell title="Choose a new password">
      {!token ? <Alert tone="error">This reset link is missing its token. Request a new link.</Alert> : done ? <Alert tone="success">Password updated. You can now <Link className="underline" to="/login">sign in</Link>.</Alert> : (
        <form onSubmit={handleSubmit(async (v) => { setErr(null); try { await api.post('/auth/reset-password', { token, password: v.password }); setDone(true); } catch (e) { setErr(errorText(e)); } })} noValidate className="space-y-5">
          {err && <Alert tone="error">{err}</Alert>}
          <Input id="rp-pw" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Update password</Button>
        </form>)}
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams(); const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'fail'>('idle'); const [msg, setMsg] = useState('');
  const token = params.get('token') ?? '';
  const run = async () => { setState('working'); try { await api.post('/auth/verify-email', { token }); await qc.invalidateQueries({ queryKey: ['me'] }); setState('ok'); } catch (e) { setMsg(errorText(e)); setState('fail'); } };
  return (
    <Shell title="Verify your email">
      {!token ? <Alert tone="error">This link is missing its token.</Alert> : state === 'ok' ? <Alert tone="success">Your email is verified. <Link className="underline" to="/dashboard">Go to dashboard</Link></Alert> : (
        <div className="space-y-4">{state === 'fail' && <Alert tone="error">{msg}</Alert>}<Button className="w-full" size="lg" onClick={run} loading={state === 'working'}>Confirm my email</Button></div>)}
    </Shell>
  );
}

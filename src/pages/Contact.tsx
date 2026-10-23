import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { api, errorText } from '@/lib/api';
import { Seo } from '@/components/Seo';
import { Alert, Button, Card, Input, Textarea } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSite } from '@/hooks/useSite';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(150),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(4000),
  website: z.string().optional(), // honeypot
});
type F = z.infer<typeof schema>;

export default function Contact() {
  const { user } = useAuth();
  const { data: site } = useSite();
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { email: user?.email ?? '', name: user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : '' } });
  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try { const r = await api.post<{ ticketNo: string }>('/contact', v); setDone(r.data.ticketNo); } catch (e) { setErr(errorText(e)); }
  });
  return (
    <div className="container py-12 sm:py-16">
      <Seo title="Contact" description="Contact iSoftStone support. Requests are stored and answered by our team." path="/contact" />
      <p className="eyebrow">Contact</p><h1 className="mt-3 text-4xl font-extrabold">Talk to support</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6 sm:p-8">
          {done ? (
            <div className="py-8 text-center" role="status"><CheckCircle2 className="mx-auto h-12 w-12 text-brand-400" aria-hidden /><h2 className="mt-4 text-2xl font-extrabold">Request received</h2>
              <p className="mt-2 text-slate-300">Your reference is <strong className="text-white">{done}</strong>. {site?.emailDelivery ? 'We will reply by email.' : 'Email delivery is not configured yet, so replies will appear in your dashboard if you are signed in.'}</p></div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Contact form">
              {err && <Alert tone="error">{err}</Alert>}
              <div className="grid gap-5 sm:grid-cols-2">
                <Input id="c-name" label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
                <Input id="c-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              </div>
              <Input id="c-subject" label="Subject" error={errors.subject?.message} {...register('subject')} />
              <Textarea id="c-message" label="How can we help?" rows={6} error={errors.message?.message} {...register('message')} />
              <div className="absolute -left-[9999px]" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" {...register('website')} /></label></div>
              <Button type="submit" size="lg" loading={isSubmitting}>Send message</Button>
            </form>
          )}
        </Card>
        <Card className="h-fit p-6">
          <h2 className="text-lg font-bold">Other ways to reach us</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Browse the <a className="text-brand-400 hover:underline" href="/faq">help center</a> for quick answers.</p>
          {site?.supportEmail && <p className="mt-3 text-sm text-slate-300">Email: <a className="text-brand-400 hover:underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>}
        </Card>
      </div>
    </div>
  );
}

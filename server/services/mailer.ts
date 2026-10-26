import { getEnv, isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface Mail { to: string; subject: string; text: string }

/**
 * Email abstraction.
 *  - EMAIL_PROVIDER=resend: delivers through the Resend HTTP API (needs RESEND_API_KEY and a verified sending domain).
 *  - EMAIL_PROVIDER=none: nothing is delivered. In development the message is logged so flows can be exercised;
 *    in production nothing sensitive (links/tokens) is ever logged.
 * Delivery failures never break the user flow; they are logged and reported as `delivered: false`.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === 'resend') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
      });
      if (!res.ok) { logger.error({ status: res.status, subject: mail.subject }, 'email provider rejected message'); return { delivered: false }; }
      return { delivered: true };
    } catch (err) { logger.error({ err, subject: mail.subject }, 'email delivery failed'); return { delivered: false }; }
  }
  if (!isProd() && env.NODE_ENV !== 'test') logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'DEV MAIL (not delivered)');
  else logger.warn({ subject: mail.subject }, 'Email not delivered: EMAIL_PROVIDER is not configured');
  return { delivered: false };
}

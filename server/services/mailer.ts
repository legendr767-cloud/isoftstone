import { getEnv, isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface Mail { to: string; subject: string; text: string }

/**
 * Email abstraction. With EMAIL_PROVIDER=none nothing is delivered.
 * In development the message (including verification / reset links) is logged so flows can be exercised.
 * In production nothing sensitive is logged — configure a real provider to deliver mail.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === 'none') {
    if (!isProd() && env.NODE_ENV !== 'test') logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'DEV MAIL (not delivered)');
    else logger.warn({ to: mail.to, subject: mail.subject }, 'Email not delivered: EMAIL_PROVIDER is not configured');
    return { delivered: false };
  }
  return { delivered: false };
}

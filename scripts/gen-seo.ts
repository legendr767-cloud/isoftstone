/** Writes public/robots.txt and public/sitemap.xml (run at build time). Private areas are excluded. */
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const host = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173');
const base = host.replace(/\/$/, '');

const urls: Array<{ loc: string; priority: string }> = [
  ['/', '1.0'], ['/challenges', '0.9'], ['/how-it-works', '0.7'], ['/calculator', '0.6'], ['/about', '0.5'], ['/faq', '0.6'], ['/contact', '0.4'],
  ...['terms', 'privacy', 'cookies', 'risk-disclosure', 'trading-rules', 'refund-policy'].map((s) => [`/legal/${s}`, '0.2'] as [string, string]),
].map(([p, priority]) => ({ loc: `${base}${p}`, priority }));

if (process.env.DATABASE_URL) {
  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const { rows } = await pool.query(`select slug from challenges where status = 'PUBLISHED' and (approved_at is not null or exists (select 1 from site_config where key = 'showDraftOffers' and value = 'true'::jsonb))`);
    for (const r of rows) urls.push({ loc: `${base}/challenges/${r.slug}`, priority: '0.8' });
    await pool.end();
  } catch (e) { console.warn('sitemap: could not read challenges, continuing without them:', (e as Error).message); }
}

writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('public/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /checkout\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /verify-email\n\nSitemap: ${base}/sitemap.xml\n`);
console.log(`✔ SEO files written for ${base} (${urls.length} urls)`);

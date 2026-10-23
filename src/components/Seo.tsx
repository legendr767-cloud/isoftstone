import { Helmet } from 'react-helmet-async';
import { brand } from '@/lib/brand';

export function Seo({ title, description = brand.description, path, noindex, jsonLd }: { title?: string; description?: string; path?: string; noindex?: boolean; jsonLd?: object }) {
  const full = title ? `${title} | ${brand.name}` : `${brand.name} — ${brand.tagline}`;
  const url = path !== undefined ? `${window.location.origin}${path}` : undefined;
  return (
    <Helmet>
      <title>{full}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={`${window.location.origin}/og-image.png`} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}

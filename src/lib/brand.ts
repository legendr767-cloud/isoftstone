/**
 * Central brand configuration. Update name, links and navigation here — not in individual components.
 * Contact details and integration status come from the API (/site) so they can change without a rebuild.
 */
export const brand = {
  name: 'iSoftStone',
  legalName: '[LEGAL ENTITY NAME]', // placeholder until supplied
  tagline: 'Forex proprietary trading evaluations',
  description: 'iSoftStone offers simulated forex trading evaluations with transparent rules. Compare challenges, review the rules and start when you are ready.',
  social: { x: '', instagram: '', youtube: '', telegram: '' } as Record<string, string>, // empty = hidden
  nav: [
    { to: '/challenges', label: 'Challenges' },
    { to: '/how-it-works', label: 'How it works' },
    { to: '/calculator', label: 'Calculator' },
    { to: '/about', label: 'About' },
    { to: '/faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact' },
  ],
  footer: {
    company: [{ to: '/about', label: 'About' }, { to: '/contact', label: 'Contact' }, { to: '/faq', label: 'Help center' }],
    legal: [
      { to: '/legal/terms', label: 'Terms and Conditions' }, { to: '/legal/privacy', label: 'Privacy Policy' },
      { to: '/legal/cookies', label: 'Cookie Policy' }, { to: '/legal/risk-disclosure', label: 'Risk Disclosure' },
      { to: '/legal/trading-rules', label: 'Trading Rules' }, { to: '/legal/refund-policy', label: 'Refund Policy' },
    ],
  },
  riskNotice: 'iSoftStone provides simulated trading evaluations, not live brokerage services. Forex trading involves a high level of risk. Hypothetical or simulated results are not indicative of future results.',
} as const;

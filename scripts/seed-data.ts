export const PERMISSIONS = [
  'admin:overview', 'challenges:manage', 'challenges:approve', 'customers:read', 'customers:manage',
  'orders:read', 'support:manage', 'rewards:review', 'accounts:manage', 'audit:read', 'site:manage', 'roles:manage',
] as const;

export const ROLES: Record<string, readonly string[]> = {
  customer: [],
  support: ['admin:overview', 'customers:read', 'orders:read', 'support:manage'],
  admin: PERMISSIONS,
};

// Approved forex universe (configurable by administrators; subject to iSoftStone's actual broker arrangements).
export const INSTRUMENTS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'EUR/AUD', 'GBP/CHF', 'CAD/JPY',
];

const DRAFT_NOTE = 'DRAFT TERMS: illustrative placeholder values pending iSoftStone approval.';

export const DEMO_CHALLENGES = [
  {
    slug: 'one-step-forex', name: 'One-Step Forex Evaluation', model: 'ONE_STEP' as const, sortOrder: 1,
    tagline: 'A single evaluation phase on approved forex pairs.',
    description: 'Complete one evaluation stage by reaching the profit target within the published risk limits. Simulated trading account; not a live brokerage account.',
    stages: [{ name: 'Evaluation', profitTargetPct: '10.00', minTradingDays: 4, maxDays: null as number | null }],
    rules: { dailyDrawdownPct: '4.00', maxDrawdownPct: '8.00', drawdownMethod: 'BALANCE_BASED' as const, leverage: '1:100', profitSplitPct: '80.00', newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50.00', notes: DRAFT_NOTE },
    sizes: [[5000, 59], [10000, 99], [25000, 199], [50000, 329], [100000, 549]],
  },
  {
    slug: 'two-step-forex', name: 'Two-Step Forex Evaluation', model: 'TWO_STEP' as const, sortOrder: 2,
    tagline: 'Two evaluation phases with lower per-phase targets.',
    description: 'Pass two consecutive stages with reduced profit targets while respecting the daily and overall drawdown limits. Simulated trading account; not a live brokerage account.',
    stages: [
      { name: 'Phase 1', profitTargetPct: '8.00', minTradingDays: 4, maxDays: null },
      { name: 'Phase 2', profitTargetPct: '5.00', minTradingDays: 4, maxDays: null },
    ],
    rules: { dailyDrawdownPct: '5.00', maxDrawdownPct: '10.00', drawdownMethod: 'BALANCE_BASED' as const, leverage: '1:100', profitSplitPct: '80.00', newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50.00', notes: DRAFT_NOTE },
    sizes: [[5000, 45], [10000, 79], [25000, 169], [50000, 289], [100000, 479]],
  },
  {
    slug: 'instant-forex', name: 'Instant Simulated Funding', model: 'INSTANT' as const, sortOrder: 3,
    tagline: 'Start on a simulated funded account without an evaluation phase.',
    description: 'Tighter risk limits apply from day one. Simulated trading account; availability depends on final iSoftStone approval.',
    stages: [],
    rules: { dailyDrawdownPct: '3.00', maxDrawdownPct: '6.00', drawdownMethod: 'EQUITY_BASED' as const, leverage: '1:50', profitSplitPct: '60.00', newsTradingAllowed: false, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50.00', notes: DRAFT_NOTE },
    sizes: [[5000, 149], [10000, 269], [25000, 599]],
  },
];

export const FAQ: Array<[string, string, string]> = [
  ['Getting started', 'How do I register?', 'Create an account with your email and a strong password, accept the Terms and Conditions, then verify your email address. Registration is free; you only pay when you purchase a challenge.'],
  ['Getting started', 'Is iSoftStone a broker?', 'No. iSoftStone provides simulated trading evaluations for forex traders. Evaluation and funded accounts are simulated and are not live brokerage accounts.'],
  ['Challenges', 'How do I choose a challenge?', 'Open the Challenges page, compare the available models by account size, price and rules, then select the one that fits your approach. Every rule is shown before you check out.'],
  ['Challenges', 'What account sizes and fees apply?', 'Account sizes and one-time fees are listed on each challenge page. They are loaded from the platform catalogue so the price you see is the price verified at checkout.'],
  ['Challenges', 'What are the profit targets?', 'Each challenge stage has its own profit target, shown as a percentage of the starting balance on the challenge page.'],
  ['Rules', 'How do daily and overall drawdown work?', 'The daily limit caps how much you may lose in a single trading day; the overall limit caps total drawdown from the starting balance. The calculation method (balance-based, equity-based or trailing) is stated on every challenge.'],
  ['Rules', 'Are there minimum trading days?', 'Where a stage requires a minimum number of trading days, it is listed in the challenge rules.'],
  ['Rules', 'Can I trade during news events?', 'This depends on the challenge. The news trading policy is shown on each challenge page and in the Trading Rules document.'],
  ['Rules', 'Can I hold positions over the weekend?', 'Weekend and overnight holding rules are set per challenge and shown in the rules summary.'],
  ['Rules', 'Are expert advisors (EAs) or copy trading allowed?', 'Policies on automated strategies and copy trading are set per challenge. Check the rules summary before purchasing.'],
  ['Markets & platform', 'Which instruments can I trade?', 'iSoftStone is forex-only. Approved instruments are major and selected cross currency pairs such as EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD and USD/CAD. We do not offer futures or any other asset class.'],
  ['Markets & platform', 'Which trading platform is used?', 'The trading platform and broker connectivity have not been announced on this site. Platform details will be published here once confirmed.'],
  ['Markets & platform', 'What are the trading hours?', 'Forex markets trade 24 hours a day from Monday to Friday. Any account-specific cut-off times will be listed in the Trading Rules.'],
  ['Evaluation & verification', 'What happens if I breach a rule?', 'If an account breaches the daily or overall drawdown limit, the evaluation is marked as failed. You can purchase a new challenge at any time.'],
  ['Evaluation & verification', 'What verification is required?', 'Before any reward request can be reviewed, identity verification must be approved. Verification status is visible in your dashboard.'],
  ['Rewards', 'How do rewards work?', 'Eligible simulated funded accounts can submit a reward request through the dashboard. Eligibility is checked on our servers against the published rules, and each request is reviewed by our team. A request status of "processed" is an internal workflow state.'],
  ['Payments', 'Which payment methods are accepted?', 'Supported payment methods will be listed here once our payment provider is connected. Until then, orders can be created but online payment may be unavailable.'],
  ['Payments', 'What is the refund and cancellation policy?', 'See the Refund and Cancellation Policy page. It is currently a draft awaiting review.'],
  ['Account & support', 'How do you protect my account?', 'Passwords are hashed with Argon2id, sessions use secure HTTP-only cookies, and sensitive actions are protected against CSRF. Never share your password with anyone.'],
  ['Account & support', 'How do I contact support?', 'Use the Contact page or open a ticket from your dashboard. Requests are stored and answered by our support team.'],
];

const DRAFT_BANNER = '> **DRAFT — not reviewed by legal counsel.** This document is an original draft for iSoftStone and must be reviewed and approved before it is relied upon. Items in [BRACKETS] are placeholders for facts that have not yet been supplied.\n\n';

export const LEGAL: Array<[string, string, string]> = [
  ['terms', 'Terms and Conditions', DRAFT_BANNER + '## 1. About these terms\nThese terms govern your use of the iSoftStone website and platform operated by [LEGAL ENTITY NAME], [REGISTERED ADDRESS] ("iSoftStone", "we").\n\n## 2. Simulated trading\niSoftStone provides forex trading evaluations on simulated accounts. We are not a broker and do not hold client funds for trading. Simulated results are not live trading results.\n\n## 3. Eligibility and accounts\nYou must be at least 18 years old and eligible to use the service under the laws of [JURISDICTION]. You are responsible for keeping your credentials secure.\n\n## 4. Challenges and fees\nChallenge fees, rules and conditions are published on each challenge page at the time of purchase. Fees are verified by our servers at checkout.\n\n## 5. Rewards\nReward eligibility is determined by the published rules and subject to verification and review. Nothing on this site guarantees a reward or earnings.\n\n## 6. Governing law\nThese terms are governed by the laws of [GOVERNING LAW].'],
  ['privacy', 'Privacy Policy', DRAFT_BANNER + '## What we collect\nAccount details (name, email, country), order and support records, and technical data needed to secure the service.\n\n## How we use it\nTo provide the service, process orders, prevent fraud and respond to support requests.\n\n## Retention\nData is retained for [RETENTION PERIOD] unless a longer period is required by law.\n\n## Processors\nPayment processing: [PAYMENT PROVIDER]. Email delivery: [EMAIL PROVIDER].\n\n## Your rights\nContact [PRIVACY CONTACT] to access, correct or delete your data.'],
  ['cookies', 'Cookie Policy', DRAFT_BANNER + '## Essential cookies\nWe use a secure, HTTP-only session cookie and a CSRF cookie so you can stay signed in and so that requests are protected. These are strictly necessary.\n\n## Analytics\n[No analytics cookies are currently configured.]'],
  ['risk-disclosure', 'Risk Disclosure', DRAFT_BANNER + '## Forex risk\nTrading foreign exchange carries a high level of risk and may not be suitable for everyone. Past or simulated performance is not indicative of future results.\n\n## Simulated accounts\nEvaluation and funded accounts offered by iSoftStone are simulated. Hypothetical results have inherent limitations and do not reflect real trading.'],
  ['trading-rules', 'Trading Rules', DRAFT_BANNER + '## Instruments\nForex currency pairs on the approved list only. No futures, indices, commodities, equities or cryptocurrencies.\n\n## Risk limits\nDaily and overall drawdown limits, calculation methods, minimum trading days and profit targets are set per challenge and shown on the challenge page.\n\n## Conduct\nProhibited behaviour, including account sharing or exploiting platform errors, will result in account termination. [FULL RULES TO BE CONFIRMED].'],
  ['refund-policy', 'Refund and Cancellation Policy', DRAFT_BANNER + '## Cancellation\n[CANCELLATION WINDOW TO BE CONFIRMED].\n\n## Refunds\n[REFUND CONDITIONS TO BE CONFIRMED]. Refunds, where applicable, are returned through the original payment method.'],
];

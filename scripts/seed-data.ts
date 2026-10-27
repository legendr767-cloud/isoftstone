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
  ['Payments', 'Which payment methods are accepted?', 'Payments are processed through Kora\'s secure hosted checkout. The methods you see there (for example cards or bank transfer) depend on your country and Kora\'s availability.'],
  ['Payments', 'What is the 100% profit split add-on?', 'An optional add-on purchased at checkout that raises your profit split on that account from the base split to 100%. It is shown, with its price, on the checkout page.'],
  ['Payments', 'What is the refund and cancellation policy?', 'See the Refund and Cancellation Policy page. It is currently a draft awaiting review.'],
  ['Account & support', 'How do you protect my account?', 'Passwords are hashed with Argon2id, sessions use secure HTTP-only cookies, and sensitive actions are protected against CSRF. Never share your password with anyone.'],
  ['Account & support', 'How do I contact support?', 'Use the Contact page or open a ticket from your dashboard. Requests are stored and answered by our support team.'],
];


const NOTE = 'Instruments and trading policies follow the published Trading Rules. Prices are one-time evaluation fees.';
type Rule = { dailyDrawdownPct: string; maxDrawdownPct: string; leverage: string; minDays: number };
const rules = (r: Rule, notes = NOTE) => ({ dailyDrawdownPct: r.dailyDrawdownPct, maxDrawdownPct: r.maxDrawdownPct, drawdownMethod: 'BALANCE_BASED' as const, leverage: r.leverage, profitSplitPct: '80.00',
  newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50.00', notes });
const stage = (name: string, t: string, d: number) => ({ name, profitTargetPct: t, minTradingDays: d, maxDays: null as number | null });

// Forex-only evaluation catalogue (instant funding is intentionally not offered). Prices are editable in Admin → Challenges.
export const CHALLENGES = [
  { slug: 'one-step-forex', name: 'One-Step Forex Evaluation', model: 'ONE_STEP' as const, sortOrder: 1, tagline: 'One phase, one target: 10% with a 6% overall drawdown limit.',
    description: 'A single evaluation phase. Reach a 10% profit target while respecting a 4% daily drawdown limit and a 6% static overall drawdown limit. No time limit. Simulated trading account; not a live brokerage account.',
    stages: [stage('Evaluation', '10.00', 3)], rules: rules({ dailyDrawdownPct: '4.00', maxDrawdownPct: '6.00', leverage: '1:30', minDays: 3 }),
    sizes: [[5000, 59], [10000, 99], [25000, 199], [50000, 349], [100000, 599], [200000, 1099]] },
  { slug: 'two-step-forex', name: 'Two-Step Forex Evaluation', model: 'TWO_STEP' as const, sortOrder: 2, tagline: 'Our flagship: 8% then 6%, with a 4% daily and 10% overall limit.',
    description: 'Two phases with a balanced target and generous overall drawdown: 8% in Phase 1 and 6% in Phase 2, a 4% daily drawdown limit and a 10% static overall limit. No time limit. Simulated trading account; not a live brokerage account.',
    stages: [stage('Phase 1', '8.00', 3), stage('Phase 2', '6.00', 3)], rules: rules({ dailyDrawdownPct: '4.00', maxDrawdownPct: '10.00', leverage: '1:100', minDays: 3 }),
    sizes: [[5000, 39], [10000, 69], [25000, 149], [50000, 259], [100000, 459], [200000, 899]] },
  { slug: 'two-step-standard', name: 'Two-Step Standard Evaluation', model: 'TWO_STEP' as const, sortOrder: 3, tagline: 'A higher first target in exchange for a looser 5% daily limit.',
    description: 'Two phases: 10% in Phase 1 and 5% in Phase 2, with a 5% daily drawdown limit and a 10% static overall limit. No time limit. Simulated trading account; not a live brokerage account.',
    stages: [stage('Phase 1', '10.00', 3), stage('Phase 2', '5.00', 3)], rules: rules({ dailyDrawdownPct: '5.00', maxDrawdownPct: '10.00', leverage: '1:100', minDays: 3 }),
    sizes: [[5000, 35], [10000, 59], [25000, 129], [50000, 229], [100000, 399], [200000, 799]] },
  { slug: 'two-step-pro', name: 'Two-Step Pro Evaluation', model: 'TWO_STEP' as const, sortOrder: 4, tagline: 'The tightest two-step: 8% then 4%, with an 8% overall limit.',
    description: 'Two phases with lower targets and tighter risk: 8% in Phase 1 and 4% in Phase 2, a 4% daily drawdown limit and an 8% static overall limit. No time limit. Simulated trading account; not a live brokerage account.',
    stages: [stage('Phase 1', '8.00', 3), stage('Phase 2', '4.00', 3)], rules: rules({ dailyDrawdownPct: '4.00', maxDrawdownPct: '8.00', leverage: '1:100', minDays: 3 }),
    sizes: [[5000, 45], [10000, 79], [25000, 169], [50000, 289], [100000, 499], [200000, 949]] },
  { slug: 'three-step-forex', name: 'Three-Step Forex Evaluation', model: 'THREE_STEP' as const, sortOrder: 5, tagline: 'Three small 6% steps with no minimum trading days.',
    description: 'Three phases of 6% each, a 4% daily drawdown limit and an 8% static overall limit. There is no minimum number of trading days. Simulated trading account; not a live brokerage account.',
    stages: [stage('Phase 1', '6.00', 0), stage('Phase 2', '6.00', 0), stage('Phase 3', '6.00', 0)], rules: rules({ dailyDrawdownPct: '4.00', maxDrawdownPct: '8.00', leverage: '1:30', minDays: 0 }),
    sizes: [[10000, 48], [25000, 105], [50000, 195], [100000, 320], [200000, 498]] },
  { slug: 'blitz-forex', name: 'Blitz One-Step Evaluation', model: 'ONE_STEP' as const, sortOrder: 6, tagline: 'A quick 3% target with a 3% daily and 5% overall limit.',
    description: 'A fast single phase: 3% profit target, a 3% daily drawdown limit and a 5% static overall limit, with a minimum of 5 trading days. Simulated trading account; not a live brokerage account.',
    stages: [stage('Evaluation', '3.00', 5)], rules: rules({ dailyDrawdownPct: '3.00', maxDrawdownPct: '5.00', leverage: '1:30', minDays: 5 }),
    sizes: [[2500, 32], [5000, 49], [10000, 85], [25000, 175], [50000, 295], [100000, 431]] },
];

export const ADDONS = [
  { code: 'profit-split-100', name: '100% profit split', description: 'Raises the profit split on this account from the base 80% to 100%.', priceType: 'PERCENT', priceValue: '15.00', approved: true },
];


const NOTICE = '> **Version 1 — prepared for iSoftStone, pending review by qualified legal counsel.** Items in [BRACKETS] are details iSoftStone must confirm before this document is relied upon.\n\n';

export const LEGAL: Array<[string, string, string]> = [
  ['terms', 'Terms and Conditions', NOTICE + `## 1. Who we are
These Terms and Conditions ("Terms") govern your use of the iSoftStone website, dashboard and services (the "Service"), operated by [LEGAL ENTITY NAME], [REGISTRATION NUMBER], of [REGISTERED ADDRESS] ("iSoftStone", "we", "us"). Contact: [SUPPORT EMAIL].

## 2. What the Service is — and is not
iSoftStone provides forex trading evaluations on simulated accounts. We are not a broker, bank or investment adviser. We do not hold client money for trading, execute client orders in live markets, or provide investment advice. Simulated accounts, balances and results are not real funds and are not live trading results.

## 3. Eligibility and your account
You must be at least 18 years old, have legal capacity, and not be resident in or subject to a jurisdiction where the Service is prohibited. You agree to give accurate information, keep your credentials confidential, hold only one account, and tell us promptly of any unauthorised use. We may suspend or close accounts that breach these Terms.

## 4. Challenges, fees and payment
Each challenge has published rules (profit targets, drawdown limits, minimum trading days, leverage and trading policies) shown before purchase. The fee is a one-time charge for access to the evaluation and any selected add-ons. Prices are shown in the currency at checkout and are verified on our servers. Payments are processed by our payment provider, Kora; we do not store card details. An order is confirmed only when the provider confirms payment to us.

## 5. Evaluation, funded simulated accounts and rewards
You pass an evaluation phase by meeting its profit target within its risk limits and any minimum trading days. A breach of the daily or overall drawdown limit ends the evaluation. After all phases and verification, you may be given a simulated funded account. Reward requests are reviewed against the published rules; the profit split applies to eligible simulated profit. We do not promise or guarantee any reward, payout or earnings, and approval is at our reasonable discretion subject to these Terms. [PAYOUT SCHEDULE AND METHODS TO BE CONFIRMED]

## 6. Prohibited conduct
You must not: share or sell accounts; use another person's identity; exploit pricing errors, latency or platform faults; use prohibited strategies listed in the Trading Rules; copy trades between accounts in a way that is not permitted; manipulate results; or interfere with the Service or other users. We may void results, close accounts and withhold rewards where we reasonably find a breach.

## 7. Verification
Before any reward is reviewed we may require identity verification and information about the source of your funds, and we may refuse or delay rewards where verification is incomplete or fails.

## 8. Intellectual property
The Service, its content and branding belong to iSoftStone or its licensors. We grant you a limited, revocable, non-transferable right to use the Service for its intended purpose.

## 9. Availability and changes
We aim for reliable service but do not guarantee uninterrupted availability. We may update the Service and these Terms; material changes will be notified and the date of the current version is recorded in your acceptance history.

## 10. Liability
Nothing excludes liability that cannot be excluded by law. Subject to that, we are not liable for indirect or consequential loss, loss of profit, or losses from market conditions, third-party outages or events beyond our reasonable control, and our total liability for a claim is limited to the fees you paid for the relevant challenge. [LIABILITY WORDING TO BE CONFIRMED BY COUNSEL]

## 11. Governing law and disputes
These Terms are governed by the laws of [GOVERNING LAW]. Disputes are subject to [JURISDICTION / ARBITRATION]. Please contact support first so we can try to resolve any complaint.`],
  ['privacy', 'Privacy Policy', NOTICE + `## 1. Controller
[LEGAL ENTITY NAME] ("iSoftStone") is the controller of personal data processed through the Service. Privacy contact: [PRIVACY EMAIL].

## 2. Data we collect
Account data (name, email, country, optional phone); order and payment-status records (we never receive or store full card numbers); verification status; support messages; security data (hashed password, session records, IP address and browser information, login attempts); and records of the terms you accepted.

## 3. Why we use it
To provide and secure the Service (contract); to process payments and prevent fraud (contract and legitimate interests); to meet legal and regulatory obligations; to respond to support requests; and to improve and protect the platform (legitimate interests). We do not sell personal data.

## 4. Who receives it
Service providers acting on our instructions, including hosting and database ([HOSTING PROVIDERS]), payment processing (Kora), and email delivery ([EMAIL PROVIDER]). We may disclose data where required by law or to protect rights and safety.

## 5. International transfers
Providers may process data outside your country. Where required we rely on appropriate safeguards such as standard contractual clauses. [TRANSFER MECHANISM TO BE CONFIRMED]

## 6. Retention
We keep data only as long as needed for the purposes above and legal obligations: account and order records for [RETENTION PERIOD]; support records for [RETENTION PERIOD]; security logs for [RETENTION PERIOD].

## 7. Security
Passwords are hashed with Argon2id; sessions use secure HTTP-only cookies; access is permission-controlled and administrative actions are audit-logged. No system is perfectly secure, and you should use a strong unique password.

## 8. Your rights
Depending on where you live you may have rights to access, correct, delete, restrict or object to processing, and to data portability, and to complain to your data-protection authority. Contact [PRIVACY EMAIL]; we will respond within the period required by law.

## 9. Children
The Service is not intended for anyone under 18.

## 10. Changes
We will update this policy as the Service changes and show the effective date here.`],
  ['cookies', 'Cookie Policy', NOTICE + `## What we use
iSoftStone uses only strictly necessary cookies:

- A secure, HTTP-only **session cookie** that keeps you signed in.
- A **CSRF cookie** that protects your account from forged requests.

These are required for the Service to work and are not used for advertising or tracking. We do not currently use analytics or advertising cookies; if that changes this policy will be updated and consent requested where required.

## Managing cookies
You can clear cookies in your browser at any time; doing so will sign you out. Blocking strictly necessary cookies will prevent sign-in.`],
  ['risk-disclosure', 'Risk Disclosure', NOTICE + `## General risk warning
Trading foreign exchange involves a high level of risk and is not suitable for everyone. Prices can move rapidly against you, leverage magnifies both gains and losses, and you can lose more than you intend in real markets. Only trade with money you can afford to lose and seek independent advice if you are unsure.

## Simulated accounts
All iSoftStone evaluation and funded accounts are **simulated**. Simulated performance has inherent limitations: it is created with the benefit of hindsight, does not involve real financial risk, and cannot account for the effect of market liquidity, slippage or emotion on real trading. Results on a simulated account are not indicative of future results, in simulation or in live markets.

## No advice or guarantees
Nothing on the Service is investment advice or a recommendation. Hypothetical calculators and illustrations are examples only and are not predictions or promises of earnings. Reference price charts are daily reference rates published for information and are not tradable quotes.

## Your responsibility
You are solely responsible for your trading decisions and for understanding the published challenge rules before you purchase.`],
  ['trading-rules', 'Trading Rules', NOTICE + `## 1. Instruments
Evaluation accounts trade the approved list of forex currency pairs shown on each challenge. Futures, indices, commodities, equities and cryptocurrencies are not offered.

## 2. Profit targets and phases
Each challenge states its number of phases and the profit target for each, as a percentage of the starting balance. A phase is passed when the target is reached, the minimum trading days (if any) are completed and no rule has been breached. There is no time limit unless a challenge states one.

## 3. Daily drawdown
The daily drawdown limit caps the loss permitted within a single trading day, measured as stated on the challenge (balance-based unless otherwise shown). The daily reset time is [DAILY RESET TIME AND TIMEZONE]. Breaching the limit ends the evaluation.

## 4. Overall drawdown
The overall (maximum) drawdown limit is a static percentage of the starting balance. If equity falls to or below that floor the evaluation ends.

## 5. Minimum trading days
Where a challenge specifies minimum trading days, a day counts when at least one trade is opened or closed. [DEFINITION OF A TRADING DAY TO BE CONFIRMED]

## 6. Leverage
Maximum leverage is stated per challenge (for example 1:30 or 1:100).

## 7. Trading policies
News trading, weekend holding, overnight holding, expert advisors (EAs) and copy trading are set per challenge and displayed on its page. Where a policy is shown as not allowed, using it is a breach.

## 8. Prohibited practices
Account sharing or reselling; trading on behalf of another person without permission; exploiting latency, errors or off-market quotes; hedging between accounts to circumvent risk limits; and any manipulation of results. Breaches may lead to voiding of results, closure of accounts and withholding of rewards.

## 9. Funded simulated accounts and rewards
After all phases and identity verification, an account may be promoted to a funded simulated phase. Eligible reward requests are calculated on simulated profit using the profit split of the account (80%, or 100% with the add-on) and are reviewed by iSoftStone. [PAYOUT SCHEDULE, MINIMUM AMOUNT AND METHODS TO BE CONFIRMED]

## 10. Changes
Rules that apply to an account are those published when it was purchased.`],
  ['refund-policy', 'Refund and Cancellation Policy', NOTICE + `## 1. Nature of the fee
Challenge fees are charged for access to a simulated evaluation and, once an account record has been provisioned and made available to you, the service has been provided.

## 2. Before provisioning
If you cancel before your account has been provisioned, you may request a full refund by contacting support within [CANCELLATION WINDOW]. Approved refunds are returned to the original payment method; timing depends on the payment provider.

## 3. After provisioning
Fees are non-refundable once an account has been provisioned and made available, except where required by applicable law or where the Service failed to deliver as described. [CONFIRM]

## 4. Failed payments and duplicates
If you are charged more than once for the same order or a payment is taken but your order is not confirmed, contact support with your order number; confirmed duplicates are refunded in full.

## 5. Add-ons
Add-ons are part of the order and follow the same rules as the challenge they were bought with.

## 6. Chargebacks
Please contact us before filing a chargeback so we can resolve the problem. Accounts subject to an unresolved chargeback may be suspended.

## 7. Contact
Email [SUPPORT EMAIL] with your order number to request a refund or cancellation.`],
];

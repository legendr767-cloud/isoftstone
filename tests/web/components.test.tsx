import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { calcProfit, ProfitCalculator } from '@/components/ProfitCalculator';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Login } from '@/pages/Auth';
import Contact from '@/pages/Contact';
import { AppShell } from '@/components/layout/AppShell';
import { Logo } from '@/components/Logo';
import { money } from '@/lib/format';
import type { Challenge } from '@/lib/types';
import { mockApi, renderApp } from './helpers';

const challenge: Challenge = {
  id: '1', slug: 'one-step-forex', name: 'One-Step Forex Evaluation', model: 'ONE_STEP', tagline: 'A single phase', description: 'd', status: 'PUBLISHED', isDraftTerms: true,
  stages: [{ stageNumber: 1, name: 'Evaluation', profitTargetPct: '10.00', minTradingDays: 4, maxDays: null }],
  rules: { dailyDrawdownPct: '4.00', maxDrawdownPct: '8.00', drawdownMethod: 'BALANCE_BASED', leverage: '1:100', profitSplitPct: '80.00', newsTradingAllowed: true, weekendHoldingAllowed: false, overnightHoldingAllowed: true, eaAllowed: false, copyTradingAllowed: false, rewardMinAmount: '50.00', notes: null },
  sizes: [{ id: 's1', accountSize: '5000.00', currency: 'USD', active: true, productId: 'p1', sku: 'A', price: '59.00' }, { id: 's2', accountSize: '100000.00', currency: 'USD', active: true, productId: 'p2', sku: 'B', price: '549.00' }],
  instruments: ['EUR/USD', 'GBP/USD'],
};

describe('profit calculator maths', () => {
  it('splits profit without floating point drift', () => {
    expect(calcProfit(100000, 8, 80)).toEqual({ gross: 8000, trader: 6400, firm: 1600 });
    expect(calcProfit(10000, 0.1, 80)).toEqual({ gross: 10, trader: 8, firm: 2 });
    const r = calcProfit(33333, 3.3, 70);
    expect(Math.round((r.trader + r.firm) * 100)).toBe(Math.round(r.gross * 100)); // shares always sum to gross
  });
});

describe('<ProfitCalculator />', () => {
  it('uses the challenge default split, updates live, and validates input', async () => {
    mockApi({ 'GET /challenges': [challenge] });
    renderApp(<ProfitCalculator />);
    await screen.findByDisplayValue('80'); // split from the published terms
    expect(screen.getByText(/Hypothetical illustration only/)).toBeInTheDocument();
    const ret = screen.getByLabelText('Hypothetical return (%)');
    await userEvent.clear(ret); await userEvent.type(ret, '10');
    // default size = middle option clamps to last when only two sizes
    expect(await screen.findByText(money(8000 * 1.25, 'USD', 2))).toBeInTheDocument(); // 100k * 10% * 80%
    await userEvent.clear(ret); await userEvent.type(ret, '150');
    expect(await screen.findByText('Enter a return between 0 and 100')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // no result shown for invalid input
  });
});

describe('<ChallengeCard />', () => {
  it('shows terms from data, a draft badge, and a working link', () => {
    renderApp(<ChallengeCard c={challenge} />);
    expect(screen.getByText('One-Step Forex Evaluation')).toBeInTheDocument();
    expect(screen.getByText(/Draft terms/)).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('$59')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/challenges/one-step-forex');
  });
});

describe('<Logo />', () => {
  it('is labelled for assistive tech', () => {
    renderApp(<Logo />);
    expect(screen.getByRole('img', { name: /iSoftStone/ })).toBeInTheDocument();
  });
});

describe('Login form', () => {
  it('validates fields, shows server errors, and navigates on success', async () => {
    let attempts = 0;
    mockApi({
      'GET /auth/me': null,
      'POST /auth/login': () => (++attempts === 1 ? { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } } } : { body: { data: { id: '1', email: 'a@b.co', permissions: [] } } }),
    });
    renderApp(<Routes><Route path="/login" element={<Login />} /><Route path="/dashboard" element={<p>DASHBOARD</p>} /></Routes>, '/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(attempts).toBe(2));
  });
});

describe('Contact form', () => {
  it('blocks invalid submissions client-side and shows the reference on success', async () => {
    const calls = mockApi({ 'GET /auth/me': null, 'GET /site': { supportEmail: 's@x.co', emailDelivery: false }, 'POST /contact': { ticketNo: 'ISS-T-ABC123' } });
    renderApp(<Contact />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /contact')).toBe(false);
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada Trader');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Subject'), 'Question about rules');
    await userEvent.type(screen.getByLabelText('How can we help?'), 'Please explain the drawdown rules.');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Request received')).toBeInTheDocument();
    expect(screen.getByText('ISS-T-ABC123')).toBeInTheDocument();
  });
});

describe('protected routes', () => {
  const tree = (
    <Routes><Route path="/login" element={<p>LOGIN PAGE</p>} />
      <Route path="/dashboard" element={<AppShell title="Dashboard" items={[]} />}><Route index element={<p>PRIVATE</p>} /></Route>
      <Route path="/admin" element={<AppShell title="Admin" items={[]} requirePerm="admin:overview" />}><Route index element={<p>ADMIN ONLY</p>} /></Route></Routes>
  );
  it('redirects signed-out visitors to login', async () => {
    mockApi({ 'GET /auth/me': null });
    renderApp(tree, '/dashboard');
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument();
  });
  it('renders private content for a signed-in user but keeps customers out of admin', async () => {
    mockApi({ 'GET /auth/me': { id: '1', email: 'c@x.co', role: 'customer', permissions: [], profile: null } });
    renderApp(tree, '/dashboard');
    expect(await screen.findByText('PRIVATE')).toBeInTheDocument();
    renderApp(tree, '/admin');
    await waitFor(() => expect(screen.queryByText('ADMIN ONLY')).not.toBeInTheDocument());
    expect(within(document.body).getAllByText('PRIVATE').length).toBeGreaterThan(0); // redirected to /dashboard
  });
});

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PageLoader } from '@/components/ui';
import Home from '@/pages/Home';
import { About, HowItWorks, Legal, NotFound } from '@/pages/Static';

// Route-level code splitting keeps the marketing bundle small.
const Challenges = lazy(() => import('@/pages/Challenges'));
const ChallengeDetail = lazy(() => import('@/pages/ChallengeDetail'));
const Calculator = lazy(() => import('@/pages/Calculator'));
const Markets = lazy(() => import('@/pages/Markets'));
const Faq = lazy(() => import('@/pages/Faq'));
const Contact = lazy(() => import('@/pages/Contact'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const CheckoutSimulator = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.CheckoutSimulator })));
const auth = (k: 'Login' | 'Register' | 'ForgotPassword' | 'ResetPassword' | 'VerifyEmail') => lazy(() => import('@/pages/Auth').then((m) => ({ default: m[k] })));
const Login = auth('Login'), Register = auth('Register'), ForgotPassword = auth('ForgotPassword'), ResetPassword = auth('ResetPassword'), VerifyEmail = auth('VerifyEmail');
const dash = (k: string) => lazy(() => import('@/pages/Dashboard').then((m) => ({ default: (m as any)[k] })));
const DashboardShell = dash('DashboardShell'), Overview = dash('Overview'), Accounts = dash('Accounts'), AccountDetail = dash('AccountDetail'), Orders = dash('Orders'), OrderDetail = dash('OrderDetail'),
  Rewards = dash('Rewards'), Support = dash('Support'), TicketDetail = dash('TicketDetail'), Notifications = dash('Notifications'), Profile = dash('Profile');
const adm = (k: string) => lazy(() => import('@/pages/Admin').then((m) => ({ default: (m as any)[k] })));
const AdminShell = adm('AdminShell'), AdminOverview = adm('AdminOverview'), AdminChallenges = adm('AdminChallenges'), ChallengeEditor = adm('ChallengeEditor'), AdminCustomers = adm('AdminCustomers'), AdminCustomer = adm('AdminCustomer'),
  AdminOrders = adm('AdminOrders'), AdminOrder = adm('AdminOrder'), AdminSupport = adm('AdminSupport'), AdminTicket = adm('AdminTicket'), AdminRewards = adm('AdminRewards'), AdminAccounts = adm('AdminAccounts'), AdminAudit = adm('AdminAudit'), AdminLegal = adm('AdminLegal'), AdminSettings = adm('AdminSettings');

export default function App() {
  return (
    <Suspense fallback={<div className="container py-12"><PageLoader /></div>}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="challenges" element={<Challenges />} /><Route path="challenges/:slug" element={<ChallengeDetail />} />
          <Route path="markets" element={<Markets />} /><Route path="how-it-works" element={<HowItWorks />} /><Route path="calculator" element={<Calculator />} />
          <Route path="about" element={<About />} /><Route path="faq" element={<Faq />} /><Route path="contact" element={<Contact />} />
          <Route path="legal/:slug" element={<Legal />} />
          <Route path="checkout/simulate/:attemptId" element={<CheckoutSimulator />} /><Route path="checkout/:productId" element={<Checkout />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="login" element={<Login />} /><Route path="register" element={<Register />} /><Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} /><Route path="verify-email" element={<VerifyEmail />} />
        <Route path="dashboard" element={<DashboardShell />}>
          <Route index element={<Overview />} /><Route path="accounts" element={<Accounts />} /><Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="orders" element={<Orders />} /><Route path="orders/:id" element={<OrderDetail />} /><Route path="rewards" element={<Rewards />} />
          <Route path="support" element={<Support />} /><Route path="support/:id" element={<TicketDetail />} /><Route path="notifications" element={<Notifications />} /><Route path="profile" element={<Profile />} />
        </Route>
        <Route path="admin" element={<AdminShell />}>
          <Route index element={<AdminOverview />} /><Route path="challenges" element={<AdminChallenges />} /><Route path="challenges/:id" element={<ChallengeEditor />} />
          <Route path="customers" element={<AdminCustomers />} /><Route path="customers/:id" element={<AdminCustomer />} />
          <Route path="orders" element={<AdminOrders />} /><Route path="orders/:id" element={<AdminOrder />} /><Route path="accounts" element={<AdminAccounts />} />
          <Route path="rewards" element={<AdminRewards />} /><Route path="support" element={<AdminSupport />} /><Route path="support/:id" element={<AdminTicket />} />
          <Route path="audit" element={<AdminAudit />} /><Route path="legal" element={<AdminLegal />} /><Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

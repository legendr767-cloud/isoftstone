/**
 * iSoftStone database schema (PostgreSQL via Drizzle ORM).
 * - Money is stored as NUMERIC and handled as strings / integer cents in code. Never floats.
 * - Forex is the only asset class: enforced by a single-value enum AND a CHECK on instrument symbols.
 */
import { sql, relations } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, varchar, boolean, integer, numeric, timestamp, jsonb,
  index, uniqueIndex, primaryKey, check,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string, p = 14) => numeric(name, { precision: p, scale: 2 });
const pct = (name: string) => numeric(name, { precision: 5, scale: 2 });

// ───────── Enums ─────────
export const assetClass = pgEnum('asset_class', ['FOREX']);
export const challengeModel = pgEnum('challenge_model', ['ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT']);
export const publishStatus = pgEnum('publish_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const drawdownMethod = pgEnum('drawdown_method', ['BALANCE_BASED', 'EQUITY_BASED', 'TRAILING']);
export const userStatus = pgEnum('user_status', ['ACTIVE', 'SUSPENDED', 'CLOSED']);
export const orderStatus = pgEnum('order_status', ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED']);
export const paymentStatus = pgEnum('payment_status', ['INITIATED', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
export const accountStatus = pgEnum('account_status', ['PENDING_PROVISIONING', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'CLOSED']);
export const accountPhase = pgEnum('account_phase', ['PHASE_1', 'PHASE_2', 'PHASE_3', 'VERIFICATION', 'FUNDED_SIM']);
export const metricSource = pgEnum('metric_source', ['PROVIDER', 'DEMO_FIXTURE']);
export const rewardStatus = pgEnum('reward_status', ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED']);
export const ticketStatus = pgEnum('ticket_status', ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']);
export const legalStatus = pgEnum('legal_status', ['DRAFT', 'PUBLISHED']);
export const verificationStatus = pgEnum('verification_status', ['NOT_STARTED', 'SUBMITTED', 'APPROVED', 'REJECTED']);

// ───────── Identity & access ─────────
export const roles = pgTable('roles', {
  id: id(), name: text('name').notNull().unique(), description: text('description'),
});
export const permissions = pgTable('permissions', {
  id: id(), key: text('key').notNull().unique(),
});
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  status: userStatus('status').notNull().default('ACTIVE'),
  emailVerifiedAt: ts('email_verified_at'),
  verificationStatus: verificationStatus('verification_status').notNull().default('NOT_STARTED'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: ts('locked_until'),
  lastLoginAt: ts('last_login_at'),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('users_created_idx').on(t.createdAt), index('users_status_idx').on(t.status),
  check('users_email_lower', sql`${t.email} = lower(${t.email})`)]);

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(), lastName: text('last_name').notNull(),
  country: varchar('country', { length: 2 }), phone: text('phone'), updatedAt: updatedAt(),
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'), ip: text('ip'),
  createdAt: createdAt(), lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: ts('expires_at').notNull(), revokedAt: ts('revoked_at'),
}, (t) => [index('sessions_user_idx').on(t.userId), index('sessions_exp_idx').on(t.expiresAt)]);

const tokenTable = (name: string) => pgTable(name, {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(), consumedAt: ts('consumed_at'), createdAt: createdAt(),
}, (t) => [index(`${name}_user_idx`).on(t.userId)]);
export const emailVerificationTokens = tokenTable('email_verification_tokens');
export const passwordResetTokens = tokenTable('password_reset_tokens');

// MFA architecture only — nothing enforces a factor until an enrolment flow ships.
export const mfaFactors = pgTable('mfa_factors', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('TOTP'),
  secretEncrypted: text('secret_encrypted').notNull(),
  enabledAt: ts('enabled_at'), createdAt: createdAt(),
}, (t) => [index('mfa_user_idx').on(t.userId)]);

// ───────── Catalogue (forex only) ─────────
export const instruments = pgTable('instruments', {
  id: id(),
  symbol: text('symbol').notNull().unique(),
  baseCcy: varchar('base_ccy', { length: 3 }).notNull(),
  quoteCcy: varchar('quote_ccy', { length: 3 }).notNull(),
  assetClass: assetClass('asset_class').notNull().default('FOREX'),
  active: boolean('active').notNull().default(true),
}, (t) => [
  check('instruments_forex_symbol', sql`${t.symbol} ~ '^[A-Z]{3}/[A-Z]{3}$'`),
  check('instruments_pair_consistent', sql`${t.symbol} = ${t.baseCcy} || '/' || ${t.quoteCcy} AND ${t.baseCcy} <> ${t.quoteCcy}`),
]);

export const challenges = pgTable('challenges', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  model: challengeModel('model').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  status: publishStatus('status').notNull().default('DRAFT'),
  /** true while commercial terms are placeholders awaiting iSoftStone approval */
  isDraftTerms: boolean('is_draft_terms').notNull().default(true),
  approvedAt: ts('approved_at'),
  approvedById: uuid('approved_by_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('challenges_status_idx').on(t.status, t.sortOrder)]);

export const challengeStages = pgTable('challenge_stages', {
  id: id(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  stageNumber: integer('stage_number').notNull(),
  name: text('name').notNull(),
  profitTargetPct: pct('profit_target_pct').notNull(),
  minTradingDays: integer('min_trading_days').notNull().default(0),
  maxDays: integer('max_days'),
}, (t) => [uniqueIndex('stages_challenge_no_uq').on(t.challengeId, t.stageNumber),
  check('stages_target_range', sql`${t.profitTargetPct} > 0 AND ${t.profitTargetPct} <= 100`)]);

export const challengeRules = pgTable('challenge_rules', {
  challengeId: uuid('challenge_id').primaryKey().references(() => challenges.id, { onDelete: 'cascade' }),
  dailyDrawdownPct: pct('daily_drawdown_pct').notNull(),
  maxDrawdownPct: pct('max_drawdown_pct').notNull(),
  drawdownMethod: drawdownMethod('drawdown_method').notNull().default('BALANCE_BASED'),
  leverage: text('leverage').notNull(),
  profitSplitPct: pct('profit_split_pct').notNull(),
  newsTradingAllowed: boolean('news_trading_allowed').notNull().default(true),
  weekendHoldingAllowed: boolean('weekend_holding_allowed').notNull().default(false),
  overnightHoldingAllowed: boolean('overnight_holding_allowed').notNull().default(true),
  eaAllowed: boolean('ea_allowed').notNull().default(false),
  copyTradingAllowed: boolean('copy_trading_allowed').notNull().default(false),
  rewardMinAmount: money('reward_min_amount').notNull().default('50'),
  notes: text('notes'),
}, (t) => [
  check('rules_dd_range', sql`${t.dailyDrawdownPct} > 0 AND ${t.dailyDrawdownPct} <= ${t.maxDrawdownPct} AND ${t.maxDrawdownPct} <= 100`),
  check('rules_split_range', sql`${t.profitSplitPct} > 0 AND ${t.profitSplitPct} <= 100`),
]);

export const accountSizeOptions = pgTable('account_size_options', {
  id: id(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  accountSize: money('account_size').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (t) => [uniqueIndex('sizes_challenge_size_uq').on(t.challengeId, t.accountSize), check('sizes_positive', sql`${t.accountSize} > 0`)]);

export const products = pgTable('products', {
  id: id(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  sizeOptionId: uuid('size_option_id').notNull().unique().references(() => accountSizeOptions.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull().unique(),
  priceAmount: money('price_amount', 12).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  active: boolean('active').notNull().default(true),
}, (t) => [index('products_challenge_idx').on(t.challengeId), check('products_price_positive', sql`${t.priceAmount} > 0`)]);

export const productAddons = pgTable('product_addons', {
  id: id(), code: text('code').notNull().unique(), name: text('name').notNull(), description: text('description').notNull(),
  priceType: text('price_type').notNull().default('PERCENT'), priceValue: numeric('price_value', { precision: 10, scale: 2 }).notNull(),
  approved: boolean('approved').notNull().default(false), active: boolean('active').notNull().default(true),
}, (t) => [check('addons_type', sql`${t.priceType} IN ('PERCENT','FLAT')`)]);

export const challengeInstruments = pgTable('challenge_instruments', {
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.challengeId, t.instrumentId] })]);

// ───────── Orders & payments ─────────
export const orders = pgTable('orders', {
  id: id(), orderNumber: text('order_number').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: orderStatus('status').notNull().default('PENDING'),
  subtotal: money('subtotal', 12).notNull(), total: money('total', 12).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  termsVersionId: uuid('terms_version_id'),
  paidAt: ts('paid_at'), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('orders_user_idx').on(t.userId, t.createdAt), index('orders_status_idx').on(t.status)]);

export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  description: text('description').notNull(),
  unitPrice: money('unit_price', 12).notNull(), quantity: integer('quantity').notNull().default(1),
  addons: jsonb('addons').notNull().default([]),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

export const orderEvents = pgTable('order_events', {
  id: id(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), detail: text('detail'), createdAt: createdAt(),
}, (t) => [index('order_events_idx').on(t.orderId, t.createdAt)]);

export const paymentAttempts = pgTable('payment_attempts', {
  id: id(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), providerRef: text('provider_ref'),
  status: paymentStatus('status').notNull().default('INITIATED'),
  amount: money('amount', 12).notNull(), currency: varchar('currency', { length: 3 }).notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('attempts_order_idx').on(t.orderId), uniqueIndex('attempts_provider_ref_uq').on(t.provider, t.providerRef)]);

export const paymentWebhookEvents = pgTable('payment_webhook_events', {
  id: id(), provider: text('provider').notNull(), eventId: text('event_id').notNull(), type: text('type').notNull(),
  payload: jsonb('payload').notNull(), signatureValid: boolean('signature_valid').notNull(),
  processedAt: ts('processed_at'), error: text('error'),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('webhook_provider_event_uq').on(t.provider, t.eventId)]);

// ───────── Trading accounts ─────────
export const tradingAccounts = pgTable('trading_accounts', {
  id: id(), accountRef: text('account_ref').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  orderItemId: uuid('order_item_id').notNull().unique().references(() => orderItems.id),
  status: accountStatus('status').notNull().default('PENDING_PROVISIONING'),
  phase: accountPhase('phase').notNull().default('PHASE_1'),
  startingBalance: money('starting_balance').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  /** set only by a real provisioning integration */
  providerAccountId: text('provider_account_id'),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('accounts_user_idx').on(t.userId)]);

export const accountPhaseHistory = pgTable('account_phase_history', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => tradingAccounts.id, { onDelete: 'cascade' }),
  phase: accountPhase('phase').notNull(), status: accountStatus('status').notNull(), note: text('note'), createdAt: createdAt(),
}, (t) => [index('phase_hist_idx').on(t.accountId, t.createdAt)]);

export const accountMetricSnapshots = pgTable('account_metric_snapshots', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => tradingAccounts.id, { onDelete: 'cascade' }),
  balance: money('balance').notNull(), equity: money('equity').notNull(),
  dailyLoss: money('daily_loss').notNull().default('0'),
  tradingDays: integer('trading_days').notNull().default(0),
  source: metricSource('source').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('metrics_idx').on(t.accountId, t.capturedAt)]);

export const tradeRecords = pgTable('trade_records', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => tradingAccounts.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(), side: text('side').notNull(),
  volume: numeric('volume', { precision: 10, scale: 2 }).notNull(),
  openPrice: numeric('open_price', { precision: 14, scale: 5 }).notNull(),
  closePrice: numeric('close_price', { precision: 14, scale: 5 }),
  profit: money('profit'), openedAt: ts('opened_at').notNull(), closedAt: ts('closed_at'),
  source: metricSource('source').notNull(),
}, (t) => [index('trades_idx').on(t.accountId, t.openedAt), check('trades_forex', sql`${t.symbol} ~ '^[A-Z]{3}/[A-Z]{3}$'`)]);

export const rewardRequests = pgTable('reward_requests', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => tradingAccounts.id),
  amount: money('amount').notNull(),
  status: rewardStatus('status').notNull().default('PENDING'),
  reviewerNote: text('reviewer_note'), reviewedById: uuid('reviewed_by_id'), reviewedAt: ts('reviewed_at'),
  /** set only when a real payout integration confirms an external transfer */
  transferRef: text('transfer_ref'),
  createdAt: createdAt(),
}, (t) => [index('rewards_user_idx').on(t.userId), index('rewards_status_idx').on(t.status), check('rewards_positive', sql`${t.amount} > 0`)]);

// ───────── Support, notifications, content ─────────
export const supportTickets = pgTable('support_tickets', {
  id: id(), ticketNo: text('ticket_no').notNull().unique(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(), email: text('email').notNull(), subject: text('subject').notNull(),
  status: ticketStatus('status').notNull().default('OPEN'),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('tickets_user_idx').on(t.userId), index('tickets_status_idx').on(t.status, t.createdAt)]);

export const supportMessages = pgTable('support_messages', {
  id: id(),
  ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id),
  body: text('body').notNull(), isStaff: boolean('is_staff').notNull().default(false),
  /** internal notes are never returned to customers */
  isInternal: boolean('is_internal').notNull().default(false), createdAt: createdAt(),
}, (t) => [index('messages_ticket_idx').on(t.ticketId, t.createdAt)]);

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), body: text('body').notNull(), readAt: ts('read_at'), createdAt: createdAt(),
}, (t) => [index('notifications_idx').on(t.userId, t.createdAt)]);

export const faqItems = pgTable('faq_items', {
  id: id(), category: text('category').notNull(), question: text('question').notNull(), answer: text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0), published: boolean('published').notNull().default(true),
}, (t) => [index('faq_idx').on(t.category, t.sortOrder)]);

export const legalDocuments = pgTable('legal_documents', {
  id: id(), slug: text('slug').notNull().unique(), title: text('title').notNull(),
});
export const legalVersions = pgTable('legal_versions', {
  id: id(),
  documentId: uuid('document_id').notNull().references(() => legalDocuments.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(), body: text('body').notNull(),
  status: legalStatus('status').notNull().default('DRAFT'), createdAt: createdAt(),
}, (t) => [uniqueIndex('legal_doc_version_uq').on(t.documentId, t.version)]);
export const legalAcceptances = pgTable('legal_acceptances', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  versionId: uuid('version_id').notNull().references(() => legalVersions.id),
  ip: text('ip'), acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('acceptances_user_idx').on(t.userId)]);

export const siteConfig = pgTable('site_config', {
  key: text('key').primaryKey(), value: jsonb('value').notNull(), updatedAt: updatedAt(),
});

export const auditLogs = pgTable('audit_logs', {
  id: id(), actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(), entityType: text('entity_type').notNull(), entityId: text('entity_id'),
  detail: jsonb('detail'), ip: text('ip'), createdAt: createdAt(),
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId), index('audit_created_idx').on(t.createdAt)]);

// ───────── Relations (for relational queries) ─────────
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  orders: many(orders), accounts: many(tradingAccounts),
}));
export const rolesRelations = relations(roles, ({ many }) => ({ permissions: many(rolePermissions) }));
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));
export const challengesRelations = relations(challenges, ({ one, many }) => ({
  stages: many(challengeStages), rules: one(challengeRules, { fields: [challenges.id], references: [challengeRules.challengeId] }),
  sizes: many(accountSizeOptions), products: many(products), instruments: many(challengeInstruments),
}));
export const stagesRelations = relations(challengeStages, ({ one }) => ({ challenge: one(challenges, { fields: [challengeStages.challengeId], references: [challenges.id] }) }));
export const rulesRelations = relations(challengeRules, ({ one }) => ({ challenge: one(challenges, { fields: [challengeRules.challengeId], references: [challenges.id] }) }));
export const sizesRelations = relations(accountSizeOptions, ({ one }) => ({
  challenge: one(challenges, { fields: [accountSizeOptions.challengeId], references: [challenges.id] }),
  product: one(products, { fields: [accountSizeOptions.id], references: [products.sizeOptionId] }),
}));
export const productsRelations = relations(products, ({ one }) => ({
  challenge: one(challenges, { fields: [products.challengeId], references: [challenges.id] }),
  sizeOption: one(accountSizeOptions, { fields: [products.sizeOptionId], references: [accountSizeOptions.id] }),
}));
export const challengeInstrumentsRelations = relations(challengeInstruments, ({ one }) => ({
  challenge: one(challenges, { fields: [challengeInstruments.challengeId], references: [challenges.id] }),
  instrument: one(instruments, { fields: [challengeInstruments.instrumentId], references: [instruments.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems), attempts: many(paymentAttempts), events: many(orderEvents),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({ order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }) }));
export const attemptsRelations = relations(paymentAttempts, ({ one }) => ({ order: one(orders, { fields: [paymentAttempts.orderId], references: [orders.id] }) }));
export const accountsRelations = relations(tradingAccounts, ({ one, many }) => ({
  user: one(users, { fields: [tradingAccounts.userId], references: [users.id] }),
  product: one(products, { fields: [tradingAccounts.productId], references: [products.id] }),
  metrics: many(accountMetricSnapshots), trades: many(tradeRecords), phases: many(accountPhaseHistory),
}));
export const metricsRelations = relations(accountMetricSnapshots, ({ one }) => ({ account: one(tradingAccounts, { fields: [accountMetricSnapshots.accountId], references: [tradingAccounts.id] }) }));
export const tradesRelations = relations(tradeRecords, ({ one }) => ({ account: one(tradingAccounts, { fields: [tradeRecords.accountId], references: [tradingAccounts.id] }) }));
export const phaseHistRelations = relations(accountPhaseHistory, ({ one }) => ({ account: one(tradingAccounts, { fields: [accountPhaseHistory.accountId], references: [tradingAccounts.id] }) }));
export const rewardsRelations = relations(rewardRequests, ({ one }) => ({
  user: one(users, { fields: [rewardRequests.userId], references: [users.id] }),
  account: one(tradingAccounts, { fields: [rewardRequests.accountId], references: [tradingAccounts.id] }),
}));
export const ticketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }), messages: many(supportMessages),
}));
export const messagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportMessages.ticketId], references: [supportTickets.id] }),
  author: one(users, { fields: [supportMessages.authorId], references: [users.id] }),
}));
export const legalDocRelations = relations(legalDocuments, ({ many }) => ({ versions: many(legalVersions) }));
export const legalVersionRelations = relations(legalVersions, ({ one }) => ({ document: one(legalDocuments, { fields: [legalVersions.documentId], references: [legalDocuments.id] }) }));
export const auditRelations = relations(auditLogs, ({ one }) => ({ actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }) }));

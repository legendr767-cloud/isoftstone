process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://isoft:isoft_dev_pw@localhost:5432/isoftstone_test';
process.env.SESSION_SECRET = 'test-session-secret-test-session-secret-123';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-test-webhook-secret-123';
process.env.PAYMENT_PROVIDER = 'dev_simulator';
process.env.TRADING_PROVIDER = 'demo';
process.env.APP_URL = 'http://localhost:5173';

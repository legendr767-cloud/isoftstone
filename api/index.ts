// Vercel serverless entry: the Express app handles every /api/* request.
import { createApp } from '../server/app.js';

const app = createApp();
export default app;

// Netlify Function entry: serves the whole Express API under /api/* (see netlify.toml).
import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

export const handler = serverless(createApp());

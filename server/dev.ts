import { createApp } from './app.js';
import { getEnv } from './config/env.js';

const env = getEnv();
createApp().listen(env.API_PORT, () => console.log(`iSoftStone API listening on http://localhost:${env.API_PORT}/api/v1`));

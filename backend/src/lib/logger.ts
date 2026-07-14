import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  // En dev, sortie lisible ; en prod, JSON brut (ingéré par le VPS / un collecteur).
  transport: env.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});

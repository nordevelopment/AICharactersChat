import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { config } from './config/config.js';
import { characterRoutes } from './controllers/characters.js';
import { chatRoutes } from './controllers/chat.js';
import { authRoutes } from './controllers/auth.js';
import { userRoutes } from './controllers/user.js';
import { imageRoutes } from './controllers/image.js';
import { viewsRoutes } from './controllers/views.js';
import { lorebookRoutes } from './controllers/lorebooks.js';
import { initDB } from './database/sqlite.js';

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  export interface Session {
    user?: {
      id: number;
      email: string;
      display_name: string;
      about?: string;
    };
  }
}

export async function createApp() {
  initDB();

  const storagePath = path.join(__dirname, '../../storage');
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
  for (const folder of ['generated', 'logs', 'sandbox', 'images', 'avatars']) {
    const folderPath = path.join(storagePath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  }

  const isDev = config.nodeEnv !== 'production' || config.loggingDebug;

  const server = fastify({
    trustProxy: true,
    bodyLimit: 5242880,
    disableRequestLogging: true,
    logger: {
      level: config.debugAi ? 'info' : 'warn',
      transport: config.loggingDebug ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        }
      } : undefined
    }
  });

  await server.register(fastifyMultipart);
  await server.register(FastifySSEPlugin);
  await server.register(fastifyCookie);
  await server.register(fastifySession, {
    secret: config.jwtSecret,
    cookie: {
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    }
  });

  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.user) {
      server.log.warn({
        url: request.url,
        ip: request.ip,
        sessionID: request.session?.sessionId,
        cookies: request.cookies,
      }, 'Unauthorized access attempt: No session found or session expired');

      return reply.code(401).send({ error: 'Unauthorized: No session found' });
    }
  });

  await server.register(fastifyView, {
    engine: {
      ejs: ejs
    },
    defaultContext: {
      version: Date.now()
    },
    root: config.frontendRoot
  });

  await server.register(fastifyStatic, {
    root: [
      path.join(process.cwd(), 'public/js'),
      path.join(process.cwd(), 'public/css'),
      path.join(process.cwd(), 'public/icons')
    ],
    prefix: '/public/',
    logLevel: 'warn'
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../storage/generated'),
    prefix: '/storage/generated/',
    decorateReply: false,
    logLevel: 'warn'
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../storage/avatars'),
    prefix: '/storage/avatars/',
    decorateReply: false,
    logLevel: 'warn'
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../storage/images'),
    prefix: '/storage/images/',
    decorateReply: false,
    logLevel: 'warn'
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../storage/sandbox'),
    prefix: '/storage/sandbox/',
    decorateReply: false,
    logLevel: 'warn'
  });

  // Application Routes
  await server.register(viewsRoutes);
  await server.register(authRoutes);
  await server.register(userRoutes);
  await server.register(characterRoutes);
  await server.register(lorebookRoutes);

  await server.register(chatRoutes);
  await server.register(imageRoutes);

  return server;
}

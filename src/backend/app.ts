import path from 'path';
import fs from 'fs';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { config } from './config/config';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { characterRoutes } from './controllers/characters';
import { chatRoutes } from './controllers/chat';
import { authRoutes } from './controllers/auth';
import { userRoutes } from './controllers/user';
import { imageRoutes } from './controllers/image';
import fastifyMultipart from '@fastify/multipart';


declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  export interface Session {
    user?: {
      id: number;
      email: string;
      display_name: string;
    };
  }
}

export async function createApp() {
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

  const server = fastify({
    trustProxy: true,
    bodyLimit: 5242880,
    logger: config.debugRequests ? {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    } : false
  });

  const aiLogger = config.debugRequests ? server.log : {
    info: (data: any, message: string) => {
      if (config.debugAi) {
        console.log(`[AI SERVICE] ${message}`, data);
      }
    },
    error: (data: any, message: string) => {
      console.error(`[AI SERVICE ERROR] ${message}`, data);
    }
  };

  await server.register(fastifyMultipart);

  await server.register(FastifySSEPlugin);

  await server.register(fastifyCookie);
  await server.register(fastifySession, {
    secret: config.jwtSecret,
    cookie: {
      secure: false,
      sameSite: 'lax',
      path: '/'
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

  await server.register(fastifyStatic, {
    root: config.frontendRoot,
    prefix: '/public/',
    logLevel: 'warn'
  });

  await server.register(fastifyStatic, {
    root: config.viewsRoot,
    prefix: '/',
    decorateReply: false,
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

  server.get('/', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('index.html', config.viewsRoot));
  server.get('/chat', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('chat.html', config.viewsRoot));
  server.get('/characters', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('characters.html', config.viewsRoot));
  server.get('/image-gen', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('image-gen.html', config.viewsRoot));

  // Application Routes
  await server.register(authRoutes);
  await server.register(userRoutes);
  await server.register(characterRoutes);

  await server.register(chatRoutes, { logger: aiLogger });
  await server.register(imageRoutes);

  return server;
}

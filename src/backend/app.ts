import path from 'path';
import fs from 'fs';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { config } from './config/config';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { characterRoutes } from './routes/character.routes';
import { chatRoutes } from './routes/chat.routes';
import { authRoutes } from './routes/auth.routes';
import { imageRoutes } from './routes/image.routes';

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
  // Обеспечиваем наличие папки для сгенерированного контента
  const storagePath = path.join(__dirname, '../../storage');
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  // Создаем необходимые подпапки внутри storage
  for (const folder of ['generated', 'logs', 'sandbox', 'images']) {
    const folderPath = path.join(storagePath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  }

  const server = fastify({
    trustProxy: true, // Позволяет корректно определять IP и HTTPS, когда мы за Nginx
    bodyLimit: 5242880, // 5MB
    logger: config.debugRequests ? {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    } : false
  });

  // Сохраняем логгер для AI логов, даже если общие логи отключены
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

  // Plugins
  await server.register(FastifySSEPlugin);

  // 1. Коротко: Сначала Cookies, потом Sessions
  await server.register(fastifyCookie);
  await server.register(fastifySession, {
    secret: config.jwtSecret, // Используем тот же ключ для подписи сессии
    cookie: {
      secure: false, // Включили true для работы за Nginx-HTTPS
      sameSite: 'lax', // Разрешает навигацию первого уровня (first-party)
      path: '/' // Куки доступны везде на домене
    }
  });

  // 2. Декоратор аутентификации (теперь через сессии)
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.user) {
      // Логируем ошибку авторизации 
      // (выведет URL, IP клиента и содержимое Cookie, чтобы мы понимали, потерялась кука или нет)
      server.log.warn({
        url: request.url,
        ip: request.ip,
        sessionID: request.session?.sessionId, // Существует ли объект сессии?
        cookies: request.cookies, // Видит ли бэкенд куку вообще?
      }, 'Unauthorized access attempt: No session found or session expired');

      return reply.code(401).send({ error: 'Unauthorized: No session found' });
    }
  });

  // Static Files
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

  // register storage folder
  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../../storage/generated'),
    prefix: '/storage/generated/',
    decorateReply: false,
    logLevel: 'warn'
  });

  // Views serving (direct HTML files)
    
  server.get('/', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('index.html', config.viewsRoot));
  server.get('/chat', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('chat.html', config.viewsRoot));
  server.get('/characters', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('characters.html', config.viewsRoot));
  server.get('/image-gen', { logLevel: 'warn' }, async (req, reply) => reply.sendFile('image-gen.html', config.viewsRoot));

  // Application Routes
  await server.register(authRoutes);
  await server.register(characterRoutes);
  await server.register(chatRoutes, { logger: aiLogger });
  await server.register(imageRoutes);

  return server;
}

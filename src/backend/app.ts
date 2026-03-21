import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { config } from './config/config';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { characterRoutes } from './routes/character.routes';
import { chatRoutes } from './routes/chat.routes';
import { authRoutes } from './routes/auth.routes';

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
  const server = fastify({ 
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    } 
  });

  // Plugins
  await server.register(FastifySSEPlugin);
  
  // 1. Коротко: Сначала Cookies, потом Sessions
  await server.register(fastifyCookie);
  await server.register(fastifySession, {
    secret: config.jwtSecret, // Используем тот же ключ для подписи сессии
    cookie: { secure: false } // В идеале true + HTTPS, но для тестов false
  });

  // 2. Декоратор аутентификации (теперь через сессии)
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.user) {
      return reply.code(401).send({ error: 'Unauthorized: No session found' });
    }
  });

  // Static Files
  await server.register(fastifyStatic, {
    root: config.frontendRoot,
    prefix: '/public/',
  });

  await server.register(fastifyStatic, {
    root: config.viewsRoot,
    prefix: '/',
    decorateReply: false
  });

  // Views serving (direct HTML files)
  server.get('/', async (req, reply) => reply.sendFile('index.html', config.viewsRoot));
  server.get('/chat', async (req, reply) => reply.sendFile('chat.html', config.viewsRoot));
  server.get('/characters', async (req, reply) => reply.sendFile('characters.html', config.viewsRoot));

  // Application Routes
  await server.register(authRoutes);
  await server.register(characterRoutes);
  await server.register(chatRoutes);

  return server;
}

import { initDB } from './database/sqlite';
import { createApp } from './app';
import { config } from './config/config';

const start = async () => {
  try {
    // 1. Инициализация БД
    initDB();
    
    // 2. Создание приложения Fastify
    const server = await createApp();
    
    // 3. Запуск
    await server.listen({ 
        port: config.port, 
        host: config.host 
    });
    
    console.log(`[SERVER] Started at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[SERVER] Startup error:', err);
    process.exit(1);
  }
};

start();

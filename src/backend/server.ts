import { initDB } from './database/sqlite';
import { createApp } from './app';
import { config } from './config/config';

const start = async () => {
  try {
    initDB();
    const server = await createApp();
    await server.listen({ 
        port: config.port, 
        host: config.host 
    });
    
  } catch (err) {
    console.error('[SERVER] Startup error:', err);
    process.exit(1);
  }
};

start();

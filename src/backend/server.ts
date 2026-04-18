/** 
 * Server entry point
 * @author Norayr Petrosyan
 * @version 1.5.0
 */

import { initDB } from './database/sqlite';
import { createApp } from './app';
import { config } from './config/config';
import { memoryService } from './services/memory.service';

const start = async () => {
  try {
    initDB();
    
    // Validate memory embeddings and migrate if needed
    await memoryService.validateAndMigrate();
    
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

/** 
 * Server entry point
 * @author Norayr Petrosyan
 */

import { createApp } from './app.js';
import { config } from './config/config.js';

const start = async () => {
  try {
    const server = await createApp();
    const address = await server.listen({
      port: config.port,
      host: config.host
    });

    console.log(`\n🚀 [SERVER] Application is running on: ${address}`);
    if (!config.apiKey) {
      // If host is 0.0.0.0, print a browser-friendly localhost link for configuration
      const displayAddress = config.host === '0.0.0.0' ? `http://localhost:${config.port}` : address;
      console.log(`⚙️  [SETUP] Open ${displayAddress} in your browser to perform first-launch configuration.\n`);
    }

  } catch (err) {
    console.error('[SERVER] Startup error:', err);
    process.exit(1);
  }
};


start();

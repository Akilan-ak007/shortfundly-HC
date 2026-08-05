import app from './app';
import { QueueManager } from './queues/queueManager';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Initialize automation queue
    await QueueManager.initialize();

    // Start listening on port
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(` EMAIL AUTOMATION PLATFORM SERVER LAUNCHED`);
      console.log(` Running on port: http://localhost:${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Fatal server startup failure:', error);
    process.exit(1);
  }
}

startServer();

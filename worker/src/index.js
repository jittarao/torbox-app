// Load environment variables first (before other imports)
import './loadEnv.js';

import express from 'express';
import cors from 'cors';
import PostgresDatabase from '../../src/database/PostgresDatabase.js';
import JobScheduler from './scheduler/JobScheduler.js';

class WorkerServer {
  constructor() {
    this.app = express();
    this.port = process.env.WORKER_PORT || 3002;
    this.database = null;
    this.scheduler = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Worker status
    this.app.get('/api/worker/status', (req, res) => {
      res.json({
        status: 'running',
        scheduler: this.scheduler ? this.scheduler.getStatus() : null,
        uptime: process.uptime()
      });
    });
  }

  async initialize() {
    try {
      // Check if multi-user backend is enabled
      const backendEnabled = process.env.MULTI_USER_BACKEND_ENABLED === 'true' || 
                             (process.env.MULTI_USER_BACKEND_ENABLED !== 'false' && process.env.DATABASE_URL);
      
      if (!backendEnabled) {
        console.log('Multi-user backend is disabled. Worker will not start.');
        console.log('Set MULTI_USER_BACKEND_ENABLED=true to enable the backend.');
        process.exit(0);
      }

      // Initialize database
      this.database = new PostgresDatabase();
      await this.database.initialize();
      console.log('Database initialized');

      // Initialize job scheduler
      this.scheduler = new JobScheduler(this.database);
      await this.scheduler.initialize();
      console.log('Job scheduler initialized');

      console.log('Worker server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize worker server:', error);
      throw error;
    }
  }

  start() {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`Worker server running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
    });
  }

  async shutdown() {
    console.log('Shutting down worker server...');
    
    if (this.scheduler) {
      await this.scheduler.shutdown();
    }
    
    if (this.database) {
      await this.database.close();
    }
    
    console.log('Worker server shutdown complete');
  }
}

// Start the server
const worker = new WorkerServer();

// Initialize and start
worker.initialize()
  .then(() => {
    worker.start();
  })
  .catch((error) => {
    console.error('Failed to start worker server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await worker.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await worker.shutdown();
  process.exit(0);
});

export default WorkerServer;


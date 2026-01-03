import cron from 'node-cron';
import TorBoxPoller from '../poller/TorBoxPoller.js';
import AutomationEngine from '../automation/AutomationEngine.js';

class JobScheduler {
  constructor(database) {
    this.database = database;
    this.poller = new TorBoxPoller(database);
    this.automationEngine = null;
    this.jobs = new Map();
  }

  async initialize() {
    try {
      // Initialize automation engine
      this.automationEngine = new AutomationEngine(this.database);
      await this.automationEngine.initialize();

      // Schedule jobs
      this.schedulePollingJob();
      this.scheduleAutomationJob();
      this.scheduleCleanupJob();

      console.log('Job scheduler initialized');
    } catch (error) {
      console.error('Failed to initialize job scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule staggered polling job
   */
  schedulePollingJob() {
    const internalIntervalMinutes = parseInt(
      process.env.POLLING_INTERVAL_INTERNAL_MINUTES || '2',
      10
    );

    // Create cron expression for internal interval
    // e.g., every 2 minutes: */2 * * * *
    const cronExpression = `*/${internalIntervalMinutes} * * * *`;

    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log('Running polling job...');
        const result = await this.poller.pollDueUsers();
        console.log('Polling job completed:', result);
      } catch (error) {
        console.error('Polling job failed:', error);
      }
    }, {
      scheduled: true
    });

    this.jobs.set('polling', job);
    console.log(`Scheduled polling job: ${cronExpression}`);
  }

  /**
   * Schedule automation execution job
   */
  scheduleAutomationJob() {
      // Run automation every 5 minutes
      const job = cron.schedule('*/5 * * * *', async () => {
        try {
          console.log('Running automation job...');
          if (this.automationEngine) {
            await this.automationEngine.executeAllRules();
          }
        } catch (error) {
          console.error('Automation job failed:', error);
        }
      }, {
        scheduled: true
      });

    this.jobs.set('automation', job);
    console.log('Scheduled automation job: */5 * * * *');
  }

  /**
   * Schedule cleanup job (runs daily at 2 AM)
   */
  scheduleCleanupJob() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Running cleanup job...');
        const deletedCount = await this.poller.snapshotManager.cleanupOldSnapshots();
        console.log(`Cleanup job completed: ${deletedCount} snapshots deleted`);
      } catch (error) {
        console.error('Cleanup job failed:', error);
      }
    }, {
      scheduled: true
    });

    this.jobs.set('cleanup', job);
    console.log('Scheduled cleanup job: 0 2 * * *');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      jobs: Array.from(this.jobs.keys()),
      polling: this.poller ? this.poller.getStats() : null,
      automation: this.automationEngine ? this.automationEngine.getStatus() : null,
    };
  }

  /**
   * Shutdown scheduler
   */
  async shutdown() {
    console.log('Shutting down job scheduler...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    
    this.jobs.clear();
    
    if (this.automationEngine) {
      await this.automationEngine.shutdown();
    }
    
    console.log('Job scheduler shutdown complete');
  }
}

export default JobScheduler;


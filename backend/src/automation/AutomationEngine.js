import cron from 'node-cron';

class AutomationEngine {
  constructor(database, apiClient) {
    this.database = database;
    this.apiClient = apiClient;
    this.runningJobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing automation engine...');
      
      // Load existing rules from database
      const rules = await this.database.getAutomationRules();
      
      // Start all enabled rules
      for (const rule of rules) {
        if (rule.enabled) {
          await this.startRule(rule);
        }
      }
      
      this.isInitialized = true;
      console.log(`Automation engine initialized with ${rules.length} rules`);
    } catch (error) {
      console.error('Failed to initialize automation engine:', error);
      throw error;
    }
  }

  async startRule(rule) {
    try {
      // Stop existing job if it exists
      if (this.runningJobs.has(rule.id)) {
        this.stopRule(rule.id);
      }

      // Convert trigger to cron expression
      const cronExpression = this.convertToCron(rule.trigger_config);
      
      if (!cronExpression) {
        console.warn(`Invalid trigger configuration for rule: ${rule.name}`);
        return;
      }

      // Create cron job
      const job = cron.schedule(cronExpression, async () => {
        await this.executeRule(rule);
      }, {
        scheduled: false // Don't start immediately
      });

      // Start the job
      job.start();
      this.runningJobs.set(rule.id, job);
      
      console.log(`Started rule: ${rule.name} (${cronExpression})`);
    } catch (error) {
      console.error(`Failed to start rule ${rule.name}:`, error);
    }
  }

  stopRule(ruleId) {
    const job = this.runningJobs.get(ruleId);
    if (job) {
      job.stop();
      this.runningJobs.delete(ruleId);
      console.log(`Stopped rule: ${ruleId}`);
    }
  }

  async executeRule(rule) {
    try {
      console.log(`🔄 Executing rule: ${rule.name}`);
      
      // Fetch current torrents from TorBox API
      const torrents = await this.apiClient.getTorrents();
      
      // Apply rule conditions
      const matchingItems = this.evaluateConditions(rule, torrents);
      
      if (matchingItems.length === 0) {
        console.log(`No items match conditions for rule: ${rule.name}`);
        await this.database.logRuleExecution(rule.id, rule.name, 'execution', 0, true);
        return;
      }

      console.log(`Rule ${rule.name} triggered for ${matchingItems.length} items`);

      // Execute actions on matching items
      let successCount = 0;
      let errorCount = 0;

      for (const item of matchingItems) {
        try {
          await this.executeAction(rule.action || rule.action_config, item);
          successCount++;
        } catch (error) {
          console.error(`Action failed for item ${item.name}:`, error);
          errorCount++;
        }
      }

      // Log execution
      await this.database.logRuleExecution(
        rule.id, 
        rule.name, 
        'execution', 
        matchingItems.length, 
        errorCount === 0,
        errorCount > 0 ? `${errorCount} actions failed` : null
      );

      console.log(`Rule ${rule.name} completed: ${successCount} successful, ${errorCount} failed`);
    } catch (error) {
      console.error(`Rule execution failed for ${rule.name}:`, error);
      await this.database.logRuleExecution(rule.id, rule.name, 'execution', 0, false, error.message);
    }
  }

  evaluateConditions(rule, items) {
    const conditions = rule.conditions || [];
    const logicOperator = rule.logicOperator || 'and';
    
    return items.filter(item => {
      const conditionResults = conditions.map(condition => {
        return this.evaluateCondition(condition, item);
      });

      // Apply logic operator
      if (logicOperator === 'or') {
        return conditionResults.some(result => result);
      } else {
        return conditionResults.every(result => result);
      }
    });
  }

  evaluateCondition(condition, item) {
    const now = Date.now();
    let conditionValue = 0;

    switch (condition.type) {
      case 'seeding_time':
        if (!item.active) return false;
        conditionValue = (now - new Date(item.cached_at).getTime()) / (1000 * 60 * 60);
        break;
        
      case 'stalled_time':
        // Check for stalled states that exist in TorBox API
        if (['uploading (no peers)', 'downloading'].includes(item.download_state) && item.active) {
          conditionValue = (now - new Date(item.updated_at).getTime()) / (1000 * 60 * 60);
        } else {
          return false;
        }
        break;
        
      case 'seeding_ratio':
        if (!item.active) return false;
        conditionValue = item.ratio || 0;
        break;
        
      case 'seeds':
        conditionValue = item.seeds || 0;
        break;
        
      case 'peers':
        conditionValue = item.peers || 0;
        break;
        
      case 'inactive':
        // Check if torrent is inactive (expired torrents)
        const isInactive = item.download_state === 'expired';
        conditionValue = isInactive ? 1 : 0;
        break;
        
      case 'age':
        // Calculate age in hours since creation
        conditionValue = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        break;
        
      case 'download_speed':
        conditionValue = item.download_speed || 0;
        break;
        
      case 'upload_speed':
        conditionValue = item.upload_speed || 0;
        break;
        
      case 'file_size':
        // Convert bytes to GB
        conditionValue = (item.size || 0) / (1024 * 1024 * 1024);
        break;
        
      case 'tracker':
        // Check if tracker matches (string comparison)
        const trackerMatch = item.tracker && item.tracker.includes(condition.value);
        return trackerMatch;
        
      case 'progress':
        // Check download progress percentage
        conditionValue = item.progress || 0;
        break;
        
      case 'total_uploaded':
        // Check total uploaded bytes
        conditionValue = (item.total_uploaded || 0) / (1024 * 1024 * 1024); // Convert to GB
        break;
        
      case 'total_downloaded':
        // Check total downloaded bytes
        conditionValue = (item.total_downloaded || 0) / (1024 * 1024 * 1024); // Convert to GB
        break;
        
      case 'availability':
        // Check torrent availability
        conditionValue = item.availability || 0;
        break;
        
      case 'eta':
        // Check estimated time to completion (in seconds)
        conditionValue = item.eta || 0;
        break;
        
      case 'download_finished':
        // Check if download is finished
        conditionValue = item.download_finished ? 1 : 0;
        break;
        
      case 'cached':
        // Check if torrent is cached
        conditionValue = item.cached ? 1 : 0;
        break;
        
      case 'private':
        // Check if torrent is private
        conditionValue = item.private ? 1 : 0;
        break;
        
      case 'long_term_seeding':
        // Check if torrent is set for long-term seeding
        conditionValue = item.long_term_seeding ? 1 : 0;
        break;
        
      case 'seed_torrent':
        // Check if torrent is a seed torrent
        conditionValue = item.seed_torrent ? 1 : 0;
        break;
        
      case 'download_state':
        // Check specific download state
        const stateMatch = item.download_state === condition.value;
        return stateMatch;
        
      case 'name_contains':
        // Check if torrent name contains specific text
        const nameMatch = item.name && item.name.toLowerCase().includes(condition.value.toLowerCase());
        return nameMatch;
        
      case 'file_count':
        // Check number of files in torrent
        conditionValue = item.files ? item.files.length : 0;
        break;
        
      case 'expires_at':
        // Check if torrent has expiration date
        if (item.expires_at) {
          const expirationTime = new Date(item.expires_at).getTime();
          conditionValue = (expirationTime - now) / (1000 * 60 * 60); // Hours until expiration
        } else {
          conditionValue = -1; // No expiration
        }
        break;
        
      default:
        return false;
    }

    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  compareValues(value1, operator, value2) {
    switch (operator) {
      case 'gt': return value1 > value2;
      case 'lt': return value1 < value2;
      case 'gte': return value1 >= value2;
      case 'lte': return value1 <= value2;
      case 'eq': return value1 === value2;
      default: return false;
    }
  }

  async executeAction(action, item) {
    switch (action.type) {
      case 'stop_seeding':
        return await this.apiClient.controlTorrent(item.id, 'stop_seeding');
        
      case 'archive':
        // Archive and delete
        await this.apiClient.archiveDownload(item);
        return await this.apiClient.deleteTorrent(item.id);
        
      case 'delete':
        return await this.apiClient.deleteTorrent(item.id);
        
      case 'force_start':
        return await this.apiClient.controlQueuedTorrent(item.id, 'force_start');
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  convertToCron(trigger) {
    // Convert interval-based trigger to cron expression
    if (trigger.type === 'interval' && trigger.value) {
      const minutes = trigger.value;
      
      if (minutes < 1) {
        return null; // Invalid interval
      }
      
      // Convert minutes to cron expression
      if (minutes === 1) {
        return '* * * * *'; // Every minute
      } else if (minutes < 60) {
        return `*/${minutes} * * * *`; // Every N minutes
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) {
          return `0 */${hours} * * *`; // Every N hours
        } else {
          return `${remainingMinutes} */${hours} * * *`; // Every N hours at M minutes
        }
      }
    }
    
    return null;
  }

  async reloadRules() {
    try {
      console.log('🔄 Reloading automation rules...');
      
      // Stop all existing jobs
      for (const [ruleId, job] of this.runningJobs) {
        job.stop();
      }
      this.runningJobs.clear();
      
      // Reload rules from database
      const rules = await this.database.getAutomationRules();
      
      // Start enabled rules
      for (const rule of rules) {
        if (rule.enabled) {
          await this.startRule(rule);
        }
      }
      
      console.log(`Reloaded ${rules.length} automation rules`);
    } catch (error) {
      console.error('Failed to reload automation rules:', error);
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      runningJobs: this.runningJobs.size,
      rules: Array.from(this.runningJobs.keys())
    };
  }

  shutdown() {
    console.log('Shutting down automation engine...');
    
    for (const [ruleId, job] of this.runningJobs) {
      job.stop();
    }
    this.runningJobs.clear();
    
    console.log('Automation engine shutdown complete');
  }
}

export default AutomationEngine;

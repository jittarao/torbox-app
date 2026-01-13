import { describe, it, expect, beforeEach, mock } from 'bun:test';
import RuleEvaluator from '../RuleEvaluator.js';

describe('RuleEvaluator', () => {
  let ruleEvaluator;
  let mockUserDb;
  let mockApiClient;

  beforeEach(() => {
    // Create mock functions for database methods
    const mockGet = mock(() => null);
    const mockAll = mock(() => []);
    const mockRun = mock(() => ({ lastInsertRowid: 1 }));
    // Transaction should return a function that executes the passed function
    const mockTransaction = mock((fn) => {
      const transactionFn = () => fn();
      return transactionFn;
    });

    // Mock database
    mockUserDb = {
      prepare: mock((query) => {
        return {
          get: mockGet,
          all: mockAll,
          run: mockRun,
        };
      }),
      transaction: mockTransaction,
    };

    // Store references for test access
    mockUserDb._mockGet = mockGet;
    mockUserDb._mockAll = mockAll;
    mockUserDb._mockRun = mockRun;
    mockUserDb._mockTransaction = mockTransaction;

    // Mock API client
    mockApiClient = {
      controlTorrent: mock(() => Promise.resolve({ success: true })),
      deleteTorrent: mock(() => Promise.resolve({ success: true })),
    };

    ruleEvaluator = new RuleEvaluator(mockUserDb, mockApiClient);
  });

  describe('evaluateRule', () => {
    it('should return empty array for disabled rules', async () => {
      const rule = {
        enabled: false,
        conditions: [],
      };
      const torrents = [{ id: '1', name: 'test' }];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toEqual([]);
    });

    it('should skip evaluation when interval has not elapsed', async () => {
      const now = Date.now();
      const oneMinuteAgo = new Date(now - 1 * 60 * 1000).toISOString();

      const rule = {
        enabled: true,
        trigger: { type: 'interval', value: 10 }, // 10 minutes
        last_evaluated_at: oneMinuteAgo,
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 0 }],
      };
      const torrents = [{ id: '1', name: 'test', progress: 100 }];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toEqual([]);
    });

    it('should evaluate when interval has elapsed', async () => {
      const now = Date.now();
      const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();

      const rule = {
        enabled: true,
        trigger: { type: 'interval', value: 10 }, // 10 minutes
        last_evaluated_at: fifteenMinutesAgo,
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75 },
        { id: '2', name: 'test2', progress: 30 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should evaluate immediately when last_evaluated_at is null', async () => {
      const rule = {
        enabled: true,
        trigger: { type: 'interval', value: 10 },
        last_evaluated_at: null,
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75 },
        { id: '2', name: 'test2', progress: 30 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
    });

    it('should handle invalid interval (less than 1 minute) and still evaluate', async () => {
      const now = Date.now();
      const twoMinutesAgo = new Date(now - 2 * 60 * 1000).toISOString();

      const rule = {
        enabled: true,
        trigger: { type: 'interval', value: 0.5 }, // Less than 1 minute
        last_evaluated_at: twoMinutesAgo,
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };
      const torrents = [{ id: '1', name: 'test', progress: 75 }];

      // Should still evaluate (uses minimum of 1 minute)
      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
    });

    it('should evaluate when no interval trigger is configured', async () => {
      const rule = {
        enabled: true,
        // No trigger configured
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75 },
        { id: '2', name: 'test2', progress: 30 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
    });

    it('should evaluate rules with AND logic operator', async () => {
      const rule = {
        enabled: true,
        conditions: [
          { type: 'PROGRESS', operator: 'gte', value: 50 },
          { type: 'DOWNLOAD_SPEED', operator: 'gt', value: 0 },
        ],
        logicOperator: 'and',
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75, download_speed: 1024 * 1024 }, // 1 MB/s
        { id: '2', name: 'test2', progress: 30, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should evaluate rules with OR logic operator', async () => {
      const rule = {
        enabled: true,
        conditions: [
          { type: 'PROGRESS', operator: 'gte', value: 100 },
          { type: 'DOWNLOAD_SPEED', operator: 'gt', value: 5 },
        ],
        logicOperator: 'or',
      };
      const torrents = [
        { id: '1', name: 'test', progress: 100, download_speed: 0 },
        { id: '2', name: 'test2', progress: 50, download_speed: 6 * 1024 * 1024 }, // 6 MB/s
        { id: '3', name: 'test3', progress: 50, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toContain('1');
      expect(result.map((t) => t.id)).toContain('2');
    });

    it('should use AND as default logic operator', async () => {
      const rule = {
        enabled: true,
        conditions: [
          { type: 'PROGRESS', operator: 'gte', value: 50 },
          { type: 'DOWNLOAD_SPEED', operator: 'gt', value: 0 },
        ],
        // No logicOperator specified
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75, download_speed: 1024 * 1024 },
        { id: '2', name: 'test2', progress: 30, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
    });

    it('should evaluate rules with group structure (AND between groups)', async () => {
      const rule = {
        enabled: true,
        groups: [
          {
            conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
            logicOperator: 'and',
          },
          {
            conditions: [{ type: 'DOWNLOAD_SPEED', operator: 'gt', value: 0 }],
            logicOperator: 'and',
          },
        ],
        logicOperator: 'and',
      };
      const torrents = [
        { id: '1', name: 'test', progress: 75, download_speed: 1024 * 1024 },
        { id: '2', name: 'test2', progress: 30, download_speed: 0 },
        { id: '3', name: 'test3', progress: 75, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should evaluate rules with group structure (OR between groups)', async () => {
      const rule = {
        enabled: true,
        groups: [
          {
            conditions: [{ type: 'PROGRESS', operator: 'gte', value: 100 }],
            logicOperator: 'and',
          },
          {
            conditions: [{ type: 'DOWNLOAD_SPEED', operator: 'gt', value: 5 }],
            logicOperator: 'and',
          },
        ],
        logicOperator: 'or',
      };
      const torrents = [
        { id: '1', name: 'test', progress: 100, download_speed: 0 },
        { id: '2', name: 'test2', progress: 50, download_speed: 6 * 1024 * 1024 },
        { id: '3', name: 'test3', progress: 50, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toContain('1');
      expect(result.map((t) => t.id)).toContain('2');
    });

    it('should evaluate rules with group structure (OR within group)', async () => {
      const rule = {
        enabled: true,
        groups: [
          {
            conditions: [
              { type: 'PROGRESS', operator: 'gte', value: 100 },
              { type: 'DOWNLOAD_SPEED', operator: 'gt', value: 5 },
            ],
            logicOperator: 'or',
          },
        ],
        logicOperator: 'and',
      };
      const torrents = [
        { id: '1', name: 'test', progress: 100, download_speed: 0 },
        { id: '2', name: 'test2', progress: 50, download_speed: 6 * 1024 * 1024 },
        { id: '3', name: 'test3', progress: 50, download_speed: 0 },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toContain('1');
      expect(result.map((t) => t.id)).toContain('2');
    });

    it('should return empty array for empty group', async () => {
      const rule = {
        enabled: true,
        groups: [
          {
            conditions: [],
            logicOperator: 'and',
          },
        ],
        logicOperator: 'and',
      };
      const torrents = [{ id: '1', name: 'test', progress: 100 }];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toEqual([]);
    });

    it('should match all torrents when rule has no conditions (flat structure)', async () => {
      const rule = {
        enabled: true,
        conditions: [],
      };
      const torrents = [
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
      ];

      const result = await ruleEvaluator.evaluateRule(rule, torrents);
      expect(result).toHaveLength(2);
    });
  });

  describe('evaluateCondition', () => {
    describe('Time / State (Derived) conditions', () => {
      it('should evaluate SEEDING_TIME condition', () => {
        const now = Date.now();
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

        const condition = { type: 'SEEDING_TIME', operator: 'gte', value: 1 };
        const torrent = { id: '1', cached_at: twoHoursAgo };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should return false for SEEDING_TIME when cached_at is missing', () => {
        const condition = { type: 'SEEDING_TIME', operator: 'gte', value: 1 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should evaluate AGE condition', () => {
        const now = Date.now();
        const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();

        const condition = { type: 'AGE', operator: 'gte', value: 2 };
        const torrent = { id: '1', created_at: threeHoursAgo };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should return false for AGE condition when created_at is missing', () => {
        const condition = { type: 'AGE', operator: 'gte', value: 2 };
        const torrent = { id: '1' }; // No created_at

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should evaluate LAST_DOWNLOAD_ACTIVITY_AT condition', () => {
        const now = Date.now();
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();

        const telemetryMap = new Map([
          ['1', { torrent_id: '1', last_download_activity_at: thirtyMinutesAgo }],
        ]);

        const condition = { type: 'LAST_DOWNLOAD_ACTIVITY_AT', operator: 'gte', value: 20 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(true);
      });

      it('should handle LAST_DOWNLOAD_ACTIVITY_AT with no activity (gt operator)', () => {
        const telemetryMap = new Map(); // Empty map = no telemetry

        const condition = { type: 'LAST_DOWNLOAD_ACTIVITY_AT', operator: 'gt', value: 100 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(true); // Infinity > 100
      });

      it('should handle LAST_DOWNLOAD_ACTIVITY_AT with no activity (lt operator)', () => {
        const telemetryMap = new Map(); // Empty map = no telemetry

        const condition = { type: 'LAST_DOWNLOAD_ACTIVITY_AT', operator: 'lt', value: 100 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(false); // Infinity is not < 100
      });

      it('should evaluate LAST_UPLOAD_ACTIVITY_AT condition', () => {
        const now = Date.now();
        const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();

        const telemetryMap = new Map([
          ['1', { torrent_id: '1', last_upload_activity_at: fifteenMinutesAgo }],
        ]);

        const condition = { type: 'LAST_UPLOAD_ACTIVITY_AT', operator: 'lte', value: 20 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(true);
      });
    });

    describe('Progress & Performance (Direct from API) conditions', () => {
      it('should evaluate PROGRESS condition', () => {
        const condition = { type: 'PROGRESS', operator: 'gte', value: 50 };
        const torrent = { id: '1', progress: 75 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate DOWNLOAD_SPEED condition (converts bytes/s to MB/s)', () => {
        const condition = { type: 'DOWNLOAD_SPEED', operator: 'gt', value: 1 };
        const torrent = { id: '1', download_speed: 2 * 1024 * 1024 }; // 2 MB/s

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate UPLOAD_SPEED condition (converts bytes/s to MB/s)', () => {
        const condition = { type: 'UPLOAD_SPEED', operator: 'gte', value: 0.5 };
        const torrent = { id: '1', upload_speed: 1024 * 1024 }; // 1 MB/s

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate AVG_DOWNLOAD_SPEED condition', () => {
        const condition = { type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 2, hours: 1 };
        const torrent = { id: '1' };

        // Mock getAverageSpeed method
        ruleEvaluator.getAverageSpeed = mock(() => 3 * 1024 * 1024); // 3 MB/s in bytes/s

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate AVG_UPLOAD_SPEED condition', () => {
        const condition = { type: 'AVG_UPLOAD_SPEED', operator: 'lte', value: 1, hours: 3 };
        const torrent = { id: '1' };

        // Mock getAverageSpeed method
        ruleEvaluator.getAverageSpeed = mock(() => 0.5 * 1024 * 1024); // 0.5 MB/s in bytes/s

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate ETA condition', () => {
        // 60 minutes = 3600 seconds, 30 minutes = 1800 seconds
        const condition = { type: 'ETA', operator: 'lt', value: 60 }; // 60 minutes
        const torrent = { id: '1', eta: 1800 }; // 1800 seconds = 30 minutes

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true); // 30 minutes < 60 minutes
      });
    });

    describe('Stall & Inactivity (Derived) conditions', () => {
      it('should evaluate DOWNLOAD_STALLED_TIME condition', () => {
        const now = Date.now();
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();

        const telemetryMap = new Map([['1', { torrent_id: '1', stalled_since: tenMinutesAgo }]]);

        const condition = { type: 'DOWNLOAD_STALLED_TIME', operator: 'gte', value: 5 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(true);
      });

      it('should return false for DOWNLOAD_STALLED_TIME when telemetry is missing', () => {
        const telemetryMap = new Map(); // Empty map = no telemetry

        const condition = { type: 'DOWNLOAD_STALLED_TIME', operator: 'gte', value: 5 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(false);
      });

      it('should evaluate UPLOAD_STALLED_TIME condition', () => {
        const now = Date.now();
        const twentyMinutesAgo = new Date(now - 20 * 60 * 1000).toISOString();

        const telemetryMap = new Map([
          ['1', { torrent_id: '1', upload_stalled_since: twentyMinutesAgo }],
        ]);

        const condition = { type: 'UPLOAD_STALLED_TIME', operator: 'gte', value: 15 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent, telemetryMap);
        expect(result).toBe(true);
      });
    });

    describe('Swarm & Ratio (Direct from API) conditions', () => {
      it('should evaluate SEEDS condition', () => {
        const condition = { type: 'SEEDS', operator: 'gte', value: 10 };
        const torrent = { id: '1', seeds: 15 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate PEERS condition', () => {
        const condition = { type: 'PEERS', operator: 'lt', value: 100 };
        const torrent = { id: '1', peers: 50 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate RATIO condition using ratio field', () => {
        const condition = { type: 'RATIO', operator: 'gte', value: 1.0 };
        const torrent = { id: '1', ratio: 1.5 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate RATIO condition using calculated ratio', () => {
        const condition = { type: 'RATIO', operator: 'gte', value: 1.0 };
        const torrent = {
          id: '1',
          total_uploaded: 2 * 1024 * 1024, // 2 MB
          total_downloaded: 1024 * 1024, // 1 MB
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should return 0 for RATIO condition when total_downloaded is 0', () => {
        const condition = { type: 'RATIO', operator: 'eq', value: 0 };
        const torrent = {
          id: '1',
          total_uploaded: 1024 * 1024,
          total_downloaded: 0,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate TOTAL_UPLOADED condition (converts bytes to MB)', () => {
        const condition = { type: 'TOTAL_UPLOADED', operator: 'gte', value: 1 };
        const torrent = { id: '1', total_uploaded: 2 * 1024 * 1024 }; // 2 MB

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate TOTAL_DOWNLOADED condition (converts bytes to MB)', () => {
        const condition = { type: 'TOTAL_DOWNLOADED', operator: 'gte', value: 1 };
        const torrent = { id: '1', total_downloaded: 2 * 1024 * 1024 }; // 2 MB

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });
    });

    describe('Content & Metadata (Direct from API) conditions', () => {
      it('should evaluate FILE_SIZE condition (converts bytes to MB)', () => {
        const condition = { type: 'FILE_SIZE', operator: 'lt', value: 5 };
        const torrent = { id: '1', size: 3 * 1024 * 1024 }; // 3 MB

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate FILE_COUNT condition using files array', () => {
        const condition = { type: 'FILE_COUNT', operator: 'gte', value: 5 };
        const torrent = { id: '1', files: [1, 2, 3, 4, 5, 6] };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate FILE_COUNT condition using file_count field', () => {
        const condition = { type: 'FILE_COUNT', operator: 'lt', value: 10 };
        const torrent = { id: '1', file_count: 5 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should return 0 for FILE_COUNT condition when files array is missing', () => {
        const condition = { type: 'FILE_COUNT', operator: 'eq', value: 0 };
        const torrent = { id: '1' }; // No files array

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition (case-insensitive contains)', () => {
        const condition = { type: 'NAME', operator: 'contains', value: 'test' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition with equals operator', () => {
        const condition = { type: 'NAME', operator: 'equals', value: 'test torrent' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition with not_equals operator', () => {
        const condition = { type: 'NAME', operator: 'not_equals', value: 'other' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition with starts_with operator', () => {
        const condition = { type: 'NAME', operator: 'starts_with', value: 'test' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition with ends_with operator', () => {
        const condition = { type: 'NAME', operator: 'ends_with', value: 'torrent' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate NAME condition with not_contains operator', () => {
        const condition = { type: 'NAME', operator: 'not_contains', value: 'xyz' };
        const torrent = { id: '1', name: 'Test Torrent' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate TRACKER condition', () => {
        const condition = { type: 'TRACKER', operator: 'contains', value: 'example' };
        const torrent = { id: '1', tracker: 'https://tracker.example.com' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate TRACKER condition with equals operator', () => {
        const condition = {
          type: 'TRACKER',
          operator: 'equals',
          value: 'https://tracker.example.com',
        };
        const torrent = { id: '1', tracker: 'https://tracker.example.com' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate PRIVATE condition as boolean', () => {
        const condition = { type: 'PRIVATE', value: true };
        const torrent = { id: '1', private: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate PRIVATE condition with operator', () => {
        const condition = { type: 'PRIVATE', operator: 'eq', value: 1 };
        const torrent = { id: '1', private: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate PRIVATE condition with is_true operator', () => {
        const condition = { type: 'PRIVATE', operator: 'is_true' };
        const torrent = { id: '1', private: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate PRIVATE condition with is_false operator', () => {
        const condition = { type: 'PRIVATE', operator: 'is_false' };
        const torrent = { id: '1', private: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate CACHED condition as boolean', () => {
        const condition = { type: 'CACHED', value: false };
        const torrent = { id: '1', cached: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate CACHED condition with is_true operator', () => {
        const condition = { type: 'CACHED', operator: 'is_true' };
        const torrent = { id: '1', cached: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate CACHED condition with is_false operator', () => {
        const condition = { type: 'CACHED', operator: 'is_false' };
        const torrent = { id: '1', cached: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate AVAILABILITY condition', () => {
        const condition = { type: 'AVAILABILITY', operator: 'gte', value: 0.5 };
        const torrent = { id: '1', availability: 0.75 };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate ALLOW_ZIP condition as boolean', () => {
        const condition = { type: 'ALLOW_ZIP', value: true };
        const torrent = { id: '1', allow_zipped: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate ALLOW_ZIP condition with operator', () => {
        const condition = { type: 'ALLOW_ZIP', operator: 'eq', value: 1 };
        const torrent = { id: '1', allow_zipped: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate ALLOW_ZIP condition with is_true operator', () => {
        const condition = { type: 'ALLOW_ZIP', operator: 'is_true' };
        const torrent = { id: '1', allow_zipped: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate ALLOW_ZIP condition with is_false operator', () => {
        const condition = { type: 'ALLOW_ZIP', operator: 'is_false' };
        const torrent = { id: '1', allow_zipped: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });
    });

    describe('Lifecycle (Derived or Direct) conditions', () => {
      it('should evaluate STATUS condition - queued', () => {
        const condition = { type: 'STATUS', value: ['queued'] };
        const torrent = {
          id: '1',
          download_state: null,
          download_finished: false,
          active: false,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - downloading', () => {
        const condition = { type: 'STATUS', value: ['downloading'] };
        const torrent = {
          id: '1',
          active: true,
          download_finished: false,
          download_present: false,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - seeding', () => {
        const condition = { type: 'STATUS', value: ['seeding'] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - completed', () => {
        const condition = { type: 'STATUS', value: ['completed'] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: false,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - failed', () => {
        const condition = { type: 'STATUS', value: ['failed'] };
        const torrent = {
          id: '1',
          download_state: 'failed - some error',
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - stalled', () => {
        const condition = { type: 'STATUS', value: ['stalled'] };
        const torrent = {
          id: '1',
          download_state: 'stalled - no peers',
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - multiple statuses (match)', () => {
        const condition = { type: 'STATUS', value: ['downloading', 'seeding', 'completed'] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true); // Matches 'seeding'
      });

      it('should evaluate STATUS condition - multiple statuses (no match)', () => {
        const condition = { type: 'STATUS', value: ['downloading', 'completed'] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false); // Torrent is 'seeding', not in array
      });

      it('should evaluate STATUS condition with is_any_of operator', () => {
        const condition = {
          type: 'STATUS',
          operator: 'is_any_of',
          value: ['downloading', 'seeding'],
        };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true); // Matches 'seeding'
      });

      it('should evaluate STATUS condition with is_none_of operator', () => {
        const condition = {
          type: 'STATUS',
          operator: 'is_none_of',
          value: ['downloading', 'completed'],
        };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true); // Torrent is 'seeding', not in excluded list
      });

      it('should evaluate STATUS condition with is_none_of operator (match excluded)', () => {
        const condition = {
          type: 'STATUS',
          operator: 'is_none_of',
          value: ['seeding', 'completed'],
        };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false); // Torrent is 'seeding', which is excluded
      });

      it('should return false for STATUS condition with empty array', () => {
        const condition = { type: 'STATUS', value: [] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: true,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should return false for STATUS condition when value is not an array', () => {
        const condition = { type: 'STATUS', value: 'queued' };
        const torrent = {
          id: '1',
          download_state: null,
          download_finished: false,
          active: false,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should evaluate STATUS condition - uploading', () => {
        const condition = { type: 'STATUS', value: ['uploading'] };
        const torrent = {
          id: '1',
          download_finished: true,
          download_present: false,
          active: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate STATUS condition - inactive', () => {
        const condition = { type: 'STATUS', value: ['inactive'] };
        const torrent = {
          id: '1',
          active: false,
          download_present: false,
          download_finished: true,
        };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate IS_ACTIVE condition as boolean', () => {
        const condition = { type: 'IS_ACTIVE', value: true };
        const torrent = { id: '1', active: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate IS_ACTIVE condition with operator', () => {
        const condition = { type: 'IS_ACTIVE', operator: 'eq', value: 0 };
        const torrent = { id: '1', active: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate SEEDING_ENABLED condition as boolean', () => {
        const condition = { type: 'SEEDING_ENABLED', value: true };
        const torrent = { id: '1', seed_torrent: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate SEEDING_ENABLED condition with operator', () => {
        const condition = { type: 'SEEDING_ENABLED', operator: 'eq', value: 1 };
        const torrent = { id: '1', seed_torrent: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate SEEDING_ENABLED condition with is_true operator', () => {
        const condition = { type: 'SEEDING_ENABLED', operator: 'is_true' };
        const torrent = { id: '1', seed_torrent: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate SEEDING_ENABLED condition with is_false operator', () => {
        const condition = { type: 'SEEDING_ENABLED', operator: 'is_false' };
        const torrent = { id: '1', seed_torrent: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate LONG_TERM_SEEDING condition as boolean', () => {
        const condition = { type: 'LONG_TERM_SEEDING', value: false };
        const torrent = { id: '1', long_term_seeding: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate LONG_TERM_SEEDING condition with operator', () => {
        const condition = { type: 'LONG_TERM_SEEDING', operator: 'eq', value: 1 };
        const torrent = { id: '1', long_term_seeding: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate LONG_TERM_SEEDING condition with is_true operator', () => {
        const condition = { type: 'LONG_TERM_SEEDING', operator: 'is_true' };
        const torrent = { id: '1', long_term_seeding: true };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate LONG_TERM_SEEDING condition with is_false operator', () => {
        const condition = { type: 'LONG_TERM_SEEDING', operator: 'is_false' };
        const torrent = { id: '1', long_term_seeding: false };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should evaluate EXPIRES_AT condition', () => {
        const now = Date.now();
        const twoHoursFromNow = new Date(now + 2 * 60 * 60 * 1000).toISOString();

        const condition = { type: 'EXPIRES_AT', operator: 'lt', value: 5 };
        const torrent = { id: '1', expires_at: twoHoursFromNow };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(true);
      });

      it('should return false for EXPIRES_AT when already expired (gt operator)', () => {
        const now = Date.now();
        const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

        const condition = { type: 'EXPIRES_AT', operator: 'gt', value: 0 };
        const torrent = { id: '1', expires_at: oneHourAgo };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should return false for EXPIRES_AT when torrent has no expires_at', () => {
        const condition = { type: 'EXPIRES_AT', operator: 'lt', value: 5 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should evaluate TAGS condition with has_any operator', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: [1, 2, 3] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([
          [
            '1',
            [
              { id: 1, name: 'tag1' },
              { id: 2, name: 'tag2' },
            ],
          ],
        ]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with is_any_of operator (frontend alias)', () => {
        const condition = { type: 'TAGS', operator: 'is_any_of', value: [1, 2, 3] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 1, name: 'tag1' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with has_all operator', () => {
        const condition = { type: 'TAGS', operator: 'has_all', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([
          [
            '1',
            [
              { id: 1, name: 'tag1' },
              { id: 2, name: 'tag2' },
            ],
          ],
        ]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with is_all_of operator (frontend alias)', () => {
        const condition = { type: 'TAGS', operator: 'is_all_of', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([
          [
            '1',
            [
              { id: 1, name: 'tag1' },
              { id: 2, name: 'tag2' },
            ],
          ],
        ]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with has_all operator (missing tag)', () => {
        const condition = { type: 'TAGS', operator: 'has_all', value: [1, 2, 3] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([
          [
            '1',
            [
              { id: 1, name: 'tag1' },
              { id: 2, name: 'tag2' },
            ],
          ],
        ]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(false);
      });

      it('should evaluate TAGS condition with has_none operator', () => {
        const condition = { type: 'TAGS', operator: 'has_none', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 3, name: 'tag3' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with is_none_of operator (frontend alias)', () => {
        const condition = { type: 'TAGS', operator: 'is_none_of', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 3, name: 'tag3' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });

      it('should evaluate TAGS condition with has_none operator (has excluded tag)', () => {
        const condition = { type: 'TAGS', operator: 'has_none', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 1, name: 'tag1' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(false);
      });

      it('should return true for TAGS condition with empty value array', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: [] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 1, name: 'tag1' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true); // No tags specified means match all
      });

      it('should return false for TAGS condition when download has no tags', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: [1, 2] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map(); // No tags

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(false);
      });

      it('should return false for TAGS condition when value is not an array', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: 'not-an-array' };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should return false for TAGS condition when operator is missing', () => {
        const condition = { type: 'TAGS', value: [1, 2] };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should return false for TAGS condition when download ID is missing', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: [1, 2] };
        const torrent = {}; // No id

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });

      it('should handle TAGS condition with string tag IDs', () => {
        const condition = { type: 'TAGS', operator: 'has_any', value: ['1', '2'] };
        const torrent = { id: '1' };
        const tagsByDownloadId = new Map([['1', [{ id: 1, name: 'tag1' }]]]);

        const result = ruleEvaluator.evaluateCondition(
          condition,
          torrent,
          new Map(),
          tagsByDownloadId
        );
        expect(result).toBe(true);
      });
    });

    describe('Unknown condition types', () => {
      it('should return false for unknown condition types', () => {
        const condition = { type: 'UNKNOWN_TYPE', operator: 'eq', value: 1 };
        const torrent = { id: '1' };

        const result = ruleEvaluator.evaluateCondition(condition, torrent);
        expect(result).toBe(false);
      });
    });
  });

  describe('getTorrentStatus', () => {
    it('should return queued status', () => {
      const torrent = {
        download_state: null,
        download_finished: false,
        active: false,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('queued');
    });

    it('should return failed status', () => {
      const torrent = {
        download_state: 'failed - connection error',
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('failed');
    });

    it('should return stalled status', () => {
      const torrent = {
        download_state: 'stalled - no peers available',
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('stalled');
    });

    it('should return metadl status', () => {
      const torrent = {
        download_state: 'metadl - downloading metadata',
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('metadl');
    });

    it('should return checking_resume_data status', () => {
      const torrent = {
        download_state: 'checkingresumedata - verifying files',
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('checking_resume_data');
    });

    it('should return completed status', () => {
      const torrent = {
        download_finished: true,
        download_present: true,
        active: false,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('completed');
    });

    it('should return downloading status', () => {
      const torrent = {
        active: true,
        download_finished: false,
        download_present: false,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('downloading');
    });

    it('should return seeding status', () => {
      const torrent = {
        download_finished: true,
        download_present: true,
        active: true,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('seeding');
    });

    it('should return uploading status', () => {
      const torrent = {
        download_finished: true,
        download_present: false,
        active: true,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('uploading');
    });

    it('should return inactive status', () => {
      const torrent = {
        active: false,
        download_present: false,
        download_finished: true, // Must have finished to not be queued
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('inactive');
    });

    it('should return unknown status for unrecognized state', () => {
      const torrent = {
        active: true,
        download_finished: false,
        download_present: true,
      };

      const status = ruleEvaluator.getTorrentStatus(torrent);
      expect(status).toBe('unknown');
    });
  });

  describe('calculateAverageSpeed', () => {
    it('should calculate average speed correctly', () => {
      const samples = [
        { timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), total_downloaded: 0 },
        { timestamp: new Date().toISOString(), total_downloaded: 1024 * 1024 * 3600 }, // 1 MB/s over 1 hour
      ];

      const speed = ruleEvaluator.calculateAverageSpeed(samples, 'total_downloaded');
      expect(speed).toBeCloseTo(1024 * 1024, 0); // ~1 MB/s
    });

    it('should return 0 for insufficient samples', () => {
      const speed1 = ruleEvaluator.calculateAverageSpeed([], 'total_downloaded');
      expect(speed1).toBe(0);

      const speed2 = ruleEvaluator.calculateAverageSpeed(
        [{ timestamp: new Date().toISOString() }],
        'total_downloaded'
      );
      expect(speed2).toBe(0);
    });

    it('should return 0 when time delta is zero', () => {
      const now = new Date().toISOString();
      const samples = [
        { timestamp: now, total_downloaded: 0 },
        { timestamp: now, total_downloaded: 1000 },
      ];

      const speed = ruleEvaluator.calculateAverageSpeed(samples, 'total_downloaded');
      expect(speed).toBe(0);
    });
  });

  describe('calculateMaxSpeed', () => {
    it('should calculate max speed correctly', () => {
      const now = Date.now();
      const samples = [
        { timestamp: new Date(now - 3000).toISOString(), total_downloaded: 0 },
        { timestamp: new Date(now - 2000).toISOString(), total_downloaded: 5 * 1024 * 1024 }, // 5 MB/s
        { timestamp: new Date(now - 1000).toISOString(), total_downloaded: 8 * 1024 * 1024 }, // 3 MB/s
        { timestamp: new Date(now).toISOString(), total_downloaded: 10 * 1024 * 1024 }, // 2 MB/s
      ];

      const maxSpeed = ruleEvaluator.calculateMaxSpeed(samples, 'total_downloaded');
      expect(maxSpeed).toBeCloseTo(5 * 1024 * 1024, 0); // Max is 5 MB/s
    });

    it('should return 0 for insufficient samples', () => {
      const speed1 = ruleEvaluator.calculateMaxSpeed([], 'total_downloaded');
      expect(speed1).toBe(0);

      const speed2 = ruleEvaluator.calculateMaxSpeed(
        [{ timestamp: new Date().toISOString() }],
        'total_downloaded'
      );
      expect(speed2).toBe(0);
    });
  });

  describe('compareValues', () => {
    it('should compare values with gt operator', () => {
      expect(ruleEvaluator.compareValues(10, 'gt', 5)).toBe(true);
      expect(ruleEvaluator.compareValues(5, 'gt', 10)).toBe(false);
    });

    it('should compare values with lt operator', () => {
      expect(ruleEvaluator.compareValues(5, 'lt', 10)).toBe(true);
      expect(ruleEvaluator.compareValues(10, 'lt', 5)).toBe(false);
    });

    it('should compare values with gte operator', () => {
      expect(ruleEvaluator.compareValues(10, 'gte', 10)).toBe(true);
      expect(ruleEvaluator.compareValues(10, 'gte', 5)).toBe(true);
      expect(ruleEvaluator.compareValues(5, 'gte', 10)).toBe(false);
    });

    it('should compare values with lte operator', () => {
      expect(ruleEvaluator.compareValues(10, 'lte', 10)).toBe(true);
      expect(ruleEvaluator.compareValues(5, 'lte', 10)).toBe(true);
      expect(ruleEvaluator.compareValues(10, 'lte', 5)).toBe(false);
    });

    it('should compare values with eq operator', () => {
      expect(ruleEvaluator.compareValues(10, 'eq', 10)).toBe(true);
      expect(ruleEvaluator.compareValues(10, 'eq', 5)).toBe(false);
    });

    it('should return false for unknown operator', () => {
      expect(ruleEvaluator.compareValues(10, 'unknown', 5)).toBe(false);
    });
  });

  describe('executeAction', () => {
    it('should execute stop_seeding action', async () => {
      const action = { type: 'stop_seeding' };
      const torrent = { id: 'torrent-1' };

      await ruleEvaluator.executeAction(action, torrent);

      expect(mockApiClient.controlTorrent).toHaveBeenCalledWith('torrent-1', 'stop_seeding');
    });

    it('should execute force_start action', async () => {
      const action = { type: 'force_start' };
      const torrent = { id: 'torrent-1' };

      await ruleEvaluator.executeAction(action, torrent);

      expect(mockApiClient.controlTorrent).toHaveBeenCalledWith('torrent-1', 'force_start');
    });

    it('should execute archive action', async () => {
      const action = { type: 'archive' };
      const torrent = {
        id: 'torrent-1',
        hash: 'abc123',
        name: 'test',
        tracker: 'http://tracker.example.com',
      };

      await ruleEvaluator.executeAction(action, torrent);

      // Verify database was checked for existing archive (SELECT query)
      expect(mockUserDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM archived_downloads WHERE torrent_id = ?')
      );
      expect(mockUserDb._mockGet).toHaveBeenCalledWith('torrent-1');

      // Verify database insert was called
      expect(mockUserDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO archived_downloads')
      );
      expect(mockUserDb._mockRun).toHaveBeenCalledWith(
        'torrent-1',
        'abc123',
        'http://tracker.example.com',
        'test'
      );

      // Verify torrent was deleted after archiving
      expect(mockApiClient.deleteTorrent).toHaveBeenCalledWith('torrent-1');
    });

    it('should skip archive if already archived', async () => {
      const action = { type: 'archive' };
      const torrent = {
        id: 'torrent-1',
        hash: 'abc123',
        name: 'test',
        tracker: 'http://tracker.example.com',
      };

      // Mock existing archive - modify the mock implementation to return an existing archive
      // The default mockGet returns null, so we override it for this test
      mockUserDb._mockGet.mockImplementation(() => ({ id: 1 }));

      const result = await ruleEvaluator.executeAction(action, torrent);

      expect(result).toEqual({ success: true, message: 'Already archived' });
      expect(mockApiClient.deleteTorrent).not.toHaveBeenCalled();
      // Verify that prepare was called for the SELECT query
      expect(mockUserDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM archived_downloads WHERE torrent_id = ?')
      );
      // Verify get() was called with the torrent id
      expect(mockUserDb._mockGet).toHaveBeenCalledWith('torrent-1');
    });

    it('should throw error when archive action missing required fields', async () => {
      const action = { type: 'archive' };
      const torrent = { id: 'torrent-1' }; // Missing hash

      await expect(ruleEvaluator.executeAction(action, torrent)).rejects.toThrow(
        'torrent id and hash are required'
      );
    });

    it('should execute delete action', async () => {
      const action = { type: 'delete' };
      const torrent = { id: 'torrent-1' };

      await ruleEvaluator.executeAction(action, torrent);

      expect(mockApiClient.deleteTorrent).toHaveBeenCalledWith('torrent-1');
    });

    it('should throw error when action is missing', async () => {
      await expect(ruleEvaluator.executeAction(null, { id: 'torrent-1' })).rejects.toThrow(
        'Action is required'
      );
    });

    it('should throw error when action type is missing', async () => {
      const action = {};
      await expect(ruleEvaluator.executeAction(action, { id: 'torrent-1' })).rejects.toThrow(
        'Action type is required'
      );
    });

    it('should throw error for unknown action type', async () => {
      const action = { type: 'unknown_action' };
      const torrent = { id: 'torrent-1' };

      await expect(ruleEvaluator.executeAction(action, torrent)).rejects.toThrow(
        'Unknown action type: unknown_action'
      );
    });

    it('should execute add_tag action', async () => {
      const action = { type: 'add_tag', tagIds: [1, 2] };
      const torrent = { id: 'torrent-1' };

      // Mock tag validation
      mockUserDb._mockAll.mockReturnValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await ruleEvaluator.executeAction(action, torrent);

      expect(result).toEqual({ success: true, message: 'Added 2 tag(s) to download' });
      expect(mockUserDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM tags WHERE id IN')
      );
      expect(mockUserDb._mockTransaction).toHaveBeenCalled();
    });

    it('should throw error for add_tag with invalid tagIds', async () => {
      const action = { type: 'add_tag', tagIds: [] };
      const torrent = { id: 'torrent-1' };

      await expect(ruleEvaluator.executeAction(action, torrent)).rejects.toThrow(
        'tagIds must be a non-empty array'
      );
    });

    it('should throw error for add_tag with non-existent tags', async () => {
      const action = { type: 'add_tag', tagIds: [1, 2] };
      const torrent = { id: 'torrent-1' };

      // Mock tag validation - only one tag exists
      mockUserDb._mockAll.mockReturnValueOnce([{ id: 1 }]);

      await expect(ruleEvaluator.executeAction(action, torrent)).rejects.toThrow(
        'One or more tag IDs are invalid'
      );
    });

    it('should execute remove_tag action', async () => {
      const action = { type: 'remove_tag', tagIds: [1, 2] };
      const torrent = { id: 'torrent-1' };

      // Mock tag validation
      mockUserDb._mockAll.mockReturnValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await ruleEvaluator.executeAction(action, torrent);

      expect(result).toEqual({ success: true, message: 'Removed 2 tag(s) from download' });
      expect(mockUserDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM tags WHERE id IN')
      );
      expect(mockUserDb._mockTransaction).toHaveBeenCalled();
    });

    it('should throw error for remove_tag with invalid tagIds', async () => {
      const action = { type: 'remove_tag', tagIds: [] };
      const torrent = { id: 'torrent-1' };

      await expect(ruleEvaluator.executeAction(action, torrent)).rejects.toThrow(
        'tagIds must be a non-empty array'
      );
    });
  });

  describe('hasTagsCondition', () => {
    it('should return true for flat structure with TAGS condition', () => {
      const rule = {
        conditions: [
          { type: 'PROGRESS', operator: 'gte', value: 50 },
          { type: 'TAGS', operator: 'has_any', value: [1, 2] },
        ],
      };

      const result = ruleEvaluator.hasTagsCondition(rule);
      expect(result).toBe(true);
    });

    it('should return false for flat structure without TAGS condition', () => {
      const rule = {
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };

      const result = ruleEvaluator.hasTagsCondition(rule);
      expect(result).toBe(false);
    });

    it('should return true for group structure with TAGS condition', () => {
      const rule = {
        groups: [
          {
            conditions: [{ type: 'TAGS', operator: 'has_any', value: [1, 2] }],
          },
        ],
      };

      const result = ruleEvaluator.hasTagsCondition(rule);
      expect(result).toBe(true);
    });

    it('should return false for group structure without TAGS condition', () => {
      const rule = {
        groups: [
          {
            conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
          },
        ],
      };

      const result = ruleEvaluator.hasTagsCondition(rule);
      expect(result).toBe(false);
    });
  });

  describe('hasAvgSpeedCondition', () => {
    it('should return true for flat structure with AVG_DOWNLOAD_SPEED condition', () => {
      const rule = {
        conditions: [{ type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 1, hours: 1 }],
      };

      const result = ruleEvaluator.hasAvgSpeedCondition(rule);
      expect(result).toBe(true);
    });

    it('should return true for flat structure with AVG_UPLOAD_SPEED condition', () => {
      const rule = {
        conditions: [{ type: 'AVG_UPLOAD_SPEED', operator: 'gt', value: 1, hours: 1 }],
      };

      const result = ruleEvaluator.hasAvgSpeedCondition(rule);
      expect(result).toBe(true);
    });

    it('should return false for flat structure without AVG_SPEED condition', () => {
      const rule = {
        conditions: [{ type: 'PROGRESS', operator: 'gte', value: 50 }],
      };

      const result = ruleEvaluator.hasAvgSpeedCondition(rule);
      expect(result).toBe(false);
    });

    it('should return true for group structure with AVG_SPEED condition', () => {
      const rule = {
        groups: [
          {
            conditions: [{ type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 1, hours: 1 }],
          },
        ],
      };

      const result = ruleEvaluator.hasAvgSpeedCondition(rule);
      expect(result).toBe(true);
    });
  });

  describe('getMaxHoursForAvgSpeed', () => {
    it('should return maximum hours from flat structure', () => {
      const rule = {
        conditions: [
          { type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 1, hours: 2 },
          { type: 'AVG_UPLOAD_SPEED', operator: 'gt', value: 1, hours: 5 },
        ],
      };

      const result = ruleEvaluator.getMaxHoursForAvgSpeed(rule);
      // Should return 5 * 1.5 = 7.5, rounded up to 8
      expect(result).toBe(8);
    });

    it('should return maximum hours from group structure', () => {
      const rule = {
        groups: [
          {
            conditions: [{ type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 1, hours: 3 }],
          },
          {
            conditions: [{ type: 'AVG_UPLOAD_SPEED', operator: 'gt', value: 1, hours: 6 }],
          },
        ],
      };

      const result = ruleEvaluator.getMaxHoursForAvgSpeed(rule);
      // Should return 6 * 1.5 = 9
      expect(result).toBe(9);
    });

    it('should default to 1 hour when no hours specified', () => {
      const rule = {
        conditions: [{ type: 'AVG_DOWNLOAD_SPEED', operator: 'gt', value: 1 }],
      };

      const result = ruleEvaluator.getMaxHoursForAvgSpeed(rule);
      // Should return 1 * 1.5 = 1.5, rounded up to 2
      expect(result).toBe(2);
    });
  });

  describe('getAverageSpeed', () => {
    it('should calculate average speed from pre-loaded map', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const speedHistoryMap = new Map([
        [
          '1',
          [
            { timestamp: oneHourAgo.toISOString(), total_downloaded: 0 },
            { timestamp: new Date(now).toISOString(), total_downloaded: 1024 * 1024 * 3600 }, // 1 MB/s over 1 hour
          ],
        ],
      ]);

      const speed = ruleEvaluator.getAverageSpeed('1', 1, 'download', speedHistoryMap);
      expect(speed).toBeCloseTo(1024 * 1024, 0); // ~1 MB/s
    });

    it('should fallback to database query when map not provided', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

      // Mock database query
      mockUserDb._mockAll.mockReturnValueOnce([
        { timestamp: oneHourAgo, total_downloaded: 0 },
        { timestamp: new Date(now).toISOString(), total_downloaded: 1024 * 1024 * 3600 },
      ]);

      const speed = ruleEvaluator.getAverageSpeed('1', 1, 'download', null);
      expect(speed).toBeCloseTo(1024 * 1024, 0);
    });
  });

  describe('getAverageSpeedFromMap', () => {
    it('should delegate to getAverageSpeed with map', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const speedHistoryMap = new Map([
        [
          '1',
          [
            { timestamp: oneHourAgo.toISOString(), total_downloaded: 0 },
            { timestamp: new Date(now).toISOString(), total_downloaded: 1024 * 1024 * 3600 },
          ],
        ],
      ]);

      const speed = ruleEvaluator.getAverageSpeedFromMap('1', 1, 'download', speedHistoryMap);
      expect(speed).toBeCloseTo(1024 * 1024, 0);
    });
  });

  describe('validateNumericCondition', () => {
    it('should return true for valid numeric condition', () => {
      const condition = { type: 'PROGRESS', operator: 'gte', value: 50 };
      const result = ruleEvaluator.validateNumericCondition(condition, 'PROGRESS');
      expect(result).toBe(true);
    });

    it('should return false when operator is missing', () => {
      const condition = { type: 'PROGRESS', value: 50 };
      const result = ruleEvaluator.validateNumericCondition(condition, 'PROGRESS');
      expect(result).toBe(false);
    });

    it('should return false when value is missing', () => {
      const condition = { type: 'PROGRESS', operator: 'gte' };
      const result = ruleEvaluator.validateNumericCondition(condition, 'PROGRESS');
      expect(result).toBe(false);
    });

    it('should return false when operator is invalid', () => {
      const condition = { type: 'PROGRESS', operator: 'invalid', value: 50 };
      const result = ruleEvaluator.validateNumericCondition(condition, 'PROGRESS');
      expect(result).toBe(false);
    });
  });

  describe('validateStringCondition', () => {
    it('should return true for valid string condition', () => {
      const condition = { type: 'NAME', operator: 'contains', value: 'test' };
      const result = ruleEvaluator.validateStringCondition(condition, 'NAME');
      expect(result).toBe(true);
    });

    it('should return false when value is missing', () => {
      const condition = { type: 'NAME', operator: 'contains' };
      const result = ruleEvaluator.validateStringCondition(condition, 'NAME');
      expect(result).toBe(false);
    });

    it('should return false when value is empty string', () => {
      const condition = { type: 'NAME', operator: 'contains', value: '' };
      const result = ruleEvaluator.validateStringCondition(condition, 'NAME');
      expect(result).toBe(false);
    });
  });

  describe('normalizeBooleanValue', () => {
    it('should normalize true values', () => {
      expect(ruleEvaluator.normalizeBooleanValue(true)).toBe(true);
      expect(ruleEvaluator.normalizeBooleanValue(1)).toBe(true);
      expect(ruleEvaluator.normalizeBooleanValue('true')).toBe(true);
    });

    it('should normalize false values', () => {
      expect(ruleEvaluator.normalizeBooleanValue(false)).toBe(false);
      expect(ruleEvaluator.normalizeBooleanValue(0)).toBe(false);
      expect(ruleEvaluator.normalizeBooleanValue('false')).toBe(false);
      expect(ruleEvaluator.normalizeBooleanValue(null)).toBe(false);
      expect(ruleEvaluator.normalizeBooleanValue(undefined)).toBe(false);
    });
  });

  describe('evaluateBooleanCondition', () => {
    it('should evaluate is_true operator', () => {
      const condition = { operator: 'is_true' };
      expect(ruleEvaluator.evaluateBooleanCondition(true, condition)).toBe(true);
      expect(ruleEvaluator.evaluateBooleanCondition(false, condition)).toBe(false);
    });

    it('should evaluate is_false operator', () => {
      const condition = { operator: 'is_false' };
      expect(ruleEvaluator.evaluateBooleanCondition(false, condition)).toBe(true);
      expect(ruleEvaluator.evaluateBooleanCondition(true, condition)).toBe(false);
    });

    it('should evaluate numeric comparison operator', () => {
      const condition = { operator: 'eq', value: 1 };
      expect(ruleEvaluator.evaluateBooleanCondition(true, condition)).toBe(true);
      expect(ruleEvaluator.evaluateBooleanCondition(false, condition)).toBe(false);
    });

    it('should evaluate direct boolean match (backward compatibility)', () => {
      const condition = { value: true };
      expect(ruleEvaluator.evaluateBooleanCondition(true, condition)).toBe(true);
      expect(ruleEvaluator.evaluateBooleanCondition(false, condition)).toBe(false);
    });
  });

  describe('compareStringValues', () => {
    it('should compare with contains operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'contains', 'test')).toBe(true);
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'contains', 'xyz')).toBe(false);
    });

    it('should compare with not_contains operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'not_contains', 'xyz')).toBe(true);
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'not_contains', 'test')).toBe(false);
    });

    it('should compare with equals operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'equals', 'test torrent')).toBe(
        true
      );
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'equals', 'other')).toBe(false);
    });

    it('should compare with not_equals operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'not_equals', 'other')).toBe(true);
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'not_equals', 'test torrent')).toBe(
        false
      );
    });

    it('should compare with starts_with operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'starts_with', 'test')).toBe(true);
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'starts_with', 'xyz')).toBe(false);
    });

    it('should compare with ends_with operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'ends_with', 'torrent')).toBe(true);
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'ends_with', 'xyz')).toBe(false);
    });

    it('should default to contains for unknown operator', () => {
      expect(ruleEvaluator.compareStringValues('Test Torrent', 'unknown', 'test')).toBe(true);
    });
  });

  describe('isValidNumericOperator', () => {
    it('should return true for valid operators', () => {
      expect(ruleEvaluator.isValidNumericOperator('gt')).toBe(true);
      expect(ruleEvaluator.isValidNumericOperator('lt')).toBe(true);
      expect(ruleEvaluator.isValidNumericOperator('gte')).toBe(true);
      expect(ruleEvaluator.isValidNumericOperator('lte')).toBe(true);
      expect(ruleEvaluator.isValidNumericOperator('eq')).toBe(true);
    });

    it('should return false for invalid operators', () => {
      expect(ruleEvaluator.isValidNumericOperator('invalid')).toBe(false);
      expect(ruleEvaluator.isValidNumericOperator('contains')).toBe(false);
    });
  });
});

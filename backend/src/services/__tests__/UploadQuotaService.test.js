import { describe, expect, test, beforeEach } from 'bun:test';
import UploadQuotaService from '../UploadQuotaService.js';
import { UPLOAD_TIERS } from '../../config/uploadQuota.js';

function createMockMaster(overrides = {}) {
  const mock = {
    counters: { fileCount: 0, storageBytes: 0 },
    state: { tier: overrides.tier ?? UPLOAD_TIERS.LIMITED },
    getUploadTier() {
      return this.state.tier;
    },
    setUploadTier(_authId, t) {
      this.state.tier = t;
    },
    getUploadQuotaCounters() {
      return { ...this.counters };
    },
    updateUploadQuotaCounters(_authId, fileCount, storageBytes) {
      this.counters.fileCount = fileCount;
      this.counters.storageBytes = storageBytes;
    },
    adjustUploadQuotaCounters(_authId, deltaCount, deltaBytes) {
      this.counters.fileCount = Math.max(0, this.counters.fileCount + deltaCount);
      this.counters.storageBytes = Math.max(0, this.counters.storageBytes + deltaBytes);
    },
    decrementUploadCounter() {},
    getAllRegisteredAuthIds: () => [],
    ...overrides,
  };
  return mock;
}

describe('UploadQuotaService', () => {
  let service;
  let master;

  beforeEach(() => {
    master = createMockMaster();
    service = new UploadQuotaService(master);
  });

  test('isOverQuota when storage exceeds limit', () => {
    const limits = { maxFiles: 500, maxStorageBytes: 100 * 1024 * 1024 };
    expect(service.isOverQuota({ fileCount: 1, storageBytes: limits.maxStorageBytes + 1 }, limits)).toBe(
      true
    );
  });

  test('isOverQuota when file count exceeds limit', () => {
    const limits = { maxFiles: 500, maxStorageBytes: 100 * 1024 * 1024 };
    expect(service.isOverQuota({ fileCount: 501, storageBytes: 0 }, limits)).toBe(true);
  });

  test('isOverQuota when within both limits', () => {
    const limits = { maxFiles: 500, maxStorageBytes: 100 * 1024 * 1024 };
    expect(service.isOverQuota({ fileCount: 500, storageBytes: limits.maxStorageBytes }, limits)).toBe(
      false
    );
  });

  test('getUsage marks unlimited users as not over quota even when counters high', () => {
    master = createMockMaster({ tier: UPLOAD_TIERS.UNLIMITED });
    master.counters.fileCount = 9999;
    master.counters.storageBytes = 999999999;
    service = new UploadQuotaService(master);

    const usage = service.getUsage('user1');
    expect(usage.overQuota).toBe(false);
    expect(usage.tier).toBe(UPLOAD_TIERS.UNLIMITED);
  });

  test('getUsage marks limited users over quota', () => {
    master.counters.fileCount = 501;
    master.counters.storageBytes = 0;
    const usage = service.getUsage('user1');
    expect(usage.overQuota).toBe(true);
  });

  test('isDeletable rejects queued and processing uploads', () => {
    const exclude = new Set();
    expect(service.isDeletable({ id: 1, file_path: 'a.torrent', status: 'queued' }, { excludeUploadIds: exclude })).toBe(
      false
    );
    expect(
      service.isDeletable({ id: 1, file_path: 'a.torrent', status: 'processing' }, { excludeUploadIds: exclude })
    ).toBe(false);
  });

  test('isDeletable rejects excluded IDs', () => {
    const exclude = new Set([5]);
    expect(
      service.isDeletable(
        { id: 5, file_path: 'a.torrent', status: 'completed' },
        { excludeUploadIds: exclude }
      )
    ).toBe(false);
  });

  test('isDeletable allows completed file uploads', () => {
    expect(
      service.isDeletable({ id: 1, file_path: 'a.torrent', status: 'completed' }, { excludeUploadIds: new Set() })
    ).toBe(true);
  });

  test('isDeletable rejects magnet/link rows without file_path', () => {
    expect(service.isDeletable({ id: 1, file_path: null, status: 'completed' })).toBe(false);
  });

  test('onFileStaged increments storage bytes', () => {
    service.onFileStaged('user1', 1024);
    expect(master.counters.storageBytes).toBe(1024);
  });

  test('onUploadDeleted decrements count and storage', () => {
    master.counters.fileCount = 2;
    master.counters.storageBytes = 2048;
    service.onUploadDeleted('user1', 1024, true);
    expect(master.counters.fileCount).toBe(1);
    expect(master.counters.storageBytes).toBe(1024);
  });
});

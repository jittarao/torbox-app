import { describe, expect, test } from 'bun:test';
import { parseUserListSort } from '../helpers.js';

function mockReq(query = {}) {
  return { query };
}

describe('parseUserListSort', () => {
  test('defaults to created_at desc', () => {
    const result = parseUserListSort(mockReq());
    expect(result.sort).toBe('created_at');
    expect(result.sortDirection).toBe('desc');
    expect(result.orderByClause).toBe('ORDER BY ur.created_at DESC');
  });

  test('accepts asc direction', () => {
    const result = parseUserListSort(mockReq({ sort: 'key_name', sortDirection: 'asc' }));
    expect(result.sort).toBe('key_name');
    expect(result.sortDirection).toBe('asc');
    expect(result.orderByClause).toBe("ORDER BY COALESCE(ak.key_name, '') ASC");
  });

  test('accepts legacy direction query param', () => {
    const result = parseUserListSort(mockReq({ sort: 'status', direction: 'asc' }));
    expect(result.sortDirection).toBe('asc');
  });

  test('falls back for unknown sort keys', () => {
    const result = parseUserListSort(mockReq({ sort: 'db_size', sortDirection: 'asc' }));
    expect(result.sort).toBe('created_at');
    expect(result.orderByClause).toBe('ORDER BY ur.created_at ASC');
  });

  test('normalizes invalid direction to desc', () => {
    const result = parseUserListSort(mockReq({ sort: 'auth_id', sortDirection: 'sideways' }));
    expect(result.sortDirection).toBe('desc');
  });
});

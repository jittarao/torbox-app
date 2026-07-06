import { describe, expect, test } from 'bun:test';
import { matchesSidebarSearch } from '../sidebarSearch';

describe('matchesSidebarSearch', () => {
  test('matches when query is empty', () => {
    expect(matchesSidebarSearch('', 'My View')).toBe(true);
    expect(matchesSidebarSearch('  ', 'My View')).toBe(true);
  });

  test('matches case-insensitive substrings across haystacks', () => {
    expect(matchesSidebarSearch('exam', 'Example Tag')).toBe(true);
    expect(matchesSidebarSearch('tracker', 'tracker.example.com', 'other')).toBe(true);
    expect(matchesSidebarSearch('missing', 'Example Tag')).toBe(false);
  });
});

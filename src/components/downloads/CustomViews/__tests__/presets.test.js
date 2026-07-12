import { describe, expect, test } from 'bun:test';
import { createViewPresets, clonePresetFilters } from '../presets';
import { hasActiveFilters } from '../../filters/filterHelpers';
import { itemMatchesFilters } from '../../filters/filterEvaluation';

const t = (key) => key;

describe('createViewPresets', () => {
  test('returns non-empty array with unique ids', () => {
    const presets = createViewPresets(t);
    expect(presets.length).toBe(12);

    const ids = presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('each preset has active filters', () => {
    const presets = createViewPresets(t);
    for (const preset of presets) {
      expect(hasActiveFilters(preset.filters)).toBe(true);
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });

  test('active matches downloading, seeding, uploading, and stalled items', () => {
    const active = createViewPresets(t).find((preset) => preset.id === 'active');
    expect(active).toBeTruthy();

    expect(
      itemMatchesFilters(
        { active: true, download_finished: false, download_present: false },
        active.filters
      )
    ).toBe(true);
    expect(
      itemMatchesFilters(
        { active: true, download_finished: true, download_present: true },
        active.filters
      )
    ).toBe(true);
    expect(
      itemMatchesFilters(
        { download_state: 'stalledDL', active: true, download_finished: false },
        active.filters
      )
    ).toBe(true);
    expect(
      itemMatchesFilters(
        { active: false, download_finished: true, download_present: true },
        active.filters
      )
    ).toBe(false);
  });

  test('dead matches failed and inactive items', () => {
    const dead = createViewPresets(t).find((preset) => preset.id === 'dead');
    expect(dead).toBeTruthy();

    expect(
      itemMatchesFilters(
        { download_state: 'failed', active: false, download_finished: false },
        dead.filters
      )
    ).toBe(true);
    expect(
      itemMatchesFilters(
        { active: false, download_finished: true, download_present: false },
        dead.filters
      )
    ).toBe(true);
    expect(
      itemMatchesFilters(
        { active: true, download_finished: false, download_present: false },
        dead.filters
      )
    ).toBe(false);
  });

  test('cached preset matches cached downloads', () => {
    const cached = createViewPresets(t).find((preset) => preset.id === 'cached');
    expect(cached).toBeTruthy();

    expect(itemMatchesFilters({ cached: true }, cached.filters)).toBe(true);
    expect(itemMatchesFilters({ cached: false }, cached.filters)).toBe(false);
  });

  test('expiring preset matches completed downloads expiring within 7 days', () => {
    const expiring = createViewPresets(t).find((preset) => preset.id === 'expiring');
    expect(expiring).toBeTruthy();

    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const completedItem = {
      active: false,
      download_finished: true,
      download_present: true,
    };

    expect(
      itemMatchesFilters({ ...completedItem, expires_at: threeDaysFromNow }, expiring.filters)
    ).toBe(true);
    expect(
      itemMatchesFilters({ ...completedItem, expires_at: tenDaysFromNow }, expiring.filters)
    ).toBe(false);
    expect(
      itemMatchesFilters(
        {
          active: true,
          download_finished: false,
          download_present: false,
          expires_at: threeDaysFromNow,
        },
        expiring.filters
      )
    ).toBe(false);
  });

  test('untagged preset matches items without tags', () => {
    const untagged = createViewPresets(t).find((preset) => preset.id === 'untagged');
    expect(untagged).toBeTruthy();

    expect(itemMatchesFilters({ tags: [] }, untagged.filters)).toBe(true);
    expect(itemMatchesFilters({ tags: [{ id: 1, name: 'a' }] }, untagged.filters)).toBe(false);
  });

  test('largeFiles preset matches items over 10 GB', () => {
    const largeFiles = createViewPresets(t).find((preset) => preset.id === 'largeFiles');
    expect(largeFiles).toBeTruthy();

    const tenGbBytes = 10 * 1024 * 1024 * 1024;
    expect(itemMatchesFilters({ size: tenGbBytes + 1 }, largeFiles.filters)).toBe(true);
    expect(itemMatchesFilters({ size: tenGbBytes }, largeFiles.filters)).toBe(false);
  });
});

describe('clonePresetFilters', () => {
  test('deep-clones filters without mutating preset definition', () => {
    const preset = createViewPresets(t)[0];
    const cloned = clonePresetFilters(preset);

    cloned.groups[0].filters[0].value = ['mutated'];
    expect(preset.filters.groups[0].filters[0].value).not.toEqual(['mutated']);
  });
});

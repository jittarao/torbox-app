import { describe, expect, test } from 'bun:test';
import {
  FILTER_FIELD_DEFINITIONS,
  GROUP_ORDER,
  getGroupedFilterFields,
  getColumnKeyForConditionType,
  getConditionTypeForColumnKey,
  getFieldByColumnKey,
} from '../filterFieldRegistry';
import { CONDITION_TYPES } from '@/components/downloads/AutomationRules/constants';

const automationT = (key) => {
  const map = {
    'conditionGroups.lifecycle': 'Lifecycle',
    'conditionGroups.seeding': 'Seeding',
    'conditionGroups.downloading': 'Downloading',
    'conditionGroups.stalled': 'Stalled',
    'conditionGroups.metadata': 'Metadata',
    'conditions.status': 'Status',
    'conditions.isActive': 'Is Active',
    'conditions.age': 'Age',
    'conditions.fileSize': 'File Size',
    'conditions.totalDownloaded': 'Total Downloaded',
  };
  return map[key] ?? key;
};

describe('filterFieldRegistry', () => {
  test('shared fields map between condition types and column keys', () => {
    expect(getColumnKeyForConditionType(CONDITION_TYPES.STATUS)).toBe('download_state');
    expect(getConditionTypeForColumnKey('download_state')).toBe(CONDITION_TYPES.STATUS);
    expect(getColumnKeyForConditionType(CONDITION_TYPES.FILE_SIZE)).toBe('size');
    expect(getColumnKeyForConditionType(CONDITION_TYPES.TOTAL_DOWNLOADED)).toBe('total_downloaded');
  });

  test('custom-view-only fields have no condition type', () => {
    expect(getFieldByColumnKey('is_downloaded')?.customView).toBe(true);
    expect(getFieldByColumnKey('is_downloaded')?.automation).toBe(false);
    expect(getFieldByColumnKey('is_downloaded')?.group).toBe('metadata');
    expect(getConditionTypeForColumnKey('is_downloaded')).toBeNull();
  });

  test('is airlocked and downloaded appear in metadata group', () => {
    const cvMetadata = getGroupedFilterFields('customView', { automationT }).find(
      (g) => g.label === 'Metadata'
    );
    const values = cvMetadata.options.map((o) => o.value);
    expect(values).toContain('airlocked');
    expect(values).toContain('is_downloaded');
    expect(values.indexOf('allow_zip')).toBeLessThan(values.indexOf('airlocked'));
    expect(values.indexOf('airlocked')).toBeLessThan(values.indexOf('is_downloaded'));
  });

  test('automation-only telemetry fields are excluded from custom views', () => {
    expect(getFieldByColumnKey('download_stalled_time')?.automation).toBe(true);
    expect(getFieldByColumnKey('download_stalled_time')?.customView).toBe(false);

    const cvGroups = getGroupedFilterFields('customView', { automationT });
    const cvGroupIds = cvGroups.map((g) => g.label);
    expect(cvGroupIds).not.toContain('Stalled');
  });

  test('custom view and automation share lifecycle field order for shared fields', () => {
    const cvLifecycle = getGroupedFilterFields('customView', { automationT }).find(
      (g) => g.label === 'Lifecycle'
    );
    const arLifecycle = getGroupedFilterFields('automation', { automationT }).find(
      (g) => g.label === 'Lifecycle'
    );

    const sharedCv = cvLifecycle.options
      .map((o) => getConditionTypeForColumnKey(o.value))
      .filter(Boolean);
    const ar = arLifecycle.options.map((o) => o.value);

    expect(sharedCv).toEqual(ar);
  });

  test('torrent-only fields hidden on usenet tab in custom views', () => {
    const torrentGroups = getGroupedFilterFields('customView', {
      activeType: 'torrents',
      automationT,
    });
    const usenetGroups = getGroupedFilterFields('customView', {
      activeType: 'usenet',
      automationT,
    });

    const torrentValues = torrentGroups.flatMap((g) => g.options.map((o) => o.value));
    const usenetValues = usenetGroups.flatMap((g) => g.options.map((o) => o.value));

    expect(torrentValues).toContain('seeds');
    expect(usenetValues).not.toContain('seeds');
    expect(usenetValues).toContain('age');
  });

  test('definitions use canonical group order', () => {
    const groupsInDefs = [...new Set(FILTER_FIELD_DEFINITIONS.map((d) => d.group))];
    expect(groupsInDefs).toEqual(GROUP_ORDER);
  });
});

'use client';

import { CONDITION_TYPES } from '../constants';
import { tagOperatorNeedsTagSelection } from '@/components/downloads/filters/tagFilterHelpers';
import {
  isBooleanCondition,
  isStringCondition,
  isSpeedAverageCondition,
  getConditionUnit,
} from '../utils';
import Select from '@/components/shared/Select';
import MultiSelect from '@/components/shared/MultiSelect';
import { STATUS_OPTIONS } from '@/components/constants';

const getStatusOptions = () => {
  const labelToValue = {
    Queued: 'queued',
    Downloading: 'downloading',
    Seeding: 'seeding',
    Completed: 'completed',
    Uploading: 'uploading',
    Stalled: 'stalled',
    Inactive: 'inactive',
    Failed: 'failed',
  };
  return STATUS_OPTIONS.reduce((acc, opt) => {
    if (
      opt.hidden ||
      opt.label === 'All' ||
      opt.label === 'Meta_DL' ||
      opt.label === 'Checking_Resume_Data'
    )
      return acc;
    acc.push({
      label: opt.label,
      value: labelToValue[opt.label] || opt.label.toLowerCase().replace(/\s+/g, '_'),
    });
    return acc;
  }, []);
};

export default function ConditionFilterValueInput({ condition, onFieldChange, tagOptions, t }) {
  if (!condition.type) return null;

  if (condition.type === CONDITION_TYPES.STATUS) {
    const statusValue = Array.isArray(condition.value) ? condition.value : [];
    return (
      <MultiSelect
        value={statusValue}
        onChange={(values) => onFieldChange('value', values)}
        options={getStatusOptions()}
        placeholder={t('conditions.statusPlaceholder')}
        className="w-full sm:flex-1 sm:min-w-[150px]"
      />
    );
  }

  if (condition.type === CONDITION_TYPES.TAGS) {
    if (!tagOperatorNeedsTagSelection(condition.operator)) return null;
    const tagsValue = Array.isArray(condition.value) ? condition.value : [];
    return (
      <MultiSelect
        value={tagsValue}
        onChange={(values) => onFieldChange('value', values)}
        options={tagOptions}
        placeholder={t('conditions.tagsPlaceholder')}
        className="w-full sm:flex-1 sm:min-w-[150px]"
      />
    );
  }

  if (isBooleanCondition(condition.type)) {
    return (
      <Select
        value={
          condition.value === true || condition.value === 'true' || condition.value === 1
            ? 'true'
            : 'false'
        }
        onChange={(e) => onFieldChange('value', e.target.value === 'true')}
        className="w-full sm:min-w-[100px] sm:w-auto"
      >
        <option value="true">{t('booleanValues.true')}</option>
        <option value="false">{t('booleanValues.false')}</option>
      </Select>
    );
  }

  if (isStringCondition(condition.type)) {
    return (
      <input
        type="text"
        value={condition.value || ''}
        onChange={(e) => onFieldChange('value', e.target.value)}
        placeholder={
          condition.type === CONDITION_TYPES.NAME
            ? t('conditions.namePlaceholder')
            : condition.type === CONDITION_TYPES.ORIGINAL_URL
              ? t('conditions.originalUrlPlaceholder')
              : t('conditions.trackerPlaceholder')
        }
        className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 w-full sm:flex-1 sm:min-w-[120px]">
        <input
          type="number"
          value={condition.value ?? ''}
          onChange={(e) => onFieldChange('value', parseFloat(e.target.value) || 0)}
          aria-label={t('conditions.value')}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
          min="0"
          step={
            condition.type === CONDITION_TYPES.RATIO ||
            condition.type === CONDITION_TYPES.AVAILABILITY
              ? '0.1'
              : '1'
          }
        />
        {getConditionUnit(condition.type) && (
          <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap flex-shrink-0">
            {getConditionUnit(condition.type)}
          </span>
        )}
      </div>
      {isSpeedAverageCondition(condition.type) && (
        <>
          <span className="text-sm text-primary-text dark:text-primary-text-dark whitespace-nowrap">
            {t('conditions.calculatedOver')}
          </span>
          <input
            type="number"
            value={condition.hours || 1}
            onChange={(e) => onFieldChange('hours', Math.max(1, parseInt(e.target.value) || 1))}
            aria-label={t('conditions.hours')}
            className="w-20 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            min="1"
            max="24"
            step="1"
          />
          <span className="text-sm text-primary-text dark:text-primary-text-dark whitespace-nowrap">
            {t('conditions.hours')}
          </span>
        </>
      )}
    </>
  );
}

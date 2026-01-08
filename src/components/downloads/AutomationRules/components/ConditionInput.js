'use client';

import { 
  CONDITION_TYPES, 
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
} from '../constants';
import { 
  isTimeBasedCondition, 
  isTimestampBasedCondition,
  isBooleanCondition,
  isStringCondition,
  isSpeedAverageCondition,
  getConditionUnit 
} from '../utils';
import Select from '@/components/shared/Select';
import MultiSelect from '@/components/shared/MultiSelect';
import { STATUS_OPTIONS } from '@/components/constants';

// Map STATUS_OPTIONS labels to backend status values
const getStatusOptions = () => {
  return STATUS_OPTIONS
    .filter(opt => !opt.hidden && opt.label !== 'All' && opt.label !== 'Meta_DL' && opt.label !== 'Checking_Resume_Data')
    .map(opt => {
      // Map label to backend status value (lowercase, snake_case)
      const labelToValue = {
        'Queued': 'queued',
        'Downloading': 'downloading',
        'Seeding': 'seeding',
        'Completed': 'completed',
        'Uploading': 'uploading',
        'Stalled': 'stalled',
        'Inactive': 'inactive',
        'Failed': 'failed',
      };
      return {
        label: opt.label,
        value: labelToValue[opt.label] || opt.label.toLowerCase().replace(/\s+/g, '_'),
      };
    });
};

export default function ConditionInput({ 
  condition, 
  index, 
  totalConditions,
  onUpdate, 
  onRemove,
  t 
}) {
  const handleFieldChange = (field, value) => {
    // When changing condition type, update operator and value to appropriate defaults
    if (field === 'type') {
      if (value === CONDITION_TYPES.STATUS) {
        // STATUS conditions use status operators
        onUpdate(index, 'type', value);
        onUpdate(index, 'operator', MULTI_SELECT_OPERATORS.IS_ANY_OF);
        onUpdate(index, 'value', []);
      } else if (isBooleanCondition(value)) {
        // Boolean conditions - set operator based on default value
        onUpdate(index, 'type', value);
        onUpdate(index, 'operator', BOOLEAN_OPERATORS.IS_TRUE);
        onUpdate(index, 'value', true);
      } else if (isStringCondition(value)) {
        // String conditions use string operators
        onUpdate(index, 'type', value);
        onUpdate(index, 'operator', STRING_OPERATORS.CONTAINS);
        onUpdate(index, 'value', '');
      } else {
        // Other conditions use comparison operators
        onUpdate(index, 'type', value);
        onUpdate(index, 'operator', COMPARISON_OPERATORS.GT);
        onUpdate(index, 'value', isTimeBasedCondition(value) || isTimestampBasedCondition(value) ? 0 : 1);
        // Initialize hours for speed average conditions
        if (isSpeedAverageCondition(value)) {
          onUpdate(index, 'hours', 1);
        }
      }
    } else if (field === 'value' && isBooleanCondition(condition.type)) {
      // For boolean conditions, automatically update operator based on value
      const boolValue = value === true || value === 'true' || value === 1;
      onUpdate(index, 'value', boolValue);
      onUpdate(index, 'operator', boolValue ? BOOLEAN_OPERATORS.IS_TRUE : BOOLEAN_OPERATORS.IS_FALSE);
    } else {
      onUpdate(index, field, value);
    }
  };

  // For STATUS condition, ensure value is an array
  const getStatusValue = () => {
    if (condition.type !== CONDITION_TYPES.STATUS) return condition.value;
    return Array.isArray(condition.value) ? condition.value : [];
  };

  return (
    <div className="mb-3 p-3 border border-border dark:border-border-dark rounded-md">
      {/* Condition Header */}
      <div className="flex items-center justify-between mb-2">
        {/* Condition Index */}
        <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
          Condition {index + 1}
        </span>
        {/* Remove Button */}
        {totalConditions > 1 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-red-500 hover:text-red-400"
          >
            Remove
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Condition Type Selector */}
        <Select
          value={condition.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          className="flex-1 min-w-[140px]"
        >
          <optgroup label="Lifecycle">
            <option value={CONDITION_TYPES.STATUS} title={t('conditions.statusDescription')}>
              {t('conditions.status')}
            </option>
            <option value={CONDITION_TYPES.IS_ACTIVE} title={t('conditions.isActiveDescription')}>
              {t('conditions.isActive')}
            </option>
            <option value={CONDITION_TYPES.EXPIRES_AT} title={t('conditions.expiresAtDescription')}>
              {t('conditions.expiresAt')}
            </option>
          </optgroup>
          <optgroup label="Seeding">
            <option value={CONDITION_TYPES.RATIO} title={t('conditions.seedingRatioDescription')}>
              {t('conditions.seedingRatio')}
            </option>
            <option value={CONDITION_TYPES.SEEDING_ENABLED} title={t('conditions.seedingEnabledDescription')}>
              {t('conditions.seedingEnabled')}
            </option>
            <option value={CONDITION_TYPES.SEEDING_TIME} title={t('conditions.seedingTimeDescription')}>
              {t('conditions.seedingTime')}
            </option>
            <option value={CONDITION_TYPES.SEEDS} title={t('conditions.seedsDescription')}>
              {t('conditions.seeds')}
            </option>
            <option value={CONDITION_TYPES.PEERS} title={t('conditions.peersDescription')}>
              {t('conditions.peers')}
            </option>
            <option value={CONDITION_TYPES.LONG_TERM_SEEDING} title={t('conditions.longTermSeedingDescription')}>
              {t('conditions.longTermSeeding')}
            </option>
            <option value={CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT} title={t('conditions.lastUploadActivityDescription')}>
              {t('conditions.lastUploadActivity')}
            </option>
            <option value={CONDITION_TYPES.TOTAL_UPLOADED} title={t('conditions.totalUploadedDescription')}>
              {t('conditions.totalUploaded')}
            </option>
            <option value={CONDITION_TYPES.UPLOAD_SPEED} title={t('conditions.uploadSpeedDescription')}>
              {t('conditions.uploadSpeed')}
            </option>
            <option value={CONDITION_TYPES.AVG_UPLOAD_SPEED} title={t('conditions.avgUploadSpeedDescription')}>
              {t('conditions.avgUploadSpeed')}
            </option>
          </optgroup>
          <optgroup label="Downloading">
            <option value={CONDITION_TYPES.ETA} title={t('conditions.etaDescription')}>
              {t('conditions.eta')}
            </option>
            <option value={CONDITION_TYPES.PROGRESS} title={t('conditions.progressDescription')}>
              {t('conditions.progress')}
            </option>
            <option value={CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT} title={t('conditions.lastDownloadActivityDescription')}>
              {t('conditions.lastDownloadActivity')}
            </option>
            <option value={CONDITION_TYPES.DOWNLOAD_SPEED} title={t('conditions.downloadSpeedDescription')}>
              {t('conditions.downloadSpeed')}
            </option>
            <option value={CONDITION_TYPES.AVG_DOWNLOAD_SPEED} title={t('conditions.avgDownloadSpeedDescription')}>
              {t('conditions.avgDownloadSpeed')}
            </option>
          </optgroup>
          <optgroup label="Stalled">
            <option value={CONDITION_TYPES.DOWNLOAD_STALLED_TIME} title={t('conditions.downloadStalledTimeDescription')}>
              {t('conditions.downloadStalledTime')}
            </option>
            <option value={CONDITION_TYPES.UPLOAD_STALLED_TIME} title={t('conditions.uploadStalledTimeDescription')}>
              {t('conditions.uploadStalledTime')}
            </option>
          </optgroup>
          <optgroup label="Metadata">
            <option value={CONDITION_TYPES.AGE} title={t('conditions.ageDescription')}>
              {t('conditions.age')}
            </option>
            <option value={CONDITION_TYPES.TRACKER} title={t('conditions.trackerDescription')}>
              {t('conditions.tracker')}
            </option>
            <option value={CONDITION_TYPES.AVAILABILITY} title={t('conditions.availabilityDescription')}>
              {t('conditions.availability')}
            </option>
            <option value={CONDITION_TYPES.FILE_SIZE} title={t('conditions.fileSizeDescription')}>
              {t('conditions.fileSize')}
            </option>
            <option value={CONDITION_TYPES.FILE_COUNT} title={t('conditions.fileCountDescription')}>
              {t('conditions.fileCount')}
            </option>
            <option value={CONDITION_TYPES.NAME} title={t('conditions.nameDescription')}>
              {t('conditions.name')}
            </option>
            <option value={CONDITION_TYPES.PRIVATE} title={t('conditions.privateDescription')}>
              {t('conditions.private')}
            </option>
            <option value={CONDITION_TYPES.CACHED} title={t('conditions.cachedDescription')}>
              {t('conditions.cached')}
            </option>
            <option value={CONDITION_TYPES.ALLOW_ZIP} title={t('conditions.allowZipDescription')}>
              {t('conditions.allowZip')}
            </option>
          </optgroup>
        </Select>

        {/* Operator Selector - Hidden for boolean conditions */}
        {!isBooleanCondition(condition.type) && (
          <Select
            value={condition.operator}
            onChange={(e) => handleFieldChange('operator', e.target.value)}
            className="min-w-[100px]"
          >
            {condition.type === CONDITION_TYPES.STATUS ? (
              <>
                <option value={MULTI_SELECT_OPERATORS.IS_ANY_OF}>
                  {t('multiSelectOperators.isAnyOf')}
                </option>
                <option value={MULTI_SELECT_OPERATORS.IS_NONE_OF}>
                  {t('multiSelectOperators.isNoneOf')}
                </option>
              </>
            ) : isStringCondition(condition.type) ? (
            <>
              <option value={STRING_OPERATORS.EQUALS}>
                {t('stringOperators.equals')}
              </option>
              <option value={STRING_OPERATORS.CONTAINS}>
                {t('stringOperators.contains')}
              </option>
              <option value={STRING_OPERATORS.STARTS_WITH}>
                {t('stringOperators.startsWith')}
              </option>
              <option value={STRING_OPERATORS.ENDS_WITH}>
                {t('stringOperators.endsWith')}
              </option>
              <option value={STRING_OPERATORS.NOT_EQUALS}>
                {t('stringOperators.notEquals')}
              </option>
              <option value={STRING_OPERATORS.NOT_CONTAINS}>
                {t('stringOperators.notContains')}
              </option>
            </>
          ) : isTimeBasedCondition(condition.type) ? (
            <>
              <option value={COMPARISON_OPERATORS.GT}>
                {t('timeOperators.gt')}
              </option>
              <option value={COMPARISON_OPERATORS.LT}>
                {t('timeOperators.lt')}
              </option>
              <option value={COMPARISON_OPERATORS.GTE}>
                {t('timeOperators.gte')}
              </option>
              <option value={COMPARISON_OPERATORS.LTE}>
                {t('timeOperators.lte')}
              </option>
              <option value={COMPARISON_OPERATORS.EQ}>
                {t('timeOperators.eq')}
              </option>
            </>
          ) : isTimestampBasedCondition(condition.type) ? (
            <>
              <option value={COMPARISON_OPERATORS.GT}>
                {t('timestampOperators.gt')}
              </option>
              <option value={COMPARISON_OPERATORS.LT}>
                {t('timestampOperators.lt')}
              </option>
              <option value={COMPARISON_OPERATORS.GTE}>
                {t('timestampOperators.gte')}
              </option>
              <option value={COMPARISON_OPERATORS.LTE}>
                {t('timestampOperators.lte')}
              </option>
              <option value={COMPARISON_OPERATORS.EQ}>
                {t('timestampOperators.eq')}
              </option>
            </>
          ) : (
            <>
              <option value={COMPARISON_OPERATORS.GT}>
                {t('operators.gt')}
              </option>
              <option value={COMPARISON_OPERATORS.LT}>
                {t('operators.lt')}
              </option>
              <option value={COMPARISON_OPERATORS.GTE}>
                {t('operators.gte')}
              </option>
              <option value={COMPARISON_OPERATORS.LTE}>
                {t('operators.lte')}
              </option>
              <option value={COMPARISON_OPERATORS.EQ}>
                {t('operators.eq')}
              </option>
            </>
          )}
          </Select>
        )}

        {/* "is" text for boolean conditions */}
        {isBooleanCondition(condition.type) && (
          <span className="text-sm text-primary-text dark:text-primary-text-dark">
            is
          </span>
        )}

        {/* Value Input */}
        {condition.type === CONDITION_TYPES.STATUS ? (
          <MultiSelect
            value={getStatusValue()}
            onChange={(values) => handleFieldChange('value', values)}
            options={getStatusOptions()}
            placeholder={t('conditions.statusPlaceholder')}
            className="flex-1 min-w-[200px]"
          />
        ) : isBooleanCondition(condition.type) ? (
          <Select
            value={condition.value === true || condition.value === 'true' || condition.value === 1 ? 'true' : 'false'}
            onChange={(e) => handleFieldChange('value', e.target.value === 'true')}
            className="min-w-[100px]"
          >
            <option value="true">{t('booleanValues.true')}</option>
            <option value="false">{t('booleanValues.false')}</option>
          </Select>
        ) : isStringCondition(condition.type) ? (
          <input
            type="text"
            value={condition.value || ''}
            onChange={(e) => handleFieldChange('value', e.target.value)}
            placeholder={
              condition.type === CONDITION_TYPES.NAME
                ? t('conditions.namePlaceholder')
                : t('conditions.trackerPlaceholder')
            }
            className="w-64 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
          />
        ) : (
          <input
            type="number"
            value={condition.value}
            onChange={(e) => handleFieldChange('value', parseFloat(e.target.value) || 0)}
            className="w-24 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            min="0"
            step={
              condition.type === CONDITION_TYPES.RATIO || condition.type === CONDITION_TYPES.AVAILABILITY
                ? '0.1'
                : '1'
            }
          />
        )}

        {/* Unit Display */}
        <span className="text-sm text-primary-text dark:text-primary-text-dark">
          {getConditionUnit(condition.type)}
        </span>

        {/* Hours Input for Speed Average Conditions */}
        {isSpeedAverageCondition(condition.type) && (
          <>
            <span className="text-sm text-primary-text dark:text-primary-text-dark">
              {t('conditions.calculatedOver')}
            </span>
            <input
              type="number"
              value={condition.hours || 1}
              onChange={(e) => handleFieldChange('hours', Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
              min="1"
              max="24"
              step="1"
            />
            <span className="text-sm text-primary-text dark:text-primary-text-dark">
              {t('conditions.hours')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}


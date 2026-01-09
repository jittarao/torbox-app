import { COLUMNS } from '@/components/constants';
import { useTranslations } from 'next-intl';
import { 
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
} from '../AutomationRules/constants';

// Map column keys to filter types
export const COLUMN_FILTER_TYPES = {
  // Number columns
  size: 'number',
  progress: 'number',
  download_progress: 'number',
  ratio: 'number',
  file_count: 'number',
  download_speed: 'number',
  upload_speed: 'number',
  seeds: 'number',
  peers: 'number',
  total_uploaded: 'number',
  total_downloaded: 'number',
  
  // Text columns
  name: 'text',
  hash: 'text',
  original_url: 'text',
  tracker: 'text',
  
  // Time/Timestamp columns
  created_at: 'timestamp',
  cached_at: 'timestamp',
  updated_at: 'timestamp',
  expires_at: 'timestamp',
  
  // Boolean columns
  private: 'boolean',
  
  // Status/Multi-select columns
  download_state: 'status',
  asset_type: 'status',
};

// Get filter type for a column
export const getColumnFilterType = (columnKey) => {
  return COLUMN_FILTER_TYPES[columnKey] || 'number';
};

// Check if column is number type
export const isNumberColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'number';
};

// Check if column is text type
export const isTextColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'text';
};

// Check if column is timestamp type
export const isTimestampColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'timestamp';
};

// Check if column is boolean type
export const isBooleanColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'boolean';
};

// Check if column is status type
export const isStatusColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'status';
};

// Get available operators for a column type
export const getOperatorsForColumn = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);
  
  switch (filterType) {
    case 'number':
      return Object.values(COMPARISON_OPERATORS);
    case 'text':
      return Object.values(STRING_OPERATORS);
    case 'timestamp':
      return Object.values(COMPARISON_OPERATORS);
    case 'boolean':
      return Object.values(BOOLEAN_OPERATORS);
    case 'status':
      return Object.values(MULTI_SELECT_OPERATORS);
    default:
      return Object.values(COMPARISON_OPERATORS);
  }
};

// Get default operator for a column type
export const getDefaultOperator = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);
  
  switch (filterType) {
    case 'number':
      return COMPARISON_OPERATORS.GT;
    case 'text':
      return STRING_OPERATORS.CONTAINS;
    case 'timestamp':
      return COMPARISON_OPERATORS.GT;
    case 'boolean':
      return BOOLEAN_OPERATORS.IS_TRUE;
    case 'status':
      return MULTI_SELECT_OPERATORS.IS_ANY_OF;
    default:
      return COMPARISON_OPERATORS.GT;
  }
};

// Get default value for a column type
export const getDefaultValue = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);
  
  switch (filterType) {
    case 'number':
      return 0;
    case 'text':
      return '';
    case 'timestamp':
      return 0; // minutes/hours
    case 'boolean':
      return true;
    case 'status':
      return [];
    default:
      return 0;
  }
};

// Get available columns for filtering (excluding id)
export const getFilterableColumns = (activeType = 'all') => {
  // Get translations for columns
  const columnT = useTranslations('Columns');

  // Columns to exclude from filtering
  const columnKeysToExclude = ['id', 'hash', 'download_progress', 'asset_type'];

  // Return the columns that are applicable to the active type
  return Object.entries(COLUMNS)
    .filter(([key, column]) => !columnKeysToExclude.includes(key))
    .map(([key, column]) => ({
      key,
      label: column.displayName ? column.displayName : columnT(key),
      ...column,
    }));
};

// Get unit for a column (for display)
export const getColumnUnit = (columnKey) => {
  const units = {
    size: 'MB',
    progress: '%',
    ratio: '',
    file_count: '',
    download_speed: 'MB/s',
    upload_speed: 'MB/s',
    seeds: '',
    peers: '',
    total_uploaded: 'MB',
    total_downloaded: 'MB',
    created_at: 'ago',
    cached_at: 'ago',
    updated_at: 'ago',
    expires_at: 'until',
  };
  return units[columnKey] || '';
};

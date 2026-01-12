import { COLUMNS } from '@/components/constants';
import { 
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
} from '../AutomationRules/constants';
import { useTranslations } from 'next-intl';

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
  availability: 'number',
  
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
  cached: 'boolean',
  allow_zip: 'boolean',
  private: 'boolean',
  seed_torrent: 'boolean',
  
  // Status/Multi-select columns
  download_state: 'status',
  asset_type: 'status',
  
  // Tag columns
  tags: 'tags',
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

// Check if column is tags type
export const isTagsColumn = (columnKey) => {
  return getColumnFilterType(columnKey) === 'tags';
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
    case 'tags':
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
    case 'tags':
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
    case 'tags':
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
  const columnKeysToExclude = ['id', 'hash', 'download_progress'];

  // Build base columns from COLUMNS
  const baseColumns = Object.entries(COLUMNS)
    .filter(([key, column]) => !columnKeysToExclude.includes(key))
    .map(([key, column]) => ({
      key,
      label: column.displayName ? column.displayName : columnT(key),
      ...column,
    }));

  // Add tags column
  baseColumns.push({
    key: 'tags',
    label: 'Tags',
    sortable: false,
  });

  return baseColumns;
};

// Get grouped column options for filtering
// Accepts translation functions as parameters (similar to getConditionTypeOptions)
export const getGroupedFilterableColumns = (activeType = 'all', columnT, customViewsT) => {
  // Columns to exclude from filtering
  const columnKeysToExclude = ['id', 'hash', 'download_progress'];

  // Helper to get column label
  const getColumnLabel = (key, column) => {
    if (key === 'tags') return 'Tags';
    return column.displayName ? column.displayName : (columnT ? columnT(key) : key);
  };

  // Build base columns from COLUMNS
  const allColumns = Object.entries(COLUMNS)
    .filter(([key, column]) => !columnKeysToExclude.includes(key))
    .map(([key, column]) => ({
      key,
      label: getColumnLabel(key, column),
      ...column,
    }));

  // Add additional filters not in the COLUMNS object
  allColumns.push({
    key: 'availability',
    label: 'Availability',
  });
  allColumns.push({
    key: 'cached',
    label: 'Cached',
  });
  allColumns.push({
    key: 'allow_zip',
    label: 'Allow Zip',
  });
  allColumns.push({
    key: 'seed_torrent',
    label: 'Seeding Enabled',
  });

  // Create a map for quick column lookup
  const columnMap = new Map(allColumns.map(col => [col.key, col]));

  // Helper to get column option by key
  const getColumnOption = (key) => {
    const col = columnMap.get(key);
    if (!col) return null;
    return { value: col.key, label: col.label };
  };

  // Helper to get ordered options for a group
  const getOrderedOptions = (orderedKeys) => {
    return orderedKeys
      .map(key => getColumnOption(key))
      .filter(opt => opt !== null); // Filter out any keys that don't exist
  };

  // Helper to get group label with fallback
  const getGroupLabel = (key) => {
    if (customViewsT) {
      try {
        return customViewsT(`columnGroups.${key}`);
      } catch (e) {
        // Translation key doesn't exist, use fallback
      }
    }
    // Fallback labels
    const fallbacks = {
      lifecycle: 'Lifecycle',
      seeding: 'Seeding',
      downloading: 'Downloading',
      timestamps: 'Timestamps',
      metadata: 'Metadata',
    };
    return fallbacks[key] || key;
  };

  // Group columns by category with explicit ordering
  const groups = [
    {
      label: getGroupLabel('lifecycle'),
      // Order: download_state, asset_type
      options: getOrderedOptions(['download_state', 'asset_type']),
    },
    {
      label: getGroupLabel('seeding'),
      // Order: ratio, seeds, peers, upload_speed, total_uploaded, seeding_enabled
      options: getOrderedOptions(['ratio', 'seed_torrent','seeds', 'peers', 'upload_speed', 'total_uploaded']),
    },
    {
      label: getGroupLabel('downloading'),
      // Order: progress, download_speed, eta, total_downloaded
      options: getOrderedOptions(['eta', 'progress', 'download_speed', 'total_downloaded']),
    },
    {
      label: getGroupLabel('metadata'),
      // Order: name, size, file_count, tags, tracker, availability, private, cached, allow_zip
      options: getOrderedOptions(['tracker', 'availability', 'size', 'file_count', 'name', 'private', 'cached', 'allow_zip', 'tags']),
    },
    {
      label: getGroupLabel('timestamps'),
      // Order: created_at, updated_at, cached_at, expires_at
      options: getOrderedOptions(['created_at', 'updated_at', 'cached_at', 'expires_at']),
    },
  ];

  // Filter out empty groups
  return groups.filter(group => group.options.length > 0);
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
    created_at: 'days ago',
    cached_at: 'days ago',
    updated_at: 'days ago',
    expires_at: 'hours until expiration',
  };
  return units[columnKey] || '';
};

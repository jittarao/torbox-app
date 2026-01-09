import { CONDITION_TYPES, MULTI_SELECT_OPERATORS, LOGIC_OPERATORS } from './constants';

export const createPresetRules = (t) => [
  {
    name: t('presets.deleteInactive'),
    trigger: { type: 'interval', value: 30 },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          { type: CONDITION_TYPES.STATUS, operator: MULTI_SELECT_OPERATORS.IS_ANY_OF, value: ['inactive'] }
        ]
      }
    ],
    action: { type: 'delete' }
  },
  {
    name: t('presets.deleteStalled'),
    trigger: { type: 'interval', value: 30 },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          { type: CONDITION_TYPES.DOWNLOAD_STALLED_TIME, operator: 'gt', value: 60 }
        ]
      }
    ],
    action: { type: 'delete' }
  },
  {
    name: t('presets.deleteQueued'),
    trigger: { type: 'interval', value: 30 },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          { type: CONDITION_TYPES.STATUS, operator: MULTI_SELECT_OPERATORS.IS_ANY_OF, value: ['queued'] },
          { type: CONDITION_TYPES.AGE, operator: 'gt', value: 6 }
        ]
      }
    ],
    action: { type: 'delete' }
  },
  {
    name: t('presets.stopSeedingLowRatio'),
    trigger: { type: 'interval', value: 30 },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          { type: CONDITION_TYPES.RATIO, operator: 'gt', value: 1 },
          { type: CONDITION_TYPES.SEEDING_TIME, operator: 'gt', value: 48 }
        ]
      }
    ],
    action: { type: 'stop_seeding' }
  },
  {
    name: t('presets.deleteIncomplete'),
    trigger: { type: 'interval', value: 60 },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          { type: CONDITION_TYPES.PROGRESS, operator: 'lt', value: 100 },
          { type: CONDITION_TYPES.AGE, operator: 'gt', value: 72 }
        ]
      }
    ],
    action: { type: 'delete' }
  }
];


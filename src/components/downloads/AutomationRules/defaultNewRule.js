import {
  TRIGGER_TYPES,
  CONDITION_TYPES,
  COMPARISON_OPERATORS,
  LOGIC_OPERATORS,
  ACTION_TYPES,
} from './constants';

export function getDefaultNewRule() {
  return {
    name: '',
    enabled: true,
    assetTypes: ['torrent'],
    trigger: {
      type: TRIGGER_TYPES.INTERVAL,
      value: 30,
    },
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        conditions: [
          {
            type: CONDITION_TYPES.RATIO,
            operator: COMPARISON_OPERATORS.GT,
            value: 1,
          },
        ],
      },
    ],
    action: {
      type: ACTION_TYPES.STOP_SEEDING,
    },
  };
}

import {
  CONDITION_TYPES,
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
} from '../constants';
import {
  isTimeBasedCondition,
  isTimestampBasedCondition,
  isBooleanCondition,
  isStringCondition,
  getOperatorsForConditionType,
} from '../utils';

export function buildOperatorOptions(condition, t) {
  const operators = condition.type ? getOperatorsForConditionType(condition.type) : [];
  return operators.map((op) => {
    let label = op;
    const isTimeBased = isTimeBasedCondition(condition.type);
    const isTimestampBased = isTimestampBasedCondition(condition.type);

    if (
      isTimeBased ||
      isTimestampBased ||
      (!isBooleanCondition(condition.type) &&
        !isStringCondition(condition.type) &&
        condition.type !== CONDITION_TYPES.STATUS &&
        condition.type !== CONDITION_TYPES.TAGS)
    ) {
      const labels = {
        [COMPARISON_OPERATORS.GT]: t('operators.gt'),
        [COMPARISON_OPERATORS.LT]: t('operators.lt'),
        [COMPARISON_OPERATORS.GTE]: t('operators.gte'),
        [COMPARISON_OPERATORS.LTE]: t('operators.lte'),
        [COMPARISON_OPERATORS.EQ]: t('operators.eq'),
      };
      label = labels[op] || op;
    } else if (isStringCondition(condition.type)) {
      const labels = {
        [STRING_OPERATORS.EQUALS]: t('stringOperators.equals'),
        [STRING_OPERATORS.CONTAINS]: t('stringOperators.contains'),
        [STRING_OPERATORS.STARTS_WITH]: t('stringOperators.startsWith'),
        [STRING_OPERATORS.ENDS_WITH]: t('stringOperators.endsWith'),
        [STRING_OPERATORS.NOT_EQUALS]: t('stringOperators.notEquals'),
        [STRING_OPERATORS.NOT_CONTAINS]: t('stringOperators.notContains'),
      };
      label = labels[op] || op;
    } else if (isBooleanCondition(condition.type)) {
      const labels = {
        [BOOLEAN_OPERATORS.IS_TRUE]: t('booleanValues.true'),
        [BOOLEAN_OPERATORS.IS_FALSE]: t('booleanValues.false'),
      };
      label = labels[op] || op;
    } else if (condition.type === CONDITION_TYPES.STATUS) {
      const labels = {
        [MULTI_SELECT_OPERATORS.IS_ANY_OF]: t('multiSelectOperators.isAnyOf'),
        [MULTI_SELECT_OPERATORS.IS_NONE_OF]: t('multiSelectOperators.isNoneOf'),
      };
      label = labels[op] || op;
    } else if (condition.type === CONDITION_TYPES.TAGS) {
      const labels = {
        [TAG_OPERATORS.IS_ANY_OF]: t('tagOperators.isAnyOf'),
        [TAG_OPERATORS.IS_ALL_OF]: t('tagOperators.isAllOf'),
        [TAG_OPERATORS.IS_NONE_OF]: t('tagOperators.isNoneOf'),
        [TAG_OPERATORS.IS_SET]: t('tagOperators.isSet'),
        [TAG_OPERATORS.IS_NOT_SET]: t('tagOperators.isNotSet'),
      };
      label = labels[op] || op;
    }
    return { value: op, label };
  });
}

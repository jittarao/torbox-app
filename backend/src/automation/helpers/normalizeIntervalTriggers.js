import { MIN_INTERVAL_MINUTES } from './constants.js';

/**
 * Clamp interval trigger minutes to {@link MIN_INTERVAL_MINUTES} before validate/persist.
 *
 * RuleValidator resolves trigger via `rule.trigger || rule.trigger_config`; clients may send
 * only `trigger_config`, so both keys are normalized here.
 */
export function normalizeIntervalTriggerOnRule(rule) {
  if (!rule || typeof rule !== 'object') return rule;

  const fromTrigger = rule.trigger;
  const fromConfig = rule.trigger_config;
  const trigger = fromTrigger || fromConfig;

  if (!trigger || typeof trigger !== 'object' || trigger.type !== 'interval') {
    return rule;
  }

  const raw = trigger.value;
  const n = raw == null ? NaN : typeof raw === 'number' ? raw : Number(raw);
  const floored = Number.isFinite(n) ? Math.floor(n) : NaN;
  const clamped =
    Number.isFinite(floored) && floored >= MIN_INTERVAL_MINUTES
      ? floored
      : MIN_INTERVAL_MINUTES;

  if (clamped === trigger.value && typeof trigger.value === 'number') {
    return rule;
  }

  const newTrigger = { ...trigger, value: clamped };
  const next = { ...rule };

  if (fromTrigger != null) next.trigger = newTrigger;
  if (fromConfig != null) next.trigger_config = newTrigger;
  if (fromTrigger == null && fromConfig != null) {
    next.trigger = newTrigger;
  }

  return next;
}

/**
 * @param {Array} rules
 * @returns {Array}
 */
export function normalizeIntervalTriggersOnRules(rules) {
  if (!Array.isArray(rules)) return rules;
  return rules.map(normalizeIntervalTriggerOnRule);
}

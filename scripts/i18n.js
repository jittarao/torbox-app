#!/usr/bin/env bun
/**
 * Unified i18n CLI: translate | sync | verify
 *
 *   bun scripts/i18n.js translate [--locale de] [--apply file|-]
 *   bun scripts/i18n.js sync [--locale fr] [--check]
 *   bun scripts/i18n.js verify [--json]
 */

import { readFileSync } from 'fs';
import { TARGET_LOCALES } from './i18n/lib/constants.js';
import { syncLocales } from './i18n/lib/sync.js';
import { applyTranslations, planTranslations } from './i18n/lib/translate.js';
import { verifyLocales } from './i18n/lib/verify.js';

const [command, ...args] = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function parseArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function selectedLocales() {
  const locale = parseArg('--locale');
  if (!locale) return TARGET_LOCALES;
  if (!TARGET_LOCALES.includes(locale)) {
    console.error(`Unknown locale "${locale}". Supported: ${TARGET_LOCALES.join(', ')}`);
    process.exit(1);
  }
  return [locale];
}

function readJsonInput(path) {
  const raw = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  switch (command) {
    case 'translate': {
      const applyPath = parseArg('--apply');
      const locales = selectedLocales();

      if (applyPath) {
        const input = readJsonInput(applyPath);
        const result = applyTranslations(input, { locales: selectedLocales() });
        if (hasFlag('--json')) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const summary of result.summaries) {
            console.log(
              `✓ ${summary.locale}: added=${summary.added} skipped_identical=${summary.skipped_identical} leaves=${summary.leaves}`
            );
          }
          if (result.errors.length > 0) {
            for (const error of result.errors) console.error(`✕ ${error}`);
          }
        }
        if (!result.ok) process.exit(1);
        return;
      }

      const plan = planTranslations({ locales });
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    case 'sync': {
      const locales = selectedLocales();
      const result = syncLocales({ locales, checkOnly: hasFlag('--check') });

      if (hasFlag('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.changed) {
        for (const change of result.changes) {
          const verb = hasFlag('--check') ? 'would update' : 'updated';
          console.log(
            `${verb} ${change.locale}.json: ${change.beforeLeaves} → ${change.afterLeaves} leaves (removed ${change.removed})`
          );
        }
      } else {
        console.log('All locale files are normalized.');
      }

      if (hasFlag('--check') && result.changed) process.exit(1);
      return;
    }

    case 'verify': {
      const result = verifyLocales();

      if (hasFlag('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log('i18n verify passed.');
      } else {
        for (const error of result.errors) console.error(`✕ ${error}`);
      }

      if (!result.ok) process.exit(1);
      return;
    }

    default:
      console.error(`Usage: bun scripts/i18n.js <translate|sync|verify> [options]

translate:
  bun i18n:translate                     emit pending translation work (JSON)
  bun i18n:translate --locale de         single locale
  bun i18n:translate --apply file.json   merge translations into locale deltas
  bun i18n:translate --apply -           read apply JSON from stdin

sync:
  bun i18n:sync                          prune, sort, drop orphans
  bun i18n:sync --check                  exit 1 if files would change

verify:
  bun i18n:verify                        CI gate (JSON, ICU, deltas, sort)
  bun i18n:verify --json                 structured output`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

# i18n — Internationalisation

Supported locales: `en` (default), `de`, `es`, `fr`, `ja`, `pl`.

**Primary audience:** autonomous coding agents. Use the CLI; do not hand-edit locale files without running verify.

## Invariants

1. [`messages/en.json`](messages/en.json) is canonical — add or change keys here first.
2. Non-English files are **delta-only** — only keys whose values differ from English.
3. Keys absent from a delta **inherit English** at runtime via deepmerge in [`request.ts`](request.ts).
4. Never translate `Admin.*` keys — admin UI stays English.
5. Preserve ICU MessageFormat syntax and `{placeholder}` names exactly (e.g. `{error}`, not `{erreur}`).
6. Do not copy English-identical values into deltas — they are redundant.

## Commands

```bash
bun i18n:translate                  # emit pending translation work (JSON to stdout)
bun i18n:translate --locale de      # single locale
bun i18n:translate --apply work.json  # merge translations into locale deltas
bun i18n:translate --apply -        # read apply JSON from stdin

bun i18n:sync                       # prune identical keys, sort, drop orphans
bun i18n:sync --check               # exit 1 if files would change

bun i18n:verify                     # CI gate — must pass before commit
bun i18n:verify --json              # structured output
```

## Agent protocol

After editing `en.json`:

```bash
# 1. Get work queue
bun i18n:translate --json > /tmp/i18n-work.json

# 2. Translate pending values in-place (in your agent context)
#    - Follow per-locale style hints in the JSON output
#    - Omit keys where the translation equals English
#    - Never translate Admin.* keys

# 3. Apply and validate
bun i18n:translate --apply /tmp/i18n-work.json
bun i18n:verify
bun run format
```

If `pending` is empty, skip steps 2–3.

## JSON schemas

### Plan output (`bun i18n:translate`)

```json
{
  "version": 1,
  "pending": {
    "de": {
      "Downloads.filters.searchPlaceholder": "Search downloads…",
      "Downloads.tags.count": "{count, plural, one {# tag} other {# tags}}"
    }
  },
  "excluded": ["Admin.*"],
  "rules": ["…"],
  "styles": { "de": { "formality": "Formal \"Sie\"", "icuPlurals": "one, other" } },
  "instructions": "…"
}
```

### Apply input

Same `pending` shape, with translated values:

```json
{
  "de": {
    "Downloads.filters.searchPlaceholder": "Downloads durchsuchen…",
    "Downloads.tags.count": "{count, plural, one {# Schlagwort} other {# Schlagwörter}}"
  }
}
```

Or pass the full plan object — `pending` is extracted automatically.

## Locale style reference

Detailed per-locale conventions live in [`scripts/i18n/lib/style.js`](../../scripts/i18n/lib/style.js). Plan output embeds condensed hints per locale.

### ICU plural categories

| Language       | Plural categories             |
| -------------- | ----------------------------- |
| en, de, es, fr | `one`, `other`                |
| ja             | `other` only                  |
| pl             | `one`, `few`, `many`, `other` |

## Runtime merge

```ts
messages = deepmerge(enMessages, localeMessages);
```

Implemented in [`request.ts`](request.ts). Missing delta keys are not errors — they inherit English.

## CI

`bun run test` runs `bun i18n:verify`. It checks:

- Valid JSON in all locale files
- ICU syntax parses
- `{placeholders}` match English source names
- No English-identical delta keys
- No orphan keys outside `en.json`
- Sorted key order

## Do not

- Create `i18n-patches/` files or use removed scripts (`i18n:check-keys`, `i18n:prune-deltas`, etc.)
- Add `Admin.*` keys to non-English deltas
- Copy English values into locale deltas
- Rename placeholders (`{error}` must stay `{error}` in every locale)
- Manually sort or prune — `translate --apply` and `sync` handle this

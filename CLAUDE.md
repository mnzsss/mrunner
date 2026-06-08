# MRunner — Project Rules

## i18n (MANDATORY)

- **All user-facing text** must use i18next `t()` function — never hardcode strings in components
- Every new key must be added to both `apps/renderer/src/locales/en.json` AND `apps/renderer/src/locales/pt-BR.json`
- Use the flat namespace convention: `"section.key"` (e.g. `t('chat.send')`)
- Interpolation uses `{{variable}}` syntax

## UI Components

- Use **Base UI** (`@base-ui/react`) + **shadcn** pattern for all new components
- Component wrappers live in `packages/ui/src/components/ui/`
- Export from `packages/ui/src/index.ts`
- Import from `@mrunner/ui` in renderer code
- No barrel imports from large icon libraries — import icons individually

## Code Style

- English only: all code, comments, commit messages, docs, and file content must be in English
- Biome for lint/format — run `pnpm check` before finishing
- `cargo check -p mrunner` for Rust changes
- No emojis as icons — use Lucide or HugeIcons SVG icons

## Documentation

- **Always** use the `context7` MCP server (`resolve-library-id` + `query-docs`) to look up documentation for any library before implementing or troubleshooting — never rely on memory alone

# CLAUDE.md

## Lint

作業前に必ず以下のlint設定ファイルを読み込むこと:

- `biome.json` — Biome linter/formatter設定
- `.eslintrc.cjs` — ESLint設定

### Lintコマンド

- `pnpm lint` — ESLint実行 (`--max-warnings 0` のため警告もエラー扱い)
- `pnpm lint:biome` — Biome lint実行

### 注意点

- **Biome と ESLint の両方**が CI で実行される。両方通す必要がある
- Biome の suppress コメントは `// biome-ignore <rule>: <理由>` 形式で、対象行の**直前行**に置く
- ESLint の suppress コメントは `// eslint-disable-line <rule>` 形式で、対象行の**末尾**に置く。または `// eslint-disable-next-line <rule>` で対象行の**直前行**に置く
- 両方を同じ行に適用する場合、biome-ignore を直前行に、eslint-disable-line を対象行末尾に配置する
- `--max-warnings 0` が有効なので、未使用の disable ディレクティブもエラーになる

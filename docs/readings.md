# reading（読み上げテキスト）の生成・適用手順

ピンデータにはTTS（音声読み上げ）用の `reading` フィールドがあります。難読地名・固有名詞をひらがなに変換したテキストで、Gemini API を使って生成します。

## 前提条件

- `GEMINI_API_KEY` 環境変数が必要（Google AI Studio で取得）
- `GEMINI_MODEL` 環境変数でモデルを変更可能（省略時は `gemini-3-flash-preview`）

## 手順

### 1. reading の生成

```bash
GEMINI_API_KEY=xxx node scripts/generate-readings.mjs
```

503 エラーが頻発する場合は `GEMINI_MODEL` で別のモデルを指定してください:

```bash
GEMINI_API_KEY=xxx GEMINI_MODEL=gemini-2.0-flash node scripts/generate-readings.mjs
```

- `src/data/okutama-pins.ts` から `description` が空でないピンを抽出
- Gemini API でタイトル＋説明文の読み上げテキストを生成
- 結果は `scripts/readings.json` に保存される
- **既に `readings.json` が存在する場合、未生成のピンのみ追加生成する**（途中で中断しても再開可能）

### 2. 全件再生成する場合

`description` を更新した場合など、全件再生成が必要なときは `readings.json` を削除してから実行します。

```bash
rm scripts/readings.json
GEMINI_API_KEY=xxx node scripts/generate-readings.mjs
```

### 3. 生成結果の確認

長文のピンでは出力が途中で切れることがあります。末尾が `。` `」` `）` で終わっていないエントリがないか確認してください。

切れているものがあれば、`readings.json` から該当IDのエントリを削除して再度 `generate-readings.mjs` を実行すると、そのピンだけ再生成されます。

### 4. okutama-pins.ts への反映

```bash
node scripts/apply-readings.mjs
```

- `readings.json` の内容を `okutama-pins.ts` の各ピンオブジェクトに `reading` フィールドとして挿入
- 既に `reading` がある場合は上書き更新

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/generate-readings.mjs` | Gemini API で reading を生成 |
| `scripts/apply-readings.mjs` | readings.json を okutama-pins.ts に反映 |
| `scripts/readings.json` | 生成済み reading のキャッシュ（ID → テキスト） |
| `src/types/pins.ts` | `PinData.reading` の型定義 |

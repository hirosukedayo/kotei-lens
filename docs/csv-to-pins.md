# CSV → ピンデータ変換手順

スポット情報のCSVファイルから `src/data/okutama-pins.ts` を生成するスクリプトです。

## 使い方

```bash
node scripts/convert_csv_to_json.js <CSVファイルパス>
```

例:

```bash
node scripts/convert_csv_to_json.js resources/spot_20260309.csv
```

- `src/data/okutama-pins.ts` が上書き生成される
- 経度順にソートされた状態で出力される

## CSVの形式

ヘッダー行が必須です。以下のカラムが利用されます。

| カラム名 | 必須 | 説明 |
|---------|------|------|
| `id` | Yes | ピンID |
| `title` | Yes | タイトル |
| `coordinates` | Yes | 座標 (`[lat, lng]` 形式、複数座標にも対応) |
| `type` | Yes | ピン種別 (`interview`, `historical`, `folktale`, `heritage`, `current`, `parking`, `photo`) |
| `description` | Yes | 説明文 |
| `google_map_url` | No | Google Map リンク |
| `general_url` | No | 外部リンクURL |
| `general_url_title` | No | 外部リンクの表示名 |
| `画像のファイル名` | No | 画像ファイル名（省略時は `id.jpg` を自動検索） |
| `reading` | No | 読み上げテキスト |
| `folktale` | No | 関連する昔話のタイトル |
| `folktale_id` | No | 昔話ID |
| `heritage` | No | 郷土芸能タイトル |
| `bearing` | No | 方位角 (0〜360) |

## スキップされる行

- `type` が空または上記以外の行
- `description` が空、または `※原稿が必要` で始まる行（`parking`, `photo` は除く）
- 座標が空またはパース不可の行

## 複数座標の展開

`coordinates` に複数の座標が含まれる場合（例: `[35.79, 139.04][35.78, 139.03]`）、IDに連番を付与して展開されます（`5-1`, `5-2` など）。

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/convert_csv_to_json.js` | CSV → TypeScript 変換スクリプト |
| `resources/spot_*.csv` | 入力CSVファイル |
| `src/data/okutama-pins.ts` | 出力されるピンデータ |
| `src/types/pins.ts` | `PinData` の型定義 |

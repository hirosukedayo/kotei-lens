# 地図タイル作成ガイド（QGIS）

QGISを使用してカスタム地図タイルを作成し、2Dマップに反映する手順。

## 前提

- ツール: QGIS（GDAL2Tiles プラグイン内蔵）
- タイル形式: XYZ形式（`{z}/{x}/{y}.png`）
- タイルサイズ: 256x256 px, PNG
- 座標系: EPSG:3857（Webメルカトル）
- 配置先: `public/tiles/`

## 1. ソース画像の準備

### ジオリファレンス（位置情報の付与）

地図画像に座標情報がない場合、QGISでジオリファレンスを行う。

1. QGIS を開き、ベースマップ（OpenStreetMap等）を追加
2. メニュー: **レイヤ → ジオリファレンサー**
3. 地図画像を読み込み、既知の地点にGCP（Ground Control Point）を設定
   - 最低4点、多いほど精度が上がる
   - 湖岸・道路の交差点など、特定しやすい地物を選ぶ
4. 変換設定:
   - 変換タイプ: 多項式1（線形）またはThin Plate Spline
   - リサンプリング: Cubic
   - 出力CRS: **EPSG:3857**
   - 出力形式: GeoTIFF
5. 「ジオリファレンスの開始」で GeoTIFF を出力

### 既に位置情報がある場合

GeoTIFF等であればそのまま次のステップへ。CRSがEPSG:3857でない場合はQGISで再投影する。

## 2. タイルの生成

### QGISの「ラスタタイルの生成（XYZ）」を使用する方法

1. ジオリファレンス済みの画像をQGISに追加
2. メニュー: **プロセシング → ツールボックス → ラスタタイルの生成（XYZ）**
3. パラメータ設定:
   - 範囲: レイヤの範囲を使用
   - 最小ズーム: `12`
   - 最大ズーム: `17`（必要に応じて調整）
   - タイルサイズ: 256
   - 出力ディレクトリ: 任意の作業フォルダ
4. 実行してタイルを生成

### GDAL2Tiles を使用する方法（コマンドライン）

```bash
gdal2tiles.py -p mercator -z 12-17 -w none --xyz input.tif output_dir/
```

- `-p mercator`: Webメルカトル投影
- `-z 12-17`: 生成するズームレベル範囲
- `-w none`: ビューアHTMLを生成しない
- `--xyz`: XYZ形式で出力（TMS形式ではなく）

## 3. タイルの配置

生成されたタイルを `public/tiles/` にコピーする。

```
public/tiles/
├── 12/
│   └── {x}/
│       └── {y}.png
├── 13/
│   └── ...
├── ...
└── 17/
    └── ...
```

## 4. コードの設定

タイルは `src/components/map/OkutamaMap2D.tsx` で読み込まれる。

```tsx
const tilesBase = import.meta.env.BASE_URL || '/';
const localTilesUrl = `${tilesBase}tiles/{z}/{x}/{y}.png`;
```

ズームレベルや表示範囲を変更する場合は、同ファイル内の `TileLayer` の `minZoom` / `maxZoom` を調整する。

```tsx
<TileLayer
  url={localTilesUrl}
  noWrap
  minZoom={12}
  maxZoom={20}
  opacity={1}
  zIndex={700}
/>
```

## 5. 動作確認

```bash
pnpm dev
```

2Dマップモードで、カスタムタイルが正しい位置に表示されていることを確認する。

## 現在のタイル情報

| 項目 | 値 |
|---|---|
| ソース | `okutama_georef.tif` |
| CRS | EPSG:3857 |
| 範囲（経度） | 138.967 〜 139.097 |
| 範囲（緯度） | 35.751 〜 35.822 |
| ズームレベル | 12〜17 |
| ベースマップ | CARTO light_nolabels |

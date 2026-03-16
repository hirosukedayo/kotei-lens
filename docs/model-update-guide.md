# 3Dモデル更新ガイド

奥多摩湖の3Dモデル（GLBファイル）を差し替える手順。

## 前提

- モデル形式: glTF 2.0 / GLB
- 配置先: `public/models/`
- ローダー: Three.js の `GLTFLoader`

## 更新手順

### 1. モデルファイルの配置

新しい `.glb` ファイルを `public/models/` に配置する。

### 2. コード内のパス更新

以下の2ファイル内でモデルファイル名を変更する。

#### `src/components/3d/LakeModel.tsx`

2箇所あるモデルパスの文字列を更新:

```ts
// プリロード関数内（preloadLakeModel）
const modelPath = `${basePath}models/<新しいファイル名>.glb`;

// useEffect内（モデル読み込み処理）
const modelPath = `${basePath}models/<新しいファイル名>.glb`;
```

#### `src/components/map/CalibrationOverlay.tsx`

冒頭の定数を更新:

```ts
const MODEL_PATH = `${import.meta.env.BASE_URL}models/<新しいファイル名>.glb`;
```

### 3. 動作確認

```bash
pnpm dev
```

ブラウザで3Dビューとマップオーバーレイの両方を確認する。

### 4. terrain-config の調整（必要に応じて）

モデルの座標系やスケールが変わった場合は `src/config/terrain-config.ts` の以下を調整:

| 設定値 | 用途 |
|---|---|
| `TERRAIN_SCALE_FACTOR` | 地形のスケール調整係数 |
| `TERRAIN_CENTER_OFFSET` | 地形の中心位置オフセット |
| `FBX_NORMALIZATION_TARGET` | 正規化ターゲットサイズ |
| `WATER_INITIAL_OFFSET` | 水面の初期位置オフセット |

### 5. 旧モデルの削除

新モデルで問題がないことを確認後、旧ファイルを `public/models/` から削除する。

## 更新履歴

| 日付 | ファイル名 | 備考 |
|---|---|---|
| 2026-03-01 | `OkutamaLake_allmodel_test0301.glb` | 初期モデル |
| 2026-03-16 | `OkutamaLake_Finished_0315.glb` | 完成版モデル |

# レポジトリ分析計画

このタスクでは、`kotei-lens` レポジトリの全体像を把握し、主要な機能（2Dマップ、3Dビュー、方位センサー連携）がどのように実装されているかを調査します。

## 調査対象

### 1. アプリケーション基盤
- `App.tsx`: アプリの状態遷移（2D/3D切り替え）、パーミッション管理、デバッグモードの実装。
- `src/stores/devMode.ts`: Zustand による状態管理。

### 2. 2Dマップ機能
- `src/components/map/OkutamaMap2D.tsx`: Leaflet を用いたマップ表示、ピンの表示、3Dビューへの遷移。

### 3. 3Dビュー機能
- `src/components/viewer/Scene3D.tsx`: React Three Fiber を用いた3D空間の構築。
- `src/components/ar/`: 方位磁針やジャイロセンサーとの連携ロジック。
- `src/components/3d/`: 地形モデルや水面の描画。

### 4. データとサービス
- `src/data/`: GeoJSON や座標定義。
- `src/services/`: センサー処理や位置情報計算。

## 確認手順
1. `App.tsx` の詳細解析
2. 2D・3Dそれぞれの主要コンポーネントのコードリーディング
3. データの流れとセンサー連携の仕組みを特定
4. 最終的なレポートの作成

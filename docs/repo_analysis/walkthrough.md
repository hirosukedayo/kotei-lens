# レポジトリ調査結果まとめ

`kotei-lens` レポジトリの分析が完了しました。以下に主要な構成と仕様をまとめます。

## 1. 全体アーキテクチャ
Vite + React + TypeScript をベースとしたシングルページアプリケーションです。
- **2Dマップ**: Leaflet を使用し、古地図タイルをオーバーレイ表示。
- **3D/ARビュー**: React Three Fiber (Three.js) を使用。地形モデルを表示し、モバイルデバイスでは方位・ジャイロセンサーと連動。
- **状態管理**: Zustand (`src/stores/devMode.ts`) でデバッグモード等のグローバル状態を管理。

## 2. 主要コンポーネント
- [App.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/App.tsx)
  - アプリ全体の状態管理（`2d-view`, `3d-view`, `permissions` 等）。
  - 右下5回タップによるシークレットなデバッグモード切り替え。
- [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)
  - 2Dマップの表示。`requestPermission` を経て3Dビューへ遷移。
  - 現在の中心位置（緯度経度）とデバイスの `alpha` (方位) を `Scene3D` に引き継ぐ。
- [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)
  - 3D空間の構築。
  - `CameraPositionSetter` により、地形モデルに対するレイキャスティングを行い、カメラの高さを自動調整。
- [OrientationCamera.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/ar/OrientationCamera.tsx)
  - デバイスの向き (`alpha`, `beta`, `gamma`) を Three.js の `YXZ` 回転順序に変換し、カメラを制御。

## 3. 座標変換と設定
- [coordinate-converter.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/utils/coordinate-converter.ts)
  - GPS座標を `EARTH_RADIUS` を用いたメートル単位の3D座標に変換。
  - `SCENE_CENTER` (小河内神社付近) を原点としている。
- [terrain-config.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/config/terrain-config.ts)
  - `TERRAIN_SCALE_FACTOR` (現在は 6.0) や `CAMERA_HEIGHT_OFFSET` などの重要な定数を集中管理。

## 4. データ
- `src/data/okutama-pins.ts`: 2D/3D共通で表示されるスポット情報（緯度経度、名称、種類）。
- `src/data/historical-locations.ts`: 歴史的な位置情報の GeoJSON ソース等。

## 5. 開発者向けTips
- **開発者モード**: 画面右下を5回連続タップで有効化。2Dマップ上に3Dモデルの範囲（矩形）が表示され、Scene3Dでデバッグ情報が表示される。
- **PC操作**: 3Dビュー内では `WASD` キーで移動、クリックでポインターロックされマウスで視点操作が可能。

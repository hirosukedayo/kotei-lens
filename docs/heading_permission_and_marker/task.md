# タスクリスト: 方位許可 & マーカースタイル変更

- [x] ブランチ作成 (`feat/heading-permission-and-marker-style`)
- [x] `OkutamaMap2D.tsx` の変更
  - [x] `headingPermission` ステート追加
  - [x] 方位許可取得バナーUI実装
  - [x] `CurrentLocationMarker` をGoogle Maps風に変更
  - [x] 方位なし時は円弧非表示（ドットのみ）
- [x] ビルド検証 (`pnpm run lint && pnpm run build`)
- [x] コミット & プッシュ
- [x] マーカーサイズを2倍に拡大 (60px → 120px)
- [x] 3Dビュー内キャリブレーション改善
  - [x] `CompassCalibration` に手動モード開始機能追加
  - [x] `CompassCalibration` にリアルタイムオフセット反映機能追加
  - [x] `Scene3D` から再調整時に手動モード＆リアルタイム反映を利用



- [x] 2Dマップマーカーの改善
  - [x] 扇形の形状をGoogle Maps風に調整（グラデーション、形状）
  - [x] z-indexを修正（湖の上に表示されるように）
  - [x] ユーザー位置アイコンのアウトラインに呼吸アニメーションを追加

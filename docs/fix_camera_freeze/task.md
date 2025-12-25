# カメラフリーズとセンサーログ修正

## タスク
- [x] 原因の調査 (3Dカメラのフリーズと2Dセンサーログ)
- [x] 実装計画の作成 (日本語)
- [x] 修正の実装 (Execution)
    - [x] `useSensors.ts`: `startSensors` の安定化と依存ループの解消
    - [x] `Scene3D.tsx`: `CameraPositionSetter` の最適化（頻度低減、名前検索）
    - [x] `Scene3D.tsx`: `calculateTerrainPosition` のメモ化
    - [x] `LakeModel.tsx`: `React.memo` 化とログ削除
    - [x] `LakeModel.tsx`: エクスポートとインポートのバリデーション修正
- [x] 手動検証 (ドキュメント作成)
    - [x] `walkthrough.md` の作成 (日本語)
- [/] プルリクエストの作成 [待ち]

## 次のステップ
- [ ] ユーザーによる手動検証
- [ ] 承認後、PRを作成

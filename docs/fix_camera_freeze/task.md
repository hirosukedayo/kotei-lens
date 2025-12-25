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
- [x] プルリクエストの作成 [PR #123](https://github.com/hirosukedayo/kotei-lens/pull/123)

## 次のステップ
- [ ] ユーザーによる手動検証
    - [x] 地形が表示されない問題を報告
    - [x] 1秒ごとのGPSログが大量に出る問題を報告
- [ ] トラブルシューティング: 地形消失とログの調査
    - [x] `LocationService.ts` の過剰なログを削除
    - [ ] `LakeModel.tsx` のレンダリング条件を確認 (デバッグログ追加済み)
    - [ ] 修正と検証
    - [ ] `Scene3D.tsx` の `CameraPositionSetter` との整合性確認
    - [ ] 修正と検証

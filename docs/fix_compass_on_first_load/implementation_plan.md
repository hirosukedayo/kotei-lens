# 実装計画: 3Dビュー遷移時のコンパス動作修正

## 概要
3Dビューへの初回遷移時にコンパスが動作しない問題を修正します。
原因は、`useSensors` フックのクリーンアップ関数（`stopSensors`）が、シングルトンである `SensorManager` の全リスナーを無条件に削除してしまっていることにあると考えられます。
画面遷移時、遷移元の `OkutamaMap2D` がアンマウントされる際に実行されるクリーンアップが、遷移先の `Scene3D` で開始されたセンサー監視も停止させてしまっています。

これを修正するため、`useSensors` フック内で登録した特定のコールバック関数のみを解除するように変更します。

## ユーザー確認事項
- **特になし**: この変更は内部ロジックの修正であり、機能的な変更はありません。

## 変更内容

### `src/hooks/useSensors.ts`

- `stopSensors` 関数内で、`sensorManager.*.stopTracking()` / `stopWatching()` を呼び出す際、引数なし（全解除）ではなく、このフックインスタンスで作成したコールバック関数（`handleGPSUpdate`, `handleOrientationUpdate`, `handleMotionUpdate`）を引数として渡すように変更します。

```typescript
// 変更前
sensorManager.locationService.stopWatching();
sensorManager.orientationService.stopTracking();
sensorManager.motionService.stopTracking();

// 変更後
sensorManager.locationService.stopWatching(handleGPSUpdate);
sensorManager.orientationService.stopTracking(handleOrientationUpdate);
sensorManager.motionService.stopTracking(handleMotionUpdate);
```

これにより、フックのインスタンスごとのリスナーのみが適切に解除され、他のコンポーネント（特に遷移先のコンポーネント）からの監視は維持されます。

## 検証計画

### 自動テスト
- 現状、センサー関連のユニットテストは存在しないため、追加は行いません。

### 手動検証手順
以下の手順で動作を確認していただきます（実機推奨）。

1. モバイル端末でアプリケーションを開く。
2. 「はじめる」またはマップ画面へ移動。
3. 3Dビュー（ARモード）ボタンを押して遷移する。
    - **期待値**: 3Dビューが表示され、コンパス（あるいはデバイスの向きによるカメラ回転）が即座に機能していること。
4. 一度2Dマップに戻り、再度3Dビューへ遷移する。
    - **期待値**: 同様にコンパスが機能すること。
5. 3Dビューでブラウザをリロードする。
    - **期待値**: リロード後も問題なくコンパスが機能すること。

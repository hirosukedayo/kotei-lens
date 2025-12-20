# useSensors フック仕様

## 概要

`useSensors` は、アプリ内で利用する各種デバイスセンサー（GPS / 方位 / モーション）を一括管理するためのカスタムフックです。  
センサーの開始・停止、直近のセンサーデータ、モック位置設定などを 1 つの API で提供します。

- 実装ファイル: `src/hooks/useSensors.ts`
- 内部で使用するサービス: `SensorManager`（`LocationService`, `OrientationService`, `MotionService`）

---

## API

### シグネチャ

```ts
import { useSensors } from '../hooks/useSensors';

const {
  sensorData,
  isActive,
  startSensors,
  stopSensors,
  setMockLocation,
  sensorManager,
} = useSensors();
```

### 戻り値

#### `sensorData`

型定義（簡略）:

```ts
interface SensorData {
  gps: GPSPosition | null;
  orientation: DeviceOrientation | null;
  motion: DeviceMotion | null;
  isWalking: boolean;
  compassHeading: number | null;
}
```

- **`gps`**
  - 型: `GPSPosition | null`
  - 説明: 最新の GPS 位置情報（`LocationService` から供給）
  - 主なフィールド例: `latitude`, `longitude`, `altitude`, `accuracy`, `timestamp`

- **`orientation`**
  - 型: `DeviceOrientation | null`
  - 説明: 最新のデバイス向き情報  
    （`OrientationService` より、`deviceorientation` イベントを正規化した値）

- **`motion`**
  - 型: `DeviceMotion | null`
  - 説明: 最新の加速度・回転レート情報  
    （`MotionService` より、`devicemotion` イベントを正規化した値）

- **`isWalking`**
  - 型: `boolean`
  - 説明: `MotionService.detectWalking()` による「歩行中」推定フラグ

- **`compassHeading`**
  - 型: `number | null`
  - 説明: 方位センサーから算出したコンパス方位（北=0度, 時計回り）

#### `isActive`

- 型: `boolean`
- 説明: いずれかのセンサーが「開始済み」かどうかを示すフラグ  
  （`startSensors()` 呼び出し後に `true` になる）

#### `startSensors`

- 型: `() => Promise<void>`
- 説明:
  - GPS / 方位 / モーション 各サービスを順次開始する
  - すでに `isActive === true` の場合は何もしない（多重開始を防止）
  - デバイス対応状況に応じて、利用可能なセンサーのみ開始する

使用例（`OkutamaMap2D`）:

```ts
const { sensorData, startSensors } = useSensors();

useEffect(() => {
  startSensors();
}, [startSensors]);
```

#### `stopSensors`

- 型: `() => void`
- 説明:
  - すべてのセンサー監視を停止する
  - `LocationService.stopWatching()`, `OrientationService.stopTracking()`, `MotionService.stopTracking()` を呼び出す

#### `setMockLocation`

- 型: `() => void`
- 説明:
  - `LocationService.getMockPosition()` で取得したテスト用の位置を `sensorData.gps` に設定する
  - 現地にいない状態でも、GPS 依存 UI を確認するための開発用ユーティリティ

#### `sensorManager`

- 型: `SensorManager`
- 説明:
  - シングルトンインスタンスへの参照
  - `locationService`, `orientationService`, `motionService` に直接アクセスしたい高度な用途向け

---

## 内部挙動

### コールバックの登録

- GPS 更新時: `handleGPSUpdate` が呼ばれ、`sensorData.gps` が更新される
- GPS エラー時: `handleGPSError` が呼ばれ、コンソールに警告を出す
- 方位更新時: `handleOrientationUpdate` が呼ばれ、
  - `orientation` フィールドを更新
  - `compassHeading` を `OrientationService.getCompassHeading()` を用いて更新
- モーション更新時: `handleMotionUpdate` が呼ばれ、
  - `motion` フィールドを更新
  - `isWalking` を `MotionService.detectWalking()` を用いて更新

### ライフサイクル

- マウント時:
  - 何もしない（`startSensors()` を呼ぶまでセンサーは開始されない）
- アンマウント時:
  - `stopSensors()` が自動的に呼ばれ、すべてのセンサー監視を停止

---

## 代表的な使用パターン

### 2D マップで GPS 中心と連動させる

```ts
const { sensorData, startSensors, sensorManager } = useSensors();

useEffect(() => {
  startSensors();
}, [startSensors]);

useEffect(() => {
  const gps = sensorData.gps;
  if (!gps) return;

  const isInArea = sensorManager.locationService.isInOkutamaArea(gps);
  // isInArea に応じてマップ中心やトースト表示を切り替える
}, [sensorData.gps, sensorManager.locationService]);
```

### デバッグログの確認

`startSensors()` 内で、各センサーの利用可否や開始状況を `console.log` で出力しているため、  
ブラウザの DevTools コンソールからセンサーの状態を確認できます。

---

## 注意事項

1. **ブラウザ対応**
   - 一部センサー（特に方位・モーション）は、HTTPS + モバイルブラウザでのみ動作する
   - PC ブラウザでは `orientation` / `motion` が常に `null` となる場合がある

2. **ユーザー許可**
   - GPS 位置情報はブラウザの許可ダイアログに依存する
   - 不許可の場合はエラーとしてログに出力されるが、アプリはフォールバック動作（例: 固定中心表示）を行う設計とする

3. **パフォーマンス**
   - センサーは端末によって更新頻度が高くなる場合があるため、  
     `sensorData` を監視する `useEffect` の中で重い処理を行わないように注意する

4. **テスト時の利用**
   - `setMockLocation()` をうまく活用することで、現地にいなくても GPS 依存 UI の検証が可能




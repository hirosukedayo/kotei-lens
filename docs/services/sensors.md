# センサーサービス仕様 (SensorManager / LocationService / OrientationService / MotionService)

## 概要

このドキュメントでは、デバイスセンサー周りのサービス群と、それらを統合する `SensorManager` の仕様をまとめます。

- シングルトン管理: `SensorManager`
- 個別サービス:
  - `LocationService` (GPS)
  - `OrientationService` (方位・コンパス)
  - `MotionService` (加速度・歩行判定)

実装ファイルは以下の通りです。

- `src/services/sensors/SensorManager.ts`
- `src/services/sensors/LocationService.ts`
- `src/services/sensors/OrientationService.ts`
- `src/services/sensors/MotionService.ts`

---

## SensorManager

### 役割

センサーサービス群のシングルトンインスタンスを管理し、アプリ全体から一貫した窓口として提供します。

### インスタンス取得

```ts
import { getSensorManager } from '../services/sensors/SensorManager';

const sensorManager = getSensorManager();
```

内部実装:

- `SensorManager.getInstance()` をラップした `getSensorManager()` ヘルパー関数を提供
- 初回呼び出し時にのみ `new SensorManager()` が実行される

### 公開プロパティ

- `locationService: LocationService`
- `orientationService: OrientationService`
- `motionService: MotionService`

### メソッド

- `getStatus()`
  - 3 種類のサービスの利用可否・直近更新状態などをまとめて返す
  - 例:
    ```ts
    const status = sensorManager.getStatus();
    status.location.available;  // boolean
    status.location.lastUpdate; // timestamp or null
    ```

- `stopAll()`
  - すべてのセンサー監視を停止する
  - `LocationService.stopWatching()`, `OrientationService.stopTracking()`, `MotionService.stopTracking()` を呼び出す

- `dispose()`
  - `stopAll()` に加え、各サービスの `dispose()` を呼び出しリソースを解放
  - 現状アプリでは通常のライフサイクルではあまり使用しない想定（将来的な拡張用）

---

## LocationService (GPS)

### 役割

ブラウザの Geolocation API をラップし、GPS 位置情報を扱いやすい形で提供します。

### 主な機能

- 単発位置取得 (`getCurrentPosition()`)
- 継続監視 (`startWatching()` / `stopWatching()`)
- エリア内判定 (`isInOkutamaArea()`)
- モック位置取得 (`getMockPosition()`)

### OKUTAMA_BOUNDS (体験エリア)

```ts
private readonly OKUTAMA_BOUNDS = {
  north: 35.795,
  south: 35.785,
  east: 139.055,
  west: 139.045,
};
```

- この矩形範囲をもって「体験エリア内」と定義
- `isInOkutamaArea(position: GPSPosition): boolean` にて判定に使用
  - `south <= latitude <= north`
  - `west <= longitude <= east`

### 代表的なメソッド

- `isAvailable(): boolean`
  - `navigator.geolocation` が利用可能かどうかを返す

- `checkPermission(): Promise<PermissionState>`
  - Geolocation の権限状態 (`granted` / `prompt` / `denied`) を返す  
    （一部ブラウザでは `permissions` API 非対応のため `prompt` 固定）

- `getCurrentPosition(): Promise<GPSPosition>`
  - 単発で現在位置を取得する Promise ベースの API

- `startWatching(callback: GPSCallback, errorCallback?: GPSErrorCallback)`
  - 位置情報を継続的に監視し、更新のたびに `callback` を呼び出す
  - 内部で `navigator.geolocation.watchPosition` を利用
  - 初回呼び出し時のみ `watchPosition` を開始し、以降はコールバック配列に追加

- `stopWatching(callback?: GPSCallback)`
  - コールバック単位、または全体の監視を停止

- `getLastPosition(): GPSPosition | null`
  - 直近で受信した位置情報を返す

- `isInOkutamaArea(position: GPSPosition): boolean`
  - 体験エリア内かどうかを判定する（マップ中心の切り替えなどに利用）

- `getMockPosition(): GPSPosition`
  - 小河内ダム堤体中心付近のテスト用座標を返す  
    → 開発中に現地にいなくても機能確認が可能

---

## OrientationService (方位・コンパス)

### 役割

`deviceorientation` イベントをラップし、方位センサーからの値を統一的に扱うサービスです。

### 主な機能（概略）

- 方位センサーの利用可否チェック (`isAvailable()`)
- 向きデータの監視開始 / 停止 (`startTracking()` / `stopTracking()`)
- 直近の向きデータ取得 (`getLastOrientation()`)
- コンパス方位の算出 (`getCompassHeading(orientation)`)

`useSensors` フックからは、以下のように利用されます。

```ts
const compassHeading = sensorManager.orientationService.getCompassHeading(orientation);
```

これにより、`sensorData.compassHeading` に 0–360° の値が格納されます。

---

## MotionService (モーション・歩行判定)

### 役割

`devicemotion` イベントをラップし、加速度・回転レートなどの情報から「歩行中かどうか」を推定します。

### 主な機能（概略）

- モーションセンサーの利用可否チェック (`isAvailable()`)
- モーションデータの監視開始 / 停止 (`startTracking()` / `stopTracking()`)
- 歩行判定 (`detectWalking(motion: DeviceMotion): boolean`)
  - 加速度ベクトルの大きさから、静止状態と歩行状態の差分を基に簡易判定

`useSensors` では、`isWalking` フラグとして公開されます。

---

## 利用例のまとめ

### 2D マップ (`OkutamaMap2D`) での利用

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

### 3D ビューでの将来的な利用

`Scene3D` や AR 関連コンポーネントにおいても、同じ `SensorManager` / `useSensors` を利用することで、

- カメラ位置を GPS と連動
- カメラの向きをコンパス方位と連動
- 歩行状態に応じた UI 変化（例: 歩行中のみ特定のガイドを表示）

といった一貫した体験を実現できます。




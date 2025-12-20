# Scene3D コンポーネント仕様

## 概要

`Scene3D` は、湖底レンズの 3D 体験を提供するメイン 3D シーンコンポーネントです。  
WebGL / WebGPU 対応状況の検出、PC / モバイル別のカメラ操作、`LakeModel` の描画などを統合的に制御します。

- 実装ファイル: `src/components/viewer/Scene3D.tsx`
- 依存コンポーネント:
  - `@react-three/fiber` の `Canvas`
  - `@react-three/drei` の `Sky`, `Environment`, `DeviceOrientationControls`
  - ローカルコンポーネント `LakeModel`
  - WebGL 判定ユーティリティ `utils/webgl-detector.ts`

- `useDevModeStore`: デバッグモード管理
- `useSensors`: 方位・GPS情報の取得
- `OrientationCamera`: センサー連動カメラ
- `LakeModel`: 地形・水面モデル

## コンポーネント構造

```tsx
export default function Scene3D() { ... }
```

外部から Props は受け取らない「画面単位」のコンポーネントです。  
状態はすべて内部で管理します。

主な内部 state:

- `webglSupport: WebGLSupport | null`
- `renderer: 'webgpu' | 'webgl2' | 'webgl' | 'none' | string`
- `permissionGranted: boolean`（デバイス向き許可）
- `isMobile: boolean`
- `deviceOrientationControlsRef`

---

## レンダリングフロー

2. **初期化と位置設定**
   - `initialPosition` (緯度・経度) を受け取り、`gpsToWorldCoordinate` にて 3D 空間座標を決定。
   - `CameraPositionSetter`:
     - 地形 Mesh (Displacement 等) に対して上空からレイを飛ばす。
     - 地表との交差点を検出し、`CAMERA_HEIGHT_OFFSET` (10m) を加えた高さをカメラの Y 座標に設定。

3. **レンダリング要素**
   - `Canvas`: `renderer` に応じた `gl` 設定を適用。
   - `PCKeyboardControls`: PC での `WASD` 操作を提供。
   - `OrientationCamera`: モバイルで方位センサーと連動。
   - `LakeModel`: 動的に計算された `calculateTerrainPosition` に配置。

---

## デバイス判定とカメラ操作

### デバイス種別判定 (`isMobile`)

- `navigator.userAgent` と `ontouchstart` / `maxTouchPoints` を用いて判定
- モバイル or タッチデバイス → `isMobile = true`
- PC（非タッチ） → `isMobile = false`

### モバイル: DeviceOrientationControls

- 利用コンポーネント: `DeviceOrientationControls` (`@react-three/drei`)
- 条件:
  - `isMobile === true`
  - `permissionGranted === true`
- 動き:
  - デバイスの向きに合わせてカメラの向きを更新し、没入感のある 3D 体験を提供

### PC: FPSスタイルカメラ (`FPSCameraControls`)

- `FPSCameraControls` 内で以下を実装:
  - `pointer lock` によるマウスルック
  - `WASDQE` キーによる移動
  - カメラ回転順序と範囲の制御（`camera.rotation.order = 'YXZ'` など）
- 目的:
  - PC ユーザー向けに、キーボードとマウスを使った探索体験を提供

---

## デバイス向き許可フロー

### `permissionGranted` state

- 初期値:
  - `localStorage.getItem('deviceOrientationPermission') === 'granted'` なら `true`
  - それ以外は `false`

### 自動チェック

- モバイルの場合（`isMobile === true`）:
  - `deviceorientation` イベントが発火するかどうかを 3 秒間監視
  - 発火した場合:
    - `permissionGranted = true`
    - `localStorage` に `'granted'` を保存

### 明示的な許可要求 (`handleDeviceOrientationPermission`)

- iOS Safari 等で必要なフロー:

```ts
if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
  const permission = await (DeviceOrientationEvent as any).requestPermission();
  if (permission === 'granted') {
    setPermissionGranted(true);
    localStorage.setItem('deviceOrientationPermission', 'granted');
  }
}
```

- `permissionGranted === false` かつ `isMobile === true` の場合、
  画面中央に「デバイス向きの許可が必要です」というオーバーレイボックスとボタンを表示

---

## 環境設定とライト

- `Sky`
  - `distance={1000}`
  - `sunPosition={[100, 50, 100]}`
  - `inclination={0.49}`, `azimuth={0.25}`
- `Environment`
  - `preset="sunset"`
- ライト:
  - `ambientLight`:
    - `intensity={0.6}`, `color="#ffffff"`
  - `directionalLight`:
    - 位置: `[1000, 100, 50]`
    - `intensity={1.0}`, `castShadow={true}`
    - `shadow-mapSize-width/height={2048}`

---

## LakeModel の配置

```tsx
<LakeModel 
  position={[1552 / 2, 0, -1552 / 2]}
  scale={[1, 1, 1]}
  rotation={[0, 0, 0]}
  visible={true}
  showTerrain={true}
  showWater={true}
  terrainScale={[10, 10, 10]}
  waterScale={[10, 10, 10]}
  waterPosition={[0, 0, 0]}
/>
```

- `position`: シーン内で湖モデルを原点からずらすためのオフセット
- `terrainScale` / `waterScale`: 地形と水面のスケール（実寸モデルに対する拡大倍率）
- `showTerrain` / `showWater`: 地形・水面の表示切替（将来的な演出に利用可能）

---

## エラーハンドリングビュー

### 初期化中

- 条件: `webglSupport === null`
- 表示内容:
  - フルスクリーンの青背景 + 「3D環境を初期化中...」

### WebGL 未対応

- 条件: `renderer === 'none'`
- 表示内容:
  - フルスクリーンの赤背景
  - タイトル: 「WebGL未対応」
  - 説明: 利用可能なブラウザ（Chrome / Firefox / Safari 等）への切り替えを促す文言

---

## 利用上の注意

1. **HTTPS 必須**
   - デバイス向き・モーションなど一部のセンサーは HTTPS 環境でのみ動作する

2. **モバイルブラウザ差異**
   - iOS Safari では `DeviceOrientationEvent.requestPermission` が必要
   - Android Chrome では自動的に有効になる場合が多い

3. **パフォーマンス**
   - 3D 表示は端末性能に依存するため、低スペック端末ではフレームレートが低下する可能性がある
   - 必要に応じて `renderer` 判定や画質設定の調整を検討

4. **将来的なセンサー統合**
   - 現状 `Scene3D` は `useSensors` を直接利用していないが、  
     今後 GPS と連動したカメラ位置や、`SensorManager` を通じた一元管理に移行する余地がある




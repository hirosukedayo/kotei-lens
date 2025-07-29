# 技術仕様書

## 概要

本ドキュメントでは、湖底レンズプロジェクトの技術的な実装仕様について詳述します。2025年の最新Web3D技術とTypeScriptを活用した、型安全で高性能なアプリケーション開発を目指します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐
│   クライアント    │
│  (Webブラウザ)   │
│   WebGPU/WebGL2  │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────┴────────┐
│  GitHub Pages   │
│  (静的ホスティング) │
│    + CDN        │
└─────────────────┘
```

### 技術スタック

- **言語**: TypeScript 5.4+
- **3Dレンダリング**: Three.js r163+ (WebGPURenderer対応)
- **フレームワーク**: React 18.3+ with React Three Fiber
- **状態管理**: Zustand
- **ビルドツール**: Vite 5.2+
- **パッケージマネージャー**: pnpm 9.0+
- **リンター/フォーマッター**: ESLint, Prettier, Biome

### ディレクトリ構造

```
kotei-lens/
├── index.html              # エントリーポイント
├── package.json
├── tsconfig.json          # TypeScript設定
├── vite.config.ts         # Viteビルド設定
├── src/
│   ├── main.tsx           # アプリケーションエントリー
│   ├── App.tsx            # ルートコンポーネント
│   ├── components/        # UIコンポーネント
│   │   ├── viewer/        # 3Dビューアー関連
│   │   ├── ui/           # UI要素
│   │   └── map/          # 地図関連
│   ├── hooks/            # カスタムフック
│   ├── stores/           # Zustand stores
│   ├── services/         # ビジネスロジック
│   │   ├── sensors/      # センサー管理
│   │   ├── renderer/     # 3Dレンダリング
│   │   └── data/         # データ管理
│   ├── types/            # TypeScript型定義
│   ├── utils/            # ユーティリティ関数
│   └── workers/          # Web Workers
├── public/
│   ├── models/           # 3Dモデル (glTF/GLB)
│   ├── textures/         # テクスチャ (KTX2/WebP)
│   └── data/             # 静的データ
└── docs/                 # ドキュメント
```

## センサー仕様

### 位置情報 (GPS)

**使用API**: Geolocation API

```typescript
// 型定義
interface GPSOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

// 位置情報サービス
class LocationService {
  private options: GPSOptions = {
    enableHighAccuracy: true,    // 高精度モード
    timeout: 10000,              // タイムアウト: 10秒
    maximumAge: 5000            // キャッシュ有効期限: 5秒
  };

  async getCurrentPosition(): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(this.convertPosition(position)),
        (error) => reject(error),
        this.options
      );
    });
  }

  private convertPosition(position: GeolocationPosition): GPSPosition {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
  }
}
```

**座標系**: WGS84 (世界測地系)
- 小河内ダム周辺エリア: 
  - 北緯: 35.785° 〜 35.795°
  - 東経: 139.045° 〜 139.055°

### デバイス方位

**使用API**: DeviceOrientationEvent

```typescript
// 型定義
interface DeviceOrientation {
  alpha: number | null;  // Z軸周りの回転 (0-360°)
  beta: number | null;   // X軸周りの回転 (-180-180°)
  gamma: number | null;  // Y軸周りの回転 (-90-90°)
  absolute: boolean;
}

// デバイス方位サービス
class OrientationService {
  private magneticDeclination = 7.3; // 東京の磁気偏角（西偏）
  
  async requestPermission(): Promise<boolean> {
    // iOS 13+ では許可が必要
    if ('DeviceOrientationEvent' in window && 
        'requestPermission' in DeviceOrientationEvent) {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      return permission === 'granted';
    }
    return true;
  }

  startTracking(callback: (orientation: DeviceOrientation) => void): void {
    window.addEventListener('deviceorientationabsolute', (event) => {
      callback({
        alpha: this.correctMagneticDeclination(event.alpha),
        beta: event.beta,
        gamma: event.gamma,
        absolute: true
      });
    });
  }

  private correctMagneticDeclination(alpha: number | null): number | null {
    if (alpha === null) return null;
    return (alpha + this.magneticDeclination + 360) % 360;
  }
}
```

**補正処理**:
- 磁北と真北の偏角補正（東京: 約7.3°西偏）
- iOS/Android間の差異を吸収
- デバイス許可のハンドリング

### モーションセンサー

**使用API**: DeviceMotionEvent

```typescript
// 型定義
interface DeviceMotion {
  acceleration: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  rotationRate: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  };
  interval: number;
}

// モーション検知サービス
class MotionService {
  private threshold = 2.0; // 歩行検知の閾値
  
  startTracking(callback: (motion: DeviceMotion) => void): void {
    window.addEventListener('devicemotion', (event) => {
      if (event.accelerationIncludingGravity) {
        callback({
          acceleration: {
            x: event.accelerationIncludingGravity.x,
            y: event.accelerationIncludingGravity.y,
            z: event.accelerationIncludingGravity.z
          },
          rotationRate: {
            alpha: event.rotationRate?.alpha || null,
            beta: event.rotationRate?.beta || null,
            gamma: event.rotationRate?.gamma || null
          },
          interval: event.interval
        });
      }
    });
  }

  detectWalking(motion: DeviceMotion): boolean {
    const { x, y, z } = motion.acceleration;
    if (x === null || y === null || z === null) return false;
    
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    return Math.abs(magnitude - 9.8) > this.threshold;
  }
}
```

## 3Dビュー仕様

### レンダリングエンジン

**コア技術**: Three.js r163+ with React Three Fiber 8.16+
**レンダラー**: WebGPURenderer (WebGL2フォールバック対応)

```typescript
// React Three Fiberを使用した3Dシーン設定
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';

interface SceneConfig {
  camera: {
    fov: number;
    near: number;
    far: number;
    position: [number, number, number];
  };
  renderer: {
    antialias: boolean;
    powerPreference: 'high-performance' | 'low-power' | 'default';
    toneMapping: THREE.ToneMapping;
    toneMappingExposure: number;
  };
}

const sceneConfig: SceneConfig = {
  camera: {
    fov: 60,
    near: 0.1,
    far: 2000,  // 2km表示範囲
    position: [0, 10, 30]
  },
  renderer: {
    antialias: true,
    powerPreference: 'high-performance',
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0
  }
};

// WebGPU対応チェック
const useWebGPU = async (): Promise<boolean> => {
  if ('gpu' in navigator) {
    const adapter = await navigator.gpu?.requestAdapter();
    return !!adapter;
  }
  return false;
};
```

### 座標変換システム

```typescript
// GPS座標からローカル3D座標への変換
class CoordinateTransformer {
  private origin: { lat: number; lng: number };
  private scale = 100000; // 1度 ≈ 100km → 1000単位

  constructor(originLat: number, originLng: number) {
    this.origin = { lat: originLat, lng: originLng };
  }

  gpsToLocal(lat: number, lng: number, alt: number = 0): THREE.Vector3 {
    const x = (lng - this.origin.lng) * this.scale;
    const z = -(lat - this.origin.lat) * this.scale; // Z軸は北向き
    const y = alt * 0.1; // 高度スケール調整
    return new THREE.Vector3(x, y, z);
  }

  localToGPS(position: THREE.Vector3): { lat: number; lng: number; alt: number } {
    return {
      lat: this.origin.lat - position.z / this.scale,
      lng: this.origin.lng + position.x / this.scale,
      alt: position.y * 10
    };
  }
}
```

### 3Dモデル仕様

**ファイル形式**: glTF 2.0 with extensions
- **圧縮**: KHR_draco_mesh_compression (Draco圧縮)
- **テクスチャ**: KHR_texture_basisu (KTX2形式)
- **マテリアル**: KHR_materials_variants (環境別マテリアル)

```typescript
// モデルローダー設定
import { useGLTF } from '@react-three/drei';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

// Dracoデコーダー設定
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' });

// KTX2ローダー設定
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/basis/');
```

**LOD (Level of Detail) システム**:
```typescript
interface LODConfig {
  high: { distance: 50, polygons: 15000, texture: 2048 };
  medium: { distance: 150, polygons: 5000, texture: 1024 };
  low: { distance: 500, polygons: 1000, texture: 512 };
}
```

### 表示モード

#### 1. イマーシブ3Dビューモード
- デバイスの向きに連動した1人称視点
- スムーズなカメラ移動とジャイロ連動
- 霧効果による奥行き表現
- リアルタイム影とアンビエントオクルージョン

```typescript
// デバイス方位とカメラの連動
const useDeviceOrientationControls = () => {
  const { camera } = useThree();
  const orientation = useDeviceOrientation();

  useFrame(() => {
    if (orientation.alpha && orientation.beta && orientation.gamma) {
      // クォータニオンでスムーズな回転
      const quaternion = new THREE.Quaternion();
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(orientation.beta),
        THREE.MathUtils.degToRad(orientation.alpha),
        THREE.MathUtils.degToRad(orientation.gamma),
        'YXZ'
      );
      quaternion.setFromEuler(euler);
      camera.quaternion.slerp(quaternion, 0.1);
    }
  });
};
```

#### 2. エクスプローラーモード
- 自由なカメラ操作（OrbitControls）
- ミニマップ表示
- 建物のハイライトとインタラクション
- 時代切り替えスライダー

#### 3. ガイドツアーモード
- プリセットカメラパスアニメーション
- ナレーション同期
- ポイントオブインタレスト表示
- インタラクティブタイムライン

## データ仕様

### TypeScript型定義

```typescript
// GeoJSON型定義
interface VillageFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][];
  };
  properties: BuildingProperties;
}

interface BuildingProperties {
  id: string;
  name: {
    ja: string;
    en: string;
  };
  type: 'residential' | 'commercial' | 'education' | 'religious' | 'infrastructure';
  subtype: string;
  construction: {
    yearBuilt: number;
    yearRenovated?: number[];
    yearDemolished: number;
    material: 'wood' | 'stone' | 'concrete' | 'mixed';
    floors: number;
    height: number;
  };
  model: {
    url: string;
    lod: {
      high: string;
      medium: string;
      low: string;
    };
    transform?: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
    };
  };
  metadata: {
    description: string;
    capacity?: number;
    notableFeatures?: string[];
  };
  media: {
    photos: PhotoAsset[];
    audio: AudioAsset[];
  };
  stories: string[]; // Story IDs
}

interface PhotoAsset {
  url: string;
  year: number;
  caption: string;
  tags?: string[];
}

interface AudioAsset {
  url: string;
  type: 'ambient' | 'narration' | 'effect';
  caption: string;
  duration?: number;
}
```

### ストーリーデータ

```typescript
interface Story {
  id: string;
  title: LocalizedText;
  locationId: string;
  coordinates: [number, number];
  period: {
    start: string; // ISO 8601
    end: string;
  };
  content: {
    text: LocalizedText;
    narrator?: {
      name: string;
      role: string;
      ageAtEvent?: number;
    };
  };
  media: {
    audio?: {
      url: string;
      duration: number;
      transcript?: string;
    };
    images?: StoryImage[];
  };
  triggers: {
    proximity?: {
      enabled: boolean;
      radius: number;
      notification: string;
    };
    time?: {
      enabled: boolean;
      hour?: number;
    };
  };
  tags: string[];
}

interface LocalizedText {
  ja: string;
  en?: string;
}

interface StoryImage {
  url: string;
  caption: string;
  persons?: string[]; // Person IDs
}
```

### データ検証

```typescript
import { z } from 'zod';

// Zodスキーマで型安全なデータ検証
const BuildingPropertiesSchema = z.object({
  id: z.string().regex(/^building_\d{3}$/),
  name: z.object({
    ja: z.string().min(1),
    en: z.string().min(1)
  }),
  type: z.enum(['residential', 'commercial', 'education', 'religious', 'infrastructure']),
  construction: z.object({
    yearBuilt: z.number().min(1800).max(1957),
    yearDemolished: z.number().min(1957).max(1958),
    height: z.number().positive()
  })
  // ... 他のフィールド
});

// 実行時検証
const validateBuildingData = (data: unknown): BuildingProperties => {
  return BuildingPropertiesSchema.parse(data);
};
```

## パフォーマンス最適化

### レンダリング最適化

```typescript
// インスタンスドメッシュで大量オブジェクト最適化
import { InstancedMesh } from 'three';

class BuildingRenderer {
  private instancedMeshes: Map<string, InstancedMesh>;
  
  // GPU Instancingによる最適化
  createInstancedBuildings(type: string, count: number): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    
    // フラスタムカリング有効化
    mesh.frustumCulled = true;
    
    this.instancedMeshes.set(type, mesh);
  }
  
  // 動的LOD切り替え
  updateLOD(camera: THREE.Camera): void {
    this.instancedMeshes.forEach((mesh) => {
      const distance = camera.position.distanceTo(mesh.position);
      mesh.visible = distance < 1000; // 1km以内のみ表示
    });
  }
}

// React Three Fiberでの最適化
const OptimizedScene: React.FC = () => {
  return (
    <Canvas
      gl={{
        powerPreference: "high-performance",
        antialias: false, // MSAAの代わりにFXAAを使用
        stencil: false,
        depth: true
      }}
      dpr={[1, 2]} // デバイスピクセル比の制限
      performance={{ min: 0.5 }} // 自動品質調整
    >
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
};
```

### データ最適化

```typescript
// プログレッシブローディング
class AssetLoader {
  private cache = new Map<string, any>();
  private loadingQueue: LoadTask[] = [];
  
  async loadProgressive(assets: Asset[]): Promise<void> {
    // 優先度順にソート
    const sorted = assets.sort((a, b) => a.priority - b.priority);
    
    // 並列ローディング（最大6接続）
    const chunks = this.chunk(sorted, 6);
    for (const chunk of chunks) {
      await Promise.all(chunk.map(asset => this.loadAsset(asset)));
    }
  }
  
  // Service Worker登録
  async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration.scope);
    }
  }
}

// Viteでの最適化設定
export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          'vendor': ['react', 'react-dom', 'zustand']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber']
  }
});
```

### メモリ・バッテリー最適化

```typescript
// リソース管理
class ResourceManager {
  private disposables = new Set<THREE.Object3D>();
  
  // 自動メモリ解放
  dispose(): void {
    this.disposables.forEach(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.disposables.clear();
  }
  
  // バックグラウンド時の処理停止
  setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseRendering();
      } else {
        this.resumeRendering();
      }
    });
  }
}
```

## セキュリティ・プライバシー

### Content Security Policy

```typescript
// CSPヘッダー設定
const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'", // WebAssembly対応
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://api.github.com",
    "worker-src 'self' blob:"
  ].join('; ')
};

// 位置情報の暗号化
class SecureStorage {
  private key: CryptoKey | null = null;
  
  async encrypt(data: any): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    
    if (!this.key) {
      this.key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encoded
    );
    
    return encrypted;
  }
}
```

## ブラウザ互換性

### 対応ブラウザ (2025年基準)
- Chrome 120+ (Android/Desktop) - WebGPU対応
- Safari 17+ (iOS 17+/macOS 14+) - WebGPU部分対応
- Firefox 120+ (Android/Desktop) - WebGL2のみ
- Edge 120+ (Desktop) - WebGPU対応

### 必須機能と代替実装

```typescript
// 機能検出とフォールバック
class FeatureDetector {
  static async checkFeatures(): Promise<FeatureSupport> {
    return {
      webgpu: await this.checkWebGPU(),
      webgl2: this.checkWebGL2(),
      geolocation: 'geolocation' in navigator,
      deviceOrientation: await this.checkDeviceOrientation(),
      serviceWorker: 'serviceWorker' in navigator,
      webAssembly: typeof WebAssembly !== 'undefined',
      offscreenCanvas: 'OffscreenCanvas' in window
    };
  }
  
  private static async checkWebGPU(): Promise<boolean> {
    if (!('gpu' in navigator)) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }
}
```

## エラーハンドリング

```typescript
// エラーバウンダリー
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('3D Scene Error:', error, info);
    // Sentryなどへの送信
  }
}

// グローバルエラーハンドラー
class ErrorHandler {
  static handle(error: AppError): void {
    switch (error.type) {
      case 'LOCATION_DENIED':
        this.showLocationFallback();
        break;
      case 'WEBGL_NOT_SUPPORTED':
        this.showCompatibilityWarning();
        break;
      case 'NETWORK_OFFLINE':
        this.enableOfflineMode();
        break;
    }
  }
}
```

## 開発環境

### 技術スタック (2025年版)
```json
{
  "devDependencies": {
    "@types/three": "^0.163.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0",
    "playwright": "^1.42.0",
    "@biomejs/biome": "^1.6.0"
  },
  "dependencies": {
    "three": "^0.163.0",
    "@react-three/fiber": "^8.16.0",
    "@react-three/drei": "^9.100.0",
    "react": "^18.3.0",
    "zustand": "^4.5.0",
    "zod": "^3.22.0"
  }
}
```

### 開発ツール設定

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    glsl(), // GLSLシェーダーサポート
    wasm(), // WebAssemblyサポート
    pwa() // PWA機能
  ],
  server: {
    https: true, // センサーAPI用
    host: true // モバイルデバッグ用
  }
});

// TypeScript設定
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "strict": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "@types/three"]
  }
}
```

### テスト環境

```typescript
// Vitest設定
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'test/']
    }
  }
});

// E2Eテスト（Playwright）
test('3D scene loads correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas');
  const canvas = await page.$('canvas');
  expect(canvas).toBeTruthy();
});
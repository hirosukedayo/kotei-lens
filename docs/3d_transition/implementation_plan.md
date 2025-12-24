# 3Dモード切り替えフローの改善計画

3Dモードへの遷移時に発生する複数の確認ステップを簡略化し、ユーザー体験を向上させます。また、3Dビュー内で表示される独自の確認モーダルを廃止し、アプリ全体で統一された権限要求UI (`SensorPermissionRequest`) を使用します。

## 現状の課題
- 3Dアイコンクリック時に、OS/ブラウザレベルの許可や独自の確認が分散している。
- 3Dビュー (`Scene3D`) に遷移した後も、モバイル端末では独自の黒背景モーダルで再度権限を要求される場合がある。
- Reactコンポーネントのアンマウント時にセンサーが停止するため、画面遷移（2D→3D）のたびにiOSで再度権限要求（ユーザー操作が必要）が発生するリスクがある。

## 変更内容

### [services/sensors]
#### [MODIFY] [OrientationService.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/services/sensors/OrientationService.ts)
- **権限状態のキャッシュ**: `permissionState` プロパティを追加し、一度 `granted` になった場合はその状態を保持します。
- **再要求のスキップ**: `startTracking` メソッド内で、既に `permissionState === 'granted'` の場合は `requestPermission()` の呼び出しをスキップするように変更します。
- これにより、`OkutamaMap2D` で許可を得た後、`Scene3D` に遷移（コンポーネントが再マウント）した際に、ユーザー操作なし（`useEffect` 内）でスムーズにセンサーを再開できるようになります（iOS対策）。

### [components/map]
#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)
- `handleRequest3DWithPermission` を改修し、遷移前の事前チェックロジック ("Pre-flight check") を導入します。
- **チェック内容**: GPS、Orientation、Motion の各センサー権限が既に `granted` であるか確認。
- **全OKの場合**: 即座に `onRequest3D` を呼び出し、3Dモードへ遷移します（モーダル等は一切表示しません）。
- **NGがある場合**: `SensorPermissionRequest` コンポーネントを表示します。
- `showPermissionModal` stateを追加し、未許可時に `true` に設定します。
- JSX内に `SensorPermissionRequest` を追加し、条件付きレンダリングします。
    - `onPermissionsGranted`: 3D遷移を実行し、モーダルを閉じます。
    - `onPermissionsDenied`: モーダルを閉じ、必要に応じてトーストで理由を表示します（オプション）。

### [components/viewer]
#### [MODIFY] [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)
- **独自モーダルの削除**: `isMobile && !permissionGranted` で表示している黒背景の独自モーダル (div) を削除します。
- **SensorPermissionRequestの導入**: 代わりに `SensorPermissionRequest` コンポーネントを使用します。
- **初期化ロジックの改善**:
    - マウント時に `useEffect` で `startSensors()` を呼び出し、権限状態を確認します。
    - iOSの場合、`OkutamaMap2D` からの遷移であればキャッシュされた権限により自動開始されます。
    - 直接URLを開いた場合などは自動開始に失敗する可能性があるため、その場合は `SensorPermissionRequest` を表示してユーザー操作を促します。
-これにより、2Dマップでの事前チェックですでに許可済みの場合は何も表示されず、直接ブックマーク等から3Dビューを開いた場合でも統一されたUIで権限を要求できます。

### [components/ui]
#### [MODIFY] [SensorPermissionRequest.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/ui/SensorPermissionRequest.tsx)
- **モダンデザインへの刷新**:
    - **背景**: `backdrop-filter: blur` を使用したグラスモーフィズム効果を採用し、没入感を高めます。暗めの半透明オーバーレイでコンテンツを際立たせます。
    - **アニメーション**: 新規追加された `framer-motion` を使用し、モーダルの出現（Fade In + Scale Up）やボタンのタップアクションに滑らかな動きをつけます。
    - **タイポグラフィ**: システムフォントスタックを使用しつつ、ウェイトやスペーシングを調整して可読性とプレミアム感を向上させます。
    - **アイコン**: 絵文字から `react-icons` (FaMapMarkerAlt, FaCompass, FaWalking 等) に変更し、プロフェッショナルな印象にします。
    - **インタラクション**: ボタンにホバー/タップ時のスケールアニメーションや、許可状況に応じたスムーズな色変化を実装します。

## Feasibility & Risk Assessment
- **iOSのジェスチャー要件**:
    - iOS Safariでは `DeviceOrientationEvent.requestPermission()` は必ずユーザー操作（クリック/タップ）の直後に呼び出す必要があります。
    - アプリ起動時（`useEffect`）の自動チェックで `requestPermission` を呼ぶと失敗するため、`OrientationService` 側で「未許可（または不明）」の場合は即座に Promise を reject せず、UI上のボタン押下を待つフローが必要です。
    - **対策**: `Scene3D` 初期化時は、まず `permissionState` キャッシュや `DeviceOrientationEvent` の存在確認のみ行い、ユーザー操作なしでの `requestPermission` 呼び出しは避けます（または失敗を許容してUIを出す）。本計画では、自動開始に失敗した場合は必ず `SensorPermissionRequest` を表示することで、"ユーザー操作による再試行" を自然に誘導する設計とし、技術的な制約をクリアします。
- **AndroidのHTTPS要件**:
    - Android Chrome等はHTTPS必須ですが、本番環境はVercel/Cloudflare等でHTTPS化されるため問題ありません。ローカル開発時は `vite-plugin-mkcert` 等が必要になる場合がありますが、現状は特に追加しません（実機デバッグはHTTPS環境推奨）。

## Verification Plan

### Manual Verification
1. **全権限許可済みケース（2D→3D）**:
    - アプリをリロードし、既にセンサー許可済みの状態で「3Dボタン」をクリック。
    - モーダルが出ずに直接3Dビューへ遷移することを確認。
    - 3Dビューでもセンサー（ジャイロ移動等）が機能していることを確認（重要）。
2. **権限未許可ケース**:
    - ブラウザの権限設定をリセット、またはプライベートブラウザでアクセス。
    - 「3Dボタン」をクリック。
    - デザイン刷新された `SensorPermissionRequest` がアニメーション付きで表示されることを確認。
    - 「許可する」を進め、全て許可した後にアプリが開始（3D遷移）することを確認。
3. **リロード/直接アクセスケース**:
    - 3Dビュー (`/view` 等、もしあれば) を直接リロード。
    - 必要に応じてモーダルが表示され、許可後に機能することを確認。

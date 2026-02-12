# 方位取得許可の2Dモード起動時取得 & ユーザーアイコンのGoogle Maps風変更

## 背景

現状、方位（DeviceOrientation）の許可は3Dモードへの遷移時に初めて取得される。そのため、2Dモードでユーザー位置マーカーの向きが反映されない。
また、ユーザー位置のアイコンは矢印型SVGだが、Google Maps風のドット+視野円弧に変更する。

## 要件

1. **方位許可を2Dモード起動時に取得する** — アプリ起動直後に方位許可のリクエストを行い、許可が得られれば方位をリアルタイムで反映
2. **ユーザー位置アイコンをGoogle Maps風に変更** — 中心に青い丸（ドット）、視野方向にグラデーションの扇形（円弧）が広がるスタイル
3. **方位許可が取れなかった場合** — 円弧を非表示にし、青い丸のみ表示

## 変更方針

### 問題の根本原因

`useSensors.ts`の`startSensors()`は、2Dモード起動時に`autoRequest=false`で呼ばれる（L105）。
`OrientationService.startTracking()`は`autoRequestPermission=false`の場合、未許可なら方位のトラッキングをスキップする（L65-71）。

iOSでは`DeviceOrientationEvent.requestPermission()`がユーザーインタラクション（ボタンクリック等）内での呼び出しを要求するため、自動でリクエストはできない。

---

### コンポーネント1: 方位許可の2Dモード起動時取得

#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)

- 2Dモード表示時に、方位許可が未取得の場合、許可取得用のバナー（ボタン）を画面上部に表示
- ユーザーがタップすると`OrientationService.requestPermission()`を呼び出し、許可が得られたら`startSensors(true, true)`でセンサーを再起動
- 許可状態を追跡する`headingPermission`ステートを追加
- 許可が得られたか否かを`CurrentLocationMarker`に`hasHeading`プロパティで伝達

**実装詳細:**
- 初回マウント時に`sensorManager.orientationService.getPermissionState()`をチェック
- `unknown`または`prompt`の場合、画面上部に「🧭 方位を有効にする」ボタンを表示
- ボタンクリック時（ユーザーインタラクション内なのでiOSでも動作）:
  1. `sensorManager.orientationService.requestPermission()` を呼び出し
  2. 許可が得られたら `startSensors(true, true)` でセンサー再起動
  3. `headingPermission` を `'granted'` に更新
- 許可が拒否された場合はバナーを非表示にし、`headingPermission` を `'denied'` に設定

---

### コンポーネント2: ユーザー位置アイコンのGoogle Maps風変更

#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)

`CurrentLocationMarker`コンポーネントのSVGを以下に変更:

- **中心の青い丸**: `#4285F4`（Google Blue）、白い縁取り付き
- **視野の扇形**: 中心から前方に広がるグラデーション扇形（視野角約70度）
  - 中心部は不透明度が高く、外側に向かって透明になる
  - デバイスの方位に応じて全体を回転
- **方位データがない場合**: 円弧を非表示にし、青い丸のみ表示

**propsの変更:**
- `hasHeading: boolean` を追加し、方位許可状態に応じて円弧の表示/非表示を切り替え


### コンポーネント3: 2Dマーカーの改善（形状・重なり・アニメーション）

#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)

**1. 扇形の形状改善（Google Maps風）**
- 現在の`path`による扇形から、よりソフトなグラデーションを持つ形状に変更
- 視野角を広げる（約90度）
- `radialGradient`のストップ位置を調整し、中心から外側へ自然にフェードアウトさせる

**2. 表示順序（z-index）の修正**
- マーカが湖（ポリゴンレイヤー等）の下に隠れないよう、Leafletの`Marker`コンポーネントに `zIndexOffset={1000}` を追加

**3. 呼吸アニメーション（パルス）の追加**
- ユーザー位置を示す青いドットの外側に、拡縮・フェードアウトする波紋（パルス）アニメーションを追加
- SVG内に`<style>`タグでキーフレームアニメーション（`@keyframes pulse`）を定義し、外側の円（`<circle ... />`）に適用

---

## 検証計画

### ビルド検証

```bash
pnpm run lint
pnpm run build
```

### 手動検証

ユーザーに実機での確認を依頼:
- 2Dモード起動時に方位許可バナーが表示される
- 許可タップ後、iOSダイアログが表示される
- 許可取得後、円弧付きマーカーが方位に追従する
- 許可拒否後、青い丸のみ表示される
- 3Dモードへの遷移が正常動作する

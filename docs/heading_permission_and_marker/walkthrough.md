# Walkthrough: 方位許可バナー & Google Maps風マーカー

## 変更内容

### [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)

render_diffs(file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)

#### 1. 方位許可バナー
- `headingPermission` ステートで許可状態を管理（`unknown` / `prompt` / `granted` / `denied`）
- iOS（`DeviceOrientationEvent.requestPermission`が必要）の場合、画面上部に「🧭 方位を有効にする」ボタンを表示
- ユーザータップで許可リクエスト → 許可取得後にセンサー再起動

#### 2. Google Maps風マーカー
- 中心に青い丸 (`#4285F4`) + 白い縁取り
- 方位許可あり: 視野方向にグラデーション扇形（70度）が広がる
- 方位許可なし: 青い丸のみ表示

## 検証結果

| 項目 | 結果 |
|------|------|
| `pnpm run lint` | ✅ |
| `pnpm run build` | ✅ |

## ブランチ

`feat/heading-permission-and-marker-style` にプッシュ済み。

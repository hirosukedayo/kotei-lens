# Toast コンポーネント仕様

## 概要

`Toast` は、画面下部に一時的な通知を表示するための共通 UI コンポーネントです。  
情報・成功・警告・エラーといったメッセージを、数秒間だけユーザーに分かりやすく伝える目的で使用します。

- 実装ファイル: `src/components/ui/Toast.tsx`
- 利用例: 2D マップ画面の「体験エリア外」通知 など

---

## API

### コンポーネント

```tsx
import { Toast } from '../ui/Toast';
```

```tsx
function Example() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>通知を表示</button>
      <Toast
        open={open}
        onClose={() => setOpen(false)}
        message="操作が完了しました"
        variant="success"
        duration={4000}
      />
    </>
  );
}
```

### Props

- **`message`**
  - 型: `string`
  - 必須: はい
  - 説明: トーストに表示するメッセージ文字列

- **`open`**
  - 型: `boolean`
  - 必須: はい
  - 説明: トーストの表示状態
    - `true`: 表示
    - `false`: 非表示

- **`onClose`**
  - 型: `() => void`
  - 必須: いいえ
  - 説明: トーストが閉じられたタイミングで呼ばれるコールバック  
    自動クローズ時・親コンポーネント側で `open` を `false` に戻したい場合に使用。

- **`duration`**
  - 型: `number | undefined`
  - デフォルト: `4000` (ms)
  - 説明: 自動クローズまでの時間（ミリ秒）
    - 数値を指定: 指定時間後に自動的に非表示にし、`onClose` を呼ぶ
    - `undefined` / `null`: 自動クローズしない（閉じるには `open` を `false` にする必要あり）

- **`variant`**
  - 型: `'info' | 'success' | 'warning' | 'error'`
  - デフォルト: `'info'`
  - 説明: メッセージの種類に応じた色分け

#### バリアントごとのスタイル

内部的に以下の色を使用:

| variant   | 背景色                                     | 文字色     | 用途                         |
|-----------|--------------------------------------------|------------|------------------------------|
| `info`    | `rgba(37, 99, 235, 0.95)`   (青)          | `#f9fafb`  | 一般的なお知らせ            |
| `success` | `rgba(22, 163, 74, 0.95)`   (緑)          | `#f9fafb`  | 成功メッセージ              |
| `warning` | `rgba(234, 179, 8, 0.95)`   (黄)          | `#111827`  | 注意が必要な状態            |
| `error`   | `rgba(220, 38, 38, 0.95)`   (赤)          | `#f9fafb`  | エラー・重大な問題の通知    |

---

## レイアウト仕様

`Toast` 自身は `position: absolute` で描画され、親要素の右記を前提とします:

- 親要素に `position: relative` または `position: fixed` が付与されていること
- 通常は画面全体を覆うラッパコンテナ（例: 2D マップのルート `div`）直下に配置

表示位置・スタイル（抜粋）:

- 位置:
  - `bottom: 24px`
  - `left: 50%`
  - `transform: translateX(-50%)`
- サイズ: `maxWidth: 90vw`
- 角丸: `borderRadius: 9999` （ピル型）
- 影: `boxShadow: 0 4px 12px rgba(0,0,0,0.35)`
- フォント:
  - `fontSize: 13px`
  - `lineHeight: 1.5`

---

## 動作仕様

1. **表示制御**
   - `open` が `true` になると即時表示される
   - `open` が `false` になると非表示

2. **自動クローズ**
   - `duration` が指定されている場合のみ、自動クローズロジックが有効
   - `open === true` かつ `duration` が数値のとき:
     - `setTimeout(duration)` 後に内部状態 `visible` を `false` にし、`onClose` を呼び出す

3. **手動クローズ**
   - 親側で `open` を `false` に変更することで非表示にできる
   - UI上には「×」ボタン等は現状設けていない（必要であれば将来拡張）

4. **複数インスタンス**
   - 複数の `Toast` を同一画面に配置可能（それぞれが独立した `open` / `duration` を持つ）
   - 現状、スタック表示（縦に積み上げる）は未実装

---

## 使用例

### 成功メッセージ（デフォルト 4 秒）

```tsx
<Toast
  open={showSuccess}
  onClose={() => setShowSuccess(false)}
  message="保存が完了しました。"
  variant="success"
/>
```

### 自動クローズなし（重要通知）

```tsx
<Toast
  open={showImportant}
  onClose={() => setShowImportant(false)}
  message="重要な設定変更が完了しました。確認後に閉じてください。"
  duration={undefined}
  variant="warning"
/>
```

### 任意の表示時間（10 秒）

```tsx
<Toast
  open={showLong}
  onClose={() => setShowLong(false)}
  message="10秒間だけ表示されるトーストです。"
  duration={10000}
  variant="info"
/>
```

### 体験エリア外通知（`OkutamaMap2D` での利用）

```tsx
const [showOutsideToast, setShowOutsideToast] = useState(false);

// エリア判定結果に応じてフラグを更新
if (isInArea) {
  setShowOutsideToast(false);
} else {
  setShowOutsideToast(true);
}

<Toast
  open={showOutsideToast}
  onClose={() => setShowOutsideToast(false)}
  variant="warning"
  message="現在、体験エリアの外にいます。小河内神社付近（奥多摩湖周辺）に近づくと、かつての村の姿を重ねて見ることができます。"
/>
```

---

## 今後の拡張アイデア

- フェードイン／フェードアウトのアニメーション付与
- 左右位置の切り替え（右下トーストなど）
- アイコン（✔️, ⚠️, ❌ など）の追加
- アクションボタン（「元に戻す」など）のサポート
- グローバルな Toast キュー（`ToastProvider` + `useToast()`）の導入




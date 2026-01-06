# 実装計画 - UI/UXおよび機能のアップデート (2025/12/26)

## ゴールの説明
2025/12/26に要望されたバグ修正とUI/UX改善を実装します。これには、コンパス/センサーの読み込み問題の修正、2D/3Dモードの遷移と操作性の改善、「現在地に戻る」機能の追加が含まれます。

## ユーザー確認事項
> [!IMPORTANT]
> **コンパス/センサー修正戦略 (詳細)**: 
> iOSでは、デバイスの方位（ジャイロ）権限を取得するためにユーザージェスチャー（タップなど）が必要です。現在、アプリ読み込み時に自動的にリクエストしようとして失敗（サイレントエラー）しており、リロードや適切な再トリガーがない限りセンサーが機能しない状態になっています。
> **変更点**: 
> 1.  `useSensors`（マウント時）は、`requestPermission`を**自動実行しません**。過去のセッションで権限が既に許可されている場合のみ、イベントをリッスンします。
> 2.  2Dマップの「視界コーン（現在の向き）」は、ユーザーが「3Dモード」ボタンを押すか、新規に「コンパス有効化」ボタン（もし追加する場合）を押すまで、iOSの初回起動時には**表示されません**。
> 3.  「3Dモード」ボタンのクリック動作を、権限リクエストの明示的なトリガーとして利用します。

## 提案される変更

### センサー & コアロジック

#### [MODIFY] [OrientationService.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/services/sensors/OrientationService.ts)
- `startTracking` を修正:
    - 最初に権限状態をチェックします。
    - `permissionState` が `unknown` または `prompt` の場合、`requestPermission()` を自動的に呼び出しません。
    - 権限が必要であることを示す警告またはステータスを返します。
- `requestPermission()` をUIハンドラから安全に呼び出せるように公開されていることを確認します。

#### [MODIFY] [useSensors.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/hooks/useSensors.ts)
- `startSensors` を更新:
    - `startTracking` からの「権限が必要」という状態をキャッチします。
    - エラーにはせず、後で権限が付与されるまで方位データなしで続行します。

### 2Dマップ (OkutamaMap2D)

#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)
- **ピン選択**: 「リストモード」でドロワーを開くロジックを削除します。フラグを渡すか、`PinListDrawer` 側で props を監視するように更新します。
- **スライダー**: `input[type="range"]` またはそのコンテナにスタイルを追加し、ヒットエリア（パディング）とサイズを大きくして操作しやすくします。
- **GPSボタン**:
    - 右下（スライダーの上あたり）に新しい「現在地」ボタン（`FaCrosshairs` などを使用）を追加します。
    - `onClick`: `map.flyTo(gpsPosition)` を実行します。
    - GPSデータが利用できない場合は非表示にします。

#### [MODIFY] [PinListDrawer.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/ui/PinListDrawer.tsx)
- `useEffect(() => { if (selectedPin) setSheetMode('pin-detail'); }, [selectedPin]);` というロジックを追加し、ピン選択時に即座に詳細を表示します。
- 「戻る」ナビゲーションが正しく機能することを確認します。

### 3Dビューワー (Scene3D)

#### [MODIFY] [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)
- **初期UI状態**: `isControlsVisible` ステートの初期値を `false` に設定し、スライダー等を最初は隠します。
- **ボタンのラベル**:
    - 「目（表示）」と「コンパス（調整）」ボタンを更新します。
    - テキストを入れるためにボタンの形状/サイズを変更するか、下/内側に小さなラベル `div` を追加します。
    - 提案ラベル: 「表示設定」(View), 「調整」(Adjust)。
    - デザイン: ピル型ボタン、またはアイコン＋下部テキスト。スペースを考慮するとアイコン＋下部テキストの小サイズが良さそうです。

## 検証計画

### 自動テスト
- 新規の自動テストは計画していません。

### 手動検証
1.  **コンパスリロード問題**:
    - **テスト**: アプリをクリーンな状態（キャッシュ/権限クリア推奨）で開く。
    - **観察**: エラーが出ないこと。2Dマップがロードされること。「視界コーン」は表示されない可能性がある（想定通り）。
    - **アクション**: 「3Dモード」をクリック。
    - **観察**: 権限プロンプトが出る（iOSの場合）。許可する。3Dモードが正しい方位でロードされる。
    - **アクション**: 2Dに戻る。
    - **観察**: 現在は「視界コーン」が表示されていること。
2.  **2DピンUI**:
    - ピンをタップ -> 画像と説明を含む詳細画面が直接スライドアップすること。
3.  **2Dスライダー**:
    - 親指で簡単にスライダーをドラッグできること。
4.  **2D GPSボタン**:
    - マップをドラッグして移動。ターゲットボタンをクリック。マップが青いドット（現在地）に戻ること。
5.  **3D UI**:
    - 3Dモードに入る。画面がすっきりしていること（スライダー/リストがない）。
    - ボタンに「表示設定」「調整」というテキストラベルがあること。
    - 「表示設定」をクリック -> スライダーが表示されること。

/**
 * Gemini API を使って okutama-pins.ts の reading フィールドを生成するスクリプト
 *
 * 使い方:
 *   GEMINI_API_KEY=xxx node scripts/generate-readings.mjs
 *
 * 生成結果は scripts/readings.json に保存される。
 * 既に readings.json が存在する場合、未生成のピンのみ追加生成する。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pinsPath = path.resolve(__dirname, '../src/data/okutama-pins.ts');
const outputPath = path.resolve(__dirname, 'readings.json');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY 環境変数を設定してください');
  process.exit(1);
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `あなたは日本語の音声読み上げ(TTS)テキスト生成の専門家です。
与えられたタイトルと説明文を、Web Speech API での読み上げに最適化したテキストに変換してください。

## 最重要ルール
- 文章の構造・語順・表現は原文のまま保持すること。リライトや要約はしない
- 変換するのは「読み」のみ。難読漢字・固有名詞をひらがなに置き換える

## 読み変換ルール
- 難読漢字・固有名詞はひらがなに置き換える
- 一般的な漢字（学校、神社、地区、建設、移転、現在など）はそのまま残してよい
- 奥多摩・小河内村周辺の地名は以下の読みを使うこと:
  留浦=とずら、小留浦=ことずら、峰=みね、川野=かわの、青木=あおき、麦山=むぎやま、
  南=みなみ、河内=こうち、湯場=ゆば、原=はら、熱海=あたみ、日指=ひさし、
  岫沢=くきさわ、出野=いずの、水根=みずね、坂本=さかもと、小河内=おごうち、
  峰谷=みねたに、箭芎=やきゅう、金御岳=かなみたけ

## フォーマットルール
- \\n は削除し、文として自然につなげる
- 〔〕内の人名・年齢・出身情報は保持する。ただし人名はフルネームではなく苗字+「さん」のみにする（例: 〔田中太郎さん（67）峰谷〕→ たなかさん、67歳、みねたに出身）
- 「」内の会話はそのまま残す
- 出力は読み上げテキストのみ（余計な説明やマークダウン不要）
- タイトルの読みから始めること（例: 「やきゅうじんじゃ。」）`;

// okutama-pins.ts からピンデータを抽出
function extractPins() {
  const content = fs.readFileSync(pinsPath, 'utf-8');
  const arrayMatch = content.match(/export const okutamaPins:\s*PinData\[\]\s*=\s*(\[[\s\S]*\]);/);
  if (!arrayMatch) {
    throw new Error('okutama-pins.ts のパースに失敗しました');
  }
  // トレーリングカンマを除去してからパース
  const jsonStr = arrayMatch[1].replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(jsonStr);
}

// Gemini API を呼び出して reading を生成
async function generateReading(title, description) {
  const userPrompt = `タイトル: ${title}\n説明文: ${description}`;

  const body = {
    contents: [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API から空のレスポンス');
  }
  return text.trim();
}

// メイン処理
async function main() {
  const pins = extractPins();

  // description が空でないピンのみ対象
  const targetPins = pins.filter((p) => p.description && p.description.trim() !== '');
  console.log(`対象ピン数: ${targetPins.length} / ${pins.length}`);

  // 既存の readings.json を読み込み
  let existing = {};
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    console.log(`既存の readings: ${Object.keys(existing).length}件`);
  }

  // 未生成のピンのみ処理
  const todo = targetPins.filter((p) => !existing[p.id]);
  console.log(`未生成: ${todo.length}件\n`);

  if (todo.length === 0) {
    console.log('全て生成済みです');
    return;
  }

  for (let i = 0; i < todo.length; i++) {
    const pin = todo[i];
    console.log(`[${i + 1}/${todo.length}] ID: ${pin.id} "${pin.title}"`);

    try {
      const reading = await generateReading(pin.title, pin.description);
      existing[pin.id] = reading;
      console.log(`  → ${reading.slice(0, 60)}...`);

      // 途中経過を保存（中断しても再開可能）
      fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), 'utf-8');

      // レートリミット対策
      if (i < todo.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`  ✗ エラー: ${err.message}`);
      // エラーでも続行
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`${Object.keys(existing).length}件の readings を ${outputPath} に保存しました`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

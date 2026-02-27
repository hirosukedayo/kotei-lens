/**
 * readings.json の内容を okutama-pins.ts に反映するスクリプト
 *
 * 使い方:
 *   node scripts/apply-readings.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pinsPath = path.resolve(__dirname, '../src/data/okutama-pins.ts');
const readingsPath = path.resolve(__dirname, 'readings.json');

if (!fs.existsSync(readingsPath)) {
  console.error('readings.json が見つかりません。先に generate-readings.mjs を実行してください。');
  process.exit(1);
}

const readings = JSON.parse(fs.readFileSync(readingsPath, 'utf-8'));
let content = fs.readFileSync(pinsPath, 'utf-8');

let added = 0;
let updated = 0;
let skipped = 0;

for (const [id, reading] of Object.entries(readings)) {
  const idPattern = `"id": "${id}"`;
  const idx = content.indexOf(idPattern);
  if (idx === -1) {
    console.warn(`ID "${id}" が見つかりません`);
    skipped++;
    continue;
  }

  // このオブジェクトの範囲を特定
  const nextObjStart = content.indexOf('"id":', idx + idPattern.length);
  const searchEnd = nextObjStart === -1 ? content.length : nextObjStart;
  const objSlice = content.slice(idx, searchEnd);

  const escapedReading = JSON.stringify(reading);

  // 既に reading がある場合は更新
  if (objSlice.includes('"reading"')) {
    const readingRegex = /"reading":\s*"(?:[^"\\]|\\.)*"/;
    const absMatch = content.slice(idx, searchEnd).match(readingRegex);
    if (absMatch) {
      const matchStart = idx + content.slice(idx, searchEnd).indexOf(absMatch[0]);
      const matchEnd = matchStart + absMatch[0].length;
      content = content.slice(0, matchStart) + `"reading": ${escapedReading}` + content.slice(matchEnd);
      updated++;
      console.log(`ID "${id}" の reading を更新しました`);
    }
    continue;
  }

  // coordinates の閉じ括弧 ] を見つけて、その後に reading を挿入
  const coordEndRegex = /\n\s+\]/;
  const coordMatch = objSlice.match(coordEndRegex);
  if (!coordMatch) {
    console.warn(`ID "${id}" の coordinates 終端が見つかりません`);
    skipped++;
    continue;
  }

  const coordEndIdx = idx + objSlice.indexOf(coordMatch[0]) + coordMatch[0].length;
  const insertStr = `,\n    "reading": ${escapedReading}`;
  content = content.slice(0, coordEndIdx) + insertStr + content.slice(coordEndIdx);

  added++;
  console.log(`ID "${id}" に reading を追加しました`);
}

fs.writeFileSync(pinsPath, content, 'utf-8');
console.log(`\n=== 完了 ===`);
console.log(`追加: ${added}件, 更新: ${updated}件, スキップ: ${skipped}件`);

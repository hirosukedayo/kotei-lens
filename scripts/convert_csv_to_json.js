import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../resources/spot_20260218.csv');
const outputPath = path.resolve(__dirname, '../src/data/okutama-pins.ts');

// スキップするtype
const SKIP_TYPES = new Set(['photo']);

// 有効なtype一覧
const VALID_TYPES = new Set([
  'interview', 'historical', 'folktale', 'heritage', 'current',
]);

/**
 * RFC 4180準拠のCSVパーサー
 * セル内改行・ダブルクォートのエスケープに対応
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        // "" はエスケープされたダブルクォート
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        // クォート終了
        inQuote = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuote = true;
        i++;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
        i++;
      } else if (ch === '\r') {
        // \r\n or \r
        row.push(cell);
        cell = '';
        rows.push(row);
        row = [];
        i++;
        if (i < text.length && text[i] === '\n') i++;
      } else if (ch === '\n') {
        row.push(cell);
        cell = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // 最後のセル・行
  row.push(cell);
  if (row.some(c => c !== '')) {
    rows.push(row);
  }

  return rows;
}

/**
 * coordinates文字列をパースして [lat, lng][] を返す
 */
function parseCoordinates(coordStr) {
  if (!coordStr || coordStr === 'null' || coordStr.trim() === '') {
    return [];
  }

  const results = [];

  // パターン1: [lat, lng] の繰り返しを抽出
  const bracketMatches = coordStr.match(/\[[^\]]+\]/g);
  if (bracketMatches && bracketMatches.length > 0) {
    for (const m of bracketMatches) {
      try {
        const parsed = JSON.parse(m);
        if (Array.isArray(parsed) && parsed.length === 2 &&
            typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
          results.push(parsed);
        }
      } catch {
        console.warn(`  座標パース失敗: ${m}`);
      }
    }
    if (results.length > 0) return results;
  }

  // パターン2: 括弧なし "lat, lng"
  const parts = coordStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    results.push(parts);
  }

  return results;
}

/**
 * descriptionの前後空白を除去しつつ、改行は保持する
 */
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/^\n+/, '')   // 先頭の空行を除去
    .replace(/\n+$/, '');  // 末尾の空行を除去
}

try {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  if (rows.length === 0) {
    throw new Error('CSVが空です');
  }

  // ヘッダー行
  const header = rows[0].map(h => h.trim());
  console.log('ヘッダー:', header.join(', '));

  const colIndex = {};
  for (let i = 0; i < header.length; i++) {
    colIndex[header[i]] = i;
  }

  const requiredCols = ['id', 'title', 'coordinates', 'type', 'description'];
  for (const col of requiredCols) {
    if (colIndex[col] === undefined) {
      throw new Error(`必須カラム "${col}" が見つかりません`);
    }
  }

  const pins = [];
  let skippedNull = 0;
  let skippedType = 0;
  let skippedDraft = 0;

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const id = (cols[colIndex.id] || '').trim();
    const title = (cols[colIndex.title] || '').trim();
    const coordStr = (cols[colIndex.coordinates] || '').trim();
    const type = (cols[colIndex.type] || '').trim();
    const description = cleanDescription(cols[colIndex.description] || '');
    const mapUrl = colIndex.google_map_url !== undefined ? (cols[colIndex.google_map_url] || '').trim() : '';
    const externalUrl = colIndex.general_url !== undefined ? (cols[colIndex.general_url] || '').trim() : '';
    const externalUrlTitle = colIndex.general_url_title !== undefined ? (cols[colIndex.general_url_title] || '').trim() : '';
    const imageName = colIndex['画像のファイル名'] !== undefined ? (cols[colIndex['画像のファイル名']] || '').trim() : '';
    const reading = colIndex.reading !== undefined ? cleanDescription(cols[colIndex.reading] || '') : '';

    // 空行スキップ
    if (!id && !title) continue;

    // typeがスキップ対象
    if (SKIP_TYPES.has(type)) {
      skippedType++;
      continue;
    }

    // typeが空 or 無効
    if (!VALID_TYPES.has(type)) {
      console.warn(`[SKIP] id=${id} "${title}": 無効なtype "${type}"`);
      skippedType++;
      continue;
    }

    // 原稿未定スキップ
    if (description.startsWith('※原稿が必要') || description === '') {
      skippedDraft++;
      console.warn(`[SKIP] id=${id} "${title}": 原稿未定またはdescription空`);
      continue;
    }

    // 座標パース
    const coordinatesList = parseCoordinates(coordStr);
    if (coordinatesList.length === 0) {
      skippedNull++;
      continue;
    }

    // ピン生成
    const basePinData = { title, type, description };
    if (mapUrl) basePinData.mapUrl = mapUrl;
    if (externalUrl) {
      basePinData.externalUrl = externalUrl;
      if (externalUrlTitle) basePinData.externalUrlTitle = externalUrlTitle;
    }
    if (imageName) basePinData.image = `/images/${imageName}`;
    if (reading) basePinData.reading = reading;

    if (coordinatesList.length === 1) {
      pins.push({
        id,
        ...basePinData,
        coordinates: coordinatesList[0],
      });
    } else {
      console.log(`[EXPAND] id=${id} "${title}": ${coordinatesList.length}地点に展開`);
      coordinatesList.forEach((coord, i) => {
        pins.push({
          id: `${id}-${i + 1}`,
          ...basePinData,
          coordinates: coord,
        });
      });
    }
  }

  // 経度順にソート (coordinates[1] = longitude)
  pins.sort((a, b) => a.coordinates[1] - b.coordinates[1]);

  // TypeScriptファイルの生成
  const tsContent = `import type { PinData } from '../types/pins';

// CSV由来のピンデータ (Generated from spot_20260218.csv)
export const okutamaPins: PinData[] = ${JSON.stringify(pins, null, 2)};
`;

  fs.writeFileSync(outputPath, tsContent, 'utf-8');
  console.log(`\n=== 完了 ===`);
  console.log(`登録: ${pins.length}件`);
  console.log(`スキップ(座標なし): ${skippedNull}件`);
  console.log(`スキップ(type): ${skippedType}件`);
  console.log(`スキップ(原稿未定): ${skippedDraft}件`);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

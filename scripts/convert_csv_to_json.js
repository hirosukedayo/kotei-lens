
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../resources/spot_20260212.csv');
const outputPath = path.resolve(__dirname, '../src/data/okutama-pins.ts');

try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    const pins = [];

    // 簡易CSVパーサー: カンマ区切りだがダブルクォート内のカンマは無視
    const splitCSV = (str) => {
        const result = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(current);
                current = '';
                continue;
            }
            current += char;
        }
        result.push(current);
        // クォートの除去
        return result.map(s => {
            s = s.trim();
            if (s.startsWith('"') && s.endsWith('"')) {
                return s.slice(1, -1).replace(/""/g, '"');
            }
            return s;
        });
    };

    lines.forEach((line, index) => {
        // ヘッダー行っぽいものをスキップ（IDが文字列でない、あるいは特定のキーワード）
        // 今回はデータ開始を確認しているのでそのまま処理するが、空行などはfilter済み
        const cols = splitCSV(line);
        if (cols.length < 5) return;

        const id = cols[0];
        const title = cols[1];
        const coordStr = cols[2];
        const type = cols[3];
        const description = cols[4];

        // 座標のパース
        let coordinatesList = [];
        try {
            // パターン0: Valid JSON ([lat, lng] or [[lat, lng], ...])
            const parsed = JSON.parse(coordStr);
            if (Array.isArray(parsed)) {
                if (parsed.length === 0) {
                    // empty
                } else if (typeof parsed[0] === 'number') {
                    coordinatesList.push(parsed); // [lat, lng]
                } else if (Array.isArray(parsed[0])) {
                    coordinatesList = parsed; // [[lat, lng], ...]
                }
            }
        } catch (e) {
            // JSON parse failed. check other patterns

            // パターンA: [lat, lng],[lat, lng] (カンマ区切りの配列文字列)
            const matches = coordStr.match(/\[[^\]]+\]/g);
            if (matches && matches.length > 0) {
                matches.forEach(m => {
                    try {
                        const c = JSON.parse(m);
                        if (Array.isArray(c) && c.length === 2) {
                            coordinatesList.push(c);
                        }
                    } catch (e2) {
                        console.error(`Failed to parse coordinate part: ${m} for ID ${id}`);
                    }
                });
            }

            // パターンB: lat, lng (括弧なし)
            if (coordinatesList.length === 0 && coordStr.includes(',')) {
                const parts = coordStr.split(',').map(s => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    coordinatesList.push(parts);
                }
            }
        }

        if (coordinatesList.length === 0) {
            console.error(`Failed to parse coordinates for ID ${id}: ${coordStr}`);
            return;
        }

        if (coordinatesList.length === 1) {
            // 単一データ
            pins.push({
                id,
                title,
                coordinates: coordinatesList[0],
                type,
                description
            });
        } else {
            // 複数データ展開
            console.log(`Expanding ${coordinatesList.length} coordinates for ID ${id}`);
            coordinatesList.forEach((coord, i) => {
                pins.push({
                    id: `${id}-${i + 1}`, // IDをユニークにする
                    title, // タイトルは同じ
                    coordinates: coord,
                    type,
                    description // 説明も同じ
                });
            });
        }
    });

    // TypeScriptファイルの生成
    const tsContent = `import type { PinData } from '../types/pins';

// CSV由来のピンデータ (Generated from spot_20260212.csv)
export const okutamaPins: PinData[] = ${JSON.stringify(pins, null, 2)};
`;

    fs.writeFileSync(outputPath, tsContent, 'utf-8');
    console.log(`Successfully converting ${pins.length} pins to ${outputPath}`);
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}

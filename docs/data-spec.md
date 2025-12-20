# データ仕様書

## 概要

湖底レンズプロジェクトで使用するデータの形式、構造、管理方法について定義します。

## データカテゴリ

### 1. 地理空間データ
- 建物・施設の位置情報
- 道路・橋梁データ
- 地形・標高データ

### 2. 3Dモデルデータ
- 建物の3Dモデル
- 環境オブジェクト
- 地形メッシュ

### 3. メタデータ
- 歴史情報
- ストーリー・証言
- 画像・音声アーカイブ

## 座標系

### 測地系
- **採用測地系**: WGS84（世界測地系）
- **EPSG**: 4326
- **精度**: 小数点以下6桁（約11cm精度）

### ローカル座標系
- **原点**: 小河内ダム堤体中心
  - 緯度: 35.789472
  - 経度: 139.048889
- **単位**: メートル
- **方向**: 北がY+、東がX+

## データ形式詳細

### 建物データ (buildings.geojson)

```json
{
  "type": "FeatureCollection",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": [
    {
      "type": "Feature",
      "id": "bldg_001",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[
          [139.048123, 35.789456],
          [139.048234, 35.789456],
          [139.048234, 35.789567],
          [139.048123, 35.789567],
          [139.048123, 35.789456]
        ]]]
      },
      "properties": {
        "name": {
          "ja": "旧小河内小学校",
          "en": "Old Okutama Elementary School"
        },
        "type": "education",
        "subtype": "elementary_school",
        "construction": {
          "year_built": 1895,
          "year_renovated": [1923, 1945],
          "year_demolished": 1957,
          "material": "wood",
          "floors": 2,
          "height": 8.5
        },
        "model": {
          "url": "/models/buildings/bldg_001.glb",
          "lod": {
            "high": "/models/buildings/bldg_001_lod0.glb",
            "medium": "/models/buildings/bldg_001_lod1.glb",
            "low": "/models/buildings/bldg_001_lod2.glb"
          },
          "scale": [1.0, 1.0, 1.0],
          "rotation": [0, 0, 0]
        },
        "metadata": {
          "description": "明治28年創立。村の教育の中心地。",
          "capacity": 200,
          "last_students": 45,
          "notable_features": ["講堂", "二宮金次郎像"]
        },
        "media": {
          "photos": [
            {
              "url": "/assets/photos/bldg_001_1950.jpg",
              "year": 1950,
              "caption": "閉校7年前の校舎"
            }
          ],
          "audio": [
            {
              "url": "/assets/audio/school_bell.mp3",
              "type": "ambient",
              "caption": "授業開始の鐘"
            }
          ]
        },
        "stories": ["story_001", "story_002", "story_015"]
      }
    }
  ]
}
```

### 道路データ (roads.geojson)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "road_001",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.048123, 35.789456],
          [139.048234, 35.789567],
          [139.048345, 35.789678]
        ]
      },
      "properties": {
        "name": "旧甲州街道",
        "type": "main_road",
        "width": 4.5,
        "surface": "dirt",
        "elevation_profile": [342.5, 343.2, 344.1]
      }
    }
  ]
}
```

### ストーリーデータ (stories.json)

```json
{
  "stories": [
    {
      "id": "story_001",
      "title": {
        "ja": "最後の卒業式",
        "en": "The Last Graduation"
      },
      "location": {
        "building_id": "bldg_001",
        "coordinates": [139.048123, 35.789456],
        "radius": 50
      },
      "period": {
        "start": "1957-03-15",
        "end": "1957-03-15"
      },
      "content": {
        "text": {
          "ja": "昭和32年3月15日、小河内小学校で最後の卒業式が行われました...",
          "en": "On March 15, 1957, the final graduation ceremony..."
        },
        "narrator": {
          "name": "山田太郎",
          "role": "卒業生",
          "age_at_event": 12
        }
      },
      "media": {
        "audio": {
          "url": "/assets/audio/story_001_narration.mp3",
          "duration": 180,
          "transcript": "/assets/text/story_001_transcript.txt"
        },
        "images": [
          {
            "url": "/assets/photos/graduation_1957_01.jpg",
            "caption": "卒業生集合写真",
            "persons": ["person_012", "person_013"]
          }
        ]
      },
      "triggers": {
        "proximity": {
          "enabled": true,
          "radius": 30,
          "notification": "ここで最後の卒業式が..."
        },
        "time": {
          "enabled": false
        }
      },
      "tags": ["教育", "卒業式", "1957年", "感動的"]
    }
  ]
}
```

### 3Dモデル仕様

#### ファイル形式
- **形式**: glTF 2.0 / GLB
- **座標系**: Y-up, メートル単位
- **原点**: モデル底面中心

#### LOD (Level of Detail)
| レベル | ポリゴン数 | テクスチャ解像度 | 表示距離 |
|--------|-----------|----------------|----------|
| LOD0   | < 10,000  | 2048x2048      | 0-50m    |
| LOD1   | < 5,000   | 1024x1024      | 50-150m  |
| LOD2   | < 1,000   | 512x512        | 150m+    |

#### マテリアル仕様
```json
{
  "materials": [{
    "name": "wood_wall",
    "pbrMetallicRoughness": {
      "baseColorTexture": {"index": 0},
      "metallicFactor": 0.0,
      "roughnessFactor": 0.8
    },
    "normalTexture": {"index": 1},
    "occlusionTexture": {"index": 2}
  }]
}
```

### タイムラインデータ (timeline.json)

```json
{
  "timeline": [
    {
      "year": 1889,
      "events": [
        {
          "type": "construction",
          "title": "小河内村成立",
          "description": "町村制施行により小河内村が成立"
        }
      ]
    },
    {
      "year": 1957,
      "events": [
        {
          "type": "submersion",
          "title": "ダム湛水開始",
          "description": "小河内ダムの湛水が開始され、村が水没",
          "affected_buildings": ["bldg_*"]
        }
      ]
    }
  ]
}
```

### 環境データ (environment.json)

```json
{
  "environment": {
    "terrain": {
      "heightmap": "/data/terrain/heightmap.png",
      "resolution": 1024,
      "bounds": {
        "north": 35.795,
        "south": 35.785,
        "east": 139.055,
        "west": 139.045
      },
      "elevation": {
        "min": 330,
        "max": 530,
        "water_level": 530
      }
    },
    "vegetation": {
      "trees": "/data/vegetation/trees.geojson",
      "density_map": "/data/vegetation/density.png"
    },
    "water": {
      "pre_dam_rivers": "/data/water/rivers.geojson",
      "post_dam_level": 530
    }
  }
}
```

## データ管理

### ディレクトリ構造

### 実装データ構造

現在は GeoJSON の vision に基づきつつ、高速な読み込みと型安全性のために以下の TypeScript ファイルでデータを定義・管理しています。

- **[okutama-pins.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/data/okutama-pins.ts)**:
  - 2D/3D共通の主要スポットデータ。
  - 座標、アイコンタイプ、名称を含む。
- **[historical-locations.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/data/historical-locations.ts)**:
  - 歴史的な重要地点の GeoJSON データ。

```
src/data/
├── okutama-pins.ts        # 主要ピン情報
├── historical-locations.ts # 地理空間データ
└── models/                # 3Dモデル参照定義
```

### バージョン管理
- Git LFSを使用して大容量ファイルを管理
- セマンティックバージョニング採用
- 変更履歴をCHANGELOG.mdに記録

### データ検証

#### スキーマ検証
- JSON Schema Draft-07準拠
- 自動バリデーションスクリプト

#### 地理データ検証
- 座標範囲チェック
- ジオメトリ妥当性検証
- トポロジーエラー検出

## データ収集源

### 一次資料
- 国土地理院旧版地図
- 東京都公文書館資料
- 奥多摩町郷土資料館

### 二次資料
- 住民からの聞き取り調査
- 古写真のデジタル化
- 文献調査

### 推定・復元
- 航空写真からの建物形状推定
- 類似建築からの外観復元
- 地形データからの道路推定

## ライセンス・権利

### オープンデータ
- 地理データ: CC BY 4.0
- 3Dモデル: CC BY-SA 4.0

### 制限付きデータ
- 個人提供写真: 許諾範囲内での使用
- 証言音声: 本プロジェクト限定使用

## データ更新

### 更新頻度
- 地理データ: 年1回
- ストーリー: 随時追加
- 3Dモデル: 四半期ごと

### 更新手順
1. 新データの検証
2. ステージング環境でテスト
3. 本番環境へデプロイ
4. キャッシュクリア
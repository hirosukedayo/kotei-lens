import type React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  showTerrain?: boolean;
  showWater?: boolean;
  terrainScale?: [number, number, number];
  waterScale?: [number, number, number];
  waterPosition?: [number, number, number];
}

// ベースパスを動的に取得
const getBasePath = () => {
  // Viteの環境変数からベースパスを取得
  return import.meta.env.BASE_URL || '/';
};

// glTFファイルの読み込み結果をキャッシュ（グローバル）
const gltfCache = new Map<string, { gltf: GLTF | null; promise: Promise<GLTF> }>();

export default function LakeModel({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true,
  showTerrain = true,
  showWater = true,
  terrainScale = [1, 1, 1],
  waterScale = [1, 1, 1],
  waterPosition = [0, 0, 0],
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Group>(null);
  const clonedTerrainRef = useRef<THREE.Object3D | null>(null); // クローンした地形オブジェクトを保持（内部参照用）
  const [clonedTerrain, setClonedTerrain] = useState<THREE.Object3D | null>(null); // Reactの状態として管理
  const renderCountRef = useRef(0); // レンダリング回数を追跡
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [waterDrainStartTime, setWaterDrainStartTime] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const basePath = getBasePath();

  // terrainScaleの参照を安定化（配列の参照が変わるのを防ぐ）
  // 配列の各要素を個別に取得して依存配列に含める
  const terrainScaleX = terrainScale[0];
  const terrainScaleY = terrainScale[1];
  const terrainScaleZ = terrainScale[2];
  const stableTerrainScale = useMemo(
    () => [terrainScaleX, terrainScaleY, terrainScaleZ] as [number, number, number],
    [terrainScaleX, terrainScaleY, terrainScaleZ]
  );

  // レンダリング回数を追跡
  renderCountRef.current += 1;
  console.log(`[LakeModel] レンダリング #${renderCountRef.current}`, {
    visible,
    showTerrain,
    isLoaded,
    hasClonedTerrain: !!clonedTerrain,
    terrainRefCurrent: !!terrainRef.current,
    terrainScale,
  });

  // glTFファイルの読み込み（キャッシュを使用）
  useEffect(() => {
    const gltfPath = `${basePath}models/OkutamaLake_realscale.glb`;
    
    console.log('[LakeModel] glTFファイル読み込み開始:', gltfPath);
    
    // キャッシュをチェック
    const cached = gltfCache.get(gltfPath);
    
    if (cached?.gltf) {
      // キャッシュから即座に設定
      console.log('[LakeModel] ✅ キャッシュからglTFを取得');
      setGltf(cached.gltf);
      setIsLoaded(true);
      setWaterDrainStartTime(Date.now());
      return;
    }
    
    // 読み込み中のPromiseがある場合は待機
    if (cached?.promise) {
      console.log('[LakeModel] ⏳ 既存の読み込みPromiseを待機中...');
      cached.promise
        .then((loadedGltf) => {
          setGltf(loadedGltf);
          setIsLoaded(true);
          setWaterDrainStartTime(Date.now());
        })
        .catch((error) => {
          console.error('glTFファイルの読み込みに失敗:', error);
          setError('glTFファイルの読み込みに失敗しました');
        });
      return;
    }
    
    // 新規読み込み
    console.log('[LakeModel] 📥 新規にglTFファイルを読み込み中...');
    const gltfLoader = new GLTFLoader();
    
    // モバイル用の読み込み設定
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    );
    
    const loadPromise = new Promise<GLTF>((resolve, reject) => {
      gltfLoader.load(
        gltfPath,
        (loadedGltf) => {
          console.log('[LakeModel] ✅ glTFファイルが正常に読み込まれました');
          
          if (!isMobile) {
            // PCでのみ詳細ログを出力
            console.log('glTF情報:', {
              scene: loadedGltf.scene,
              animations: loadedGltf.animations,
              cameras: loadedGltf.cameras,
              asset: loadedGltf.asset,
            });
            
            // シーンの詳細情報を出力
            console.log('シーンの子オブジェクト:', loadedGltf.scene.children);
            loadedGltf.scene.traverse((child) => {
              console.log('オブジェクト:', child.name, child.type);
            });
            
            // バウンディングボックスを計算してログ出力
            const box = new THREE.Box3().setFromObject(loadedGltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('=== モデルのバウンディングボックス ===');
            console.log('最小値 (min):', {
              x: box.min.x,
              y: box.min.y,
              z: box.min.z,
            });
            console.log('最大値 (max):', {
              x: box.max.x,
              y: box.max.y,
              z: box.max.z,
            });
            console.log('中心点 (center):', {
              x: center.x,
              y: center.y,
              z: center.z,
            });
            console.log('サイズ (size):', {
              x: size.x,
              y: size.y,
              z: size.z,
            });
            console.log('=====================================');
          }
          
          resolve(loadedGltf);
        },
        (progress) => {
          const percentage = (progress.loaded / progress.total) * 100;
          setLoadingProgress(percentage);
          
          // モバイルでの読み込みが遅い場合の警告
          if (isMobile && percentage < 10 && progress.total > 0) {
            console.warn(
              'モバイルでの読み込みが遅い可能性があります。ファイルサイズ:',
              (progress.total / 1024 / 1024).toFixed(1),
              'MB'
            );
          }
        },
        (error) => {
          console.error('glTFファイルの読み込みに失敗:', error);
          reject(error);
        }
      );
    });
    
    // キャッシュにPromiseを保存
    gltfCache.set(gltfPath, { gltf: null, promise: loadPromise });
    
    // Promiseが解決したらキャッシュを更新
    loadPromise
      .then((loadedGltf) => {
        gltfCache.set(gltfPath, { gltf: loadedGltf, promise: loadPromise });
        setGltf(loadedGltf);
        setIsLoaded(true);
        setWaterDrainStartTime(Date.now());
      })
      .catch((error) => {
        console.error('glTFファイルの読み込みに失敗:', error);
        setError('glTFファイルの読み込みに失敗しました');
        gltfCache.delete(gltfPath); // エラー時はキャッシュを削除
      });
  }, [basePath]);

  // 地形オブジェクトを一度だけクローンして保持（useEffectで実行）
  // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない（無限ループを防ぐ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedTerrainは一度設定されたら変わらないため、依存配列に含めない
  useEffect(() => {
    console.log('[LakeModel] useEffect: 地形クローン処理開始', {
      hasGltf: !!gltf,
      hasClonedTerrain: !!clonedTerrain,
      gltfSceneChildren: gltf?.scene?.children?.length || 0,
      renderCount: renderCountRef.current,
    });

    if (!gltf) {
      console.log('[LakeModel] gltfがnullのためスキップ');
      return;
    }

    if (clonedTerrain) {
      console.log('[LakeModel] 既にクローン済みのためスキップ', {
        existingClone: {
          name: clonedTerrain.name,
          type: clonedTerrain.type,
          uuid: clonedTerrain.uuid,
        },
      });
      return;
    }

    console.log('[LakeModel] 地形オブジェクトを検索中...', {
      sceneChildren: gltf.scene.children.length,
      sceneChildrenNames: gltf.scene.children.map((c) => c.name),
    });
    let terrain = gltf.scene.getObjectByName('Displacement.001');
    
    // それでも見つからない場合は、シーンの最初のオブジェクトを使用
    if (!terrain && gltf.scene.children.length > 0) {
      terrain = gltf.scene.children[0];
      console.log('[LakeModel] 地形オブジェクト（フォールバック）:', {
        terrain,
        name: terrain.name,
        type: terrain.type,
      });
    }

    if (terrain) {
      // 地形オブジェクトをクローンして独立したオブジェクトとして保持
      const cloned = terrain.clone();
      clonedTerrainRef.current = cloned; // refにも保持（後方互換性のため）
      setClonedTerrain(cloned); // Reactの状態として設定
      console.log('[LakeModel] ✅ 地形オブジェクトをクローンしました:', {
        clonedObject: cloned,
        name: cloned.name,
        type: cloned.type,
        uuid: cloned.uuid,
        renderCount: renderCountRef.current,
      });
    } else {
      console.warn('[LakeModel] ❌ 地形オブジェクトが見つかりませんでした', {
        sceneChildren: gltf.scene.children.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]); // gltfが変わったときだけ実行（clonedTerrainは一度設定されたら変わらないため、依存配列に含めない）

  // 地形のバウンディングボックスを出力（デバッグ用、useEffectで実行）
  // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない（無限ループを防ぐ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedTerrainは一度設定されたら変わらないため、依存配列に含めない
  useEffect(() => {
    if (!clonedTerrain) return;

    const terrainBox = new THREE.Box3().setFromObject(clonedTerrain);
      const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
      const terrainSize = terrainBox.getSize(new THREE.Vector3());
      
    console.log('=== 地形のバウンディングボックス（terrainScale適用前） ===');
      console.log('最小値:', { x: terrainBox.min.x, y: terrainBox.min.y, z: terrainBox.min.z });
      console.log('最大値:', { x: terrainBox.max.x, y: terrainBox.max.y, z: terrainBox.max.z });
      console.log('中心点:', { x: terrainCenter.x, y: terrainCenter.y, z: terrainCenter.z });
      console.log('サイズ:', { x: terrainSize.x, y: terrainSize.y, z: terrainSize.z });

    // terrainScale適用後の中心を計算
    // スケールは原点を中心に適用されるため、中心点もスケール倍される
    const scale = terrainScale[0]; // x, y, z は同じ値と仮定
    const terrainCenterScaled = {
      x: terrainCenter.x * scale,
      y: terrainCenter.y * scale,
      z: terrainCenter.z * scale,
    };
    console.log('terrainScale:', terrainScale);
    console.log('terrainScale適用後の中心（推定）:', terrainCenterScaled);
    console.log('=====================================');
  }, [terrainScale]); // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない

  const getWaterObject = () => {
    if (!gltf) return null;
    console.log('水面オブジェクトを検索中...');
    let water = gltf.scene.getObjectByName('Water');
    
    // 名前で見つからない場合は、メッシュを直接検索
    // if (!water) {
    //   console.log('名前で見つからないため、メッシュを直接検索...');
    //   gltf.scene.traverse((child) => {
    //     if (child.name && child.name.includes("Water")) {
    //       water = child;
    //       console.log('水面オブジェクト（代替）:', child);
    //     }
    //   });
    // }
    
    // それでも見つからない場合は、シーンの2番目のオブジェクトを使用
    if (!water && gltf.scene.children.length > 1) {
      water = gltf.scene.children[1];
      console.log('水面オブジェクト（フォールバック）:', water);
    }
    
    console.log('水面オブジェクト:', water);
    
    // 水面のバウンディングボックスを出力
    if (water) {
      const waterBox = new THREE.Box3().setFromObject(water);
      const waterCenter = waterBox.getCenter(new THREE.Vector3());
      const waterSize = waterBox.getSize(new THREE.Vector3());
      
      console.log('=== 水面のバウンディングボックス ===');
      console.log('最小値:', { x: waterBox.min.x, y: waterBox.min.y, z: waterBox.min.z });
      console.log('最大値:', { x: waterBox.max.x, y: waterBox.max.y, z: waterBox.max.z });
      console.log('中心点:', { x: waterCenter.x, y: waterCenter.y, z: waterCenter.z });
      console.log('サイズ:', { x: waterSize.x, y: waterSize.y, z: waterSize.z });
      console.log('=====================================');
    }
    
    return water;
  };

  // アニメーション（水面の干上がり）
  useFrame(() => {
    if (waterRef.current && isLoaded && showWater) {
            // 干上がりアニメーション（50%で停止）
            let waterY = 0;
            if (waterDrainStartTime) {
              const elapsed = (Date.now() - waterDrainStartTime) / 1000; // 経過秒数
              const drainProgress = Math.min(elapsed / 15.0, 0.5); // 15秒で50%まで（30秒の50%）
        
        // イージング関数（easeOutCubic）
        const easedProgress = 1 - (1 - drainProgress) ** 3;
        
        // 水面を下に移動（地形スケールに応じて調整）
        // ベースの降下量は-25（スケール1.0の場合）
        // waterScale[1]（Y成分）を使用してスケールに応じて調整
        const baseDrainHeight = -25;
        const scaledDrainHeight = baseDrainHeight * waterScale[1];
        waterY = scaledDrainHeight * easedProgress;
      }

      // 水面の位置（waterPositionを基準に干上がりを適用）
      waterRef.current.position.set(waterPosition[0], waterPosition[1] + waterY, waterPosition[2]);
      
      // 水面のマテリアル効果を動的に調整
      waterRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshStandardMaterial;
          
                // 干上がりに伴う透明度の変化（50%で停止）
                if (waterDrainStartTime) {
                  const elapsed = (Date.now() - waterDrainStartTime) / 1000;
                  const drainProgress = Math.min(elapsed / 15.0, 0.5);
                  const opacity = Math.max(0.4, 0.8 * (1 - drainProgress)); // 透明度を徐々に下げる（80%→40%）
            material.opacity = opacity;
            material.transparent = true;
          }
          
          // 反射強度を固定値に設定
          if (material.metalness !== undefined) {
            material.metalness = 0.2;
          }
          
          // 粗さを固定値に設定
          if (material.roughness !== undefined) {
            material.roughness = 0.3;
          }
          
          // 色を固定値に設定
          if (material.color) {
            material.color.setHSL(0.5, 0.8, 0.6); // 青系の色
          }
        }
      });
    }
  });

  // 地形モデルと水面の実際の位置を確認するためのデバッグログ
  // 注意: useEffectは早期リターンの前に配置する必要がある（React Hooksのルール）
  useEffect(() => {
    if (terrainRef.current && waterRef.current && isLoaded) {
      // 少し遅延させて、地形と水面が完全に配置されるのを待つ
      const timer = setTimeout(() => {
        if (terrainRef.current && waterRef.current) {
          // 地形モデルの実際の位置を取得
          const terrainWorldPosition = new THREE.Vector3();
          terrainRef.current.getWorldPosition(terrainWorldPosition);

          // 地形のバウンディングボックスを取得（terrainScale適用後）
          const terrainBox = new THREE.Box3().setFromObject(terrainRef.current);
          const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
          const terrainSize = terrainBox.getSize(new THREE.Vector3());

          // 水面の実際の位置を取得
          const waterWorldPosition = new THREE.Vector3();
          waterRef.current.getWorldPosition(waterWorldPosition);

          // 水面のバウンディングボックスを取得（waterScale適用後）
          const waterBox = new THREE.Box3().setFromObject(waterRef.current);
          const waterCenter = waterBox.getCenter(new THREE.Vector3());
          const waterSize = waterBox.getSize(new THREE.Vector3());

          console.log('=== 地形モデルの実際の位置（terrainScale適用後） ===');
          console.log('groupのpositionプロパティ:', position);
          console.log('地形のワールド位置:', {
            x: terrainWorldPosition.x,
            y: terrainWorldPosition.y,
            z: terrainWorldPosition.z,
          });
          console.log('地形のバウンディングボックス中心:', {
            x: terrainCenter.x,
            y: terrainCenter.y,
            z: terrainCenter.z,
          });
          console.log('地形のサイズ:', {
            x: terrainSize.x,
            y: terrainSize.y,
            z: terrainSize.z,
          });
          console.log('=====================================');

          console.log('=== 水面の実際の位置（waterScale適用後） ===');
          console.log('waterPositionプロパティ:', waterPosition);
          console.log('水面のローカル位置:', {
            x: waterRef.current.position.x,
            y: waterRef.current.position.y,
            z: waterRef.current.position.z,
          });
          console.log('水面のワールド位置:', {
            x: waterWorldPosition.x,
            y: waterWorldPosition.y,
            z: waterWorldPosition.z,
          });
          console.log('水面のバウンディングボックス中心:', {
            x: waterCenter.x,
            y: waterCenter.y,
            z: waterCenter.z,
          });
          console.log('水面のサイズ:', {
            x: waterSize.x,
            y: waterSize.y,
            z: waterSize.z,
          });
          console.log('地形と水面の中心の差（X, Z方向）:', {
            x: waterCenter.x - terrainCenter.x,
            y: waterCenter.y - terrainCenter.y,
            z: waterCenter.z - terrainCenter.z,
          });
          console.log('=====================================');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, position, waterPosition]);

  if (error) {
    return (
      <group position={position}>
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    );
  }

  // 地形レンダリング判定（即時実行関数を削除して直接JSXを返す）
  const shouldRenderTerrain = showTerrain && isLoaded && clonedTerrain;
  console.log(`[LakeModel] 地形レンダリング判定 #${renderCountRef.current}`, {
    shouldRenderTerrain,
    showTerrain,
    isLoaded,
    hasClonedTerrain: !!clonedTerrain,
    terrainObject: clonedTerrain
      ? {
          name: clonedTerrain.name,
          type: clonedTerrain.type,
          uuid: clonedTerrain.uuid,
        }
      : null,
    renderCount: renderCountRef.current,
  });

  return (
    <group position={position} scale={scale} rotation={rotation} visible={visible}>
      {/* 地形の表示 */}
      {shouldRenderTerrain && clonedTerrain && (
        <primitive
          ref={(ref: THREE.Group | null) => {
            console.log(`[LakeModel] primitive refコールバック #${renderCountRef.current}`, {
              previousRef: !!terrainRef.current,
              newRef: !!ref,
              timestamp: Date.now(),
            });
            if (ref) {
              (terrainRef as React.MutableRefObject<THREE.Group | null>).current = ref;
              console.log(`[LakeModel] ✅ terrainRefが設定されました #${renderCountRef.current}`);
            } else {
              console.log(`[LakeModel] ⚠️ terrainRefがnullになりました #${renderCountRef.current}`);
            }
          }}
          object={clonedTerrain}
          scale={stableTerrainScale}
        />
      )}
      {!shouldRenderTerrain &&
        (() => {
          console.log(`[LakeModel] ❌ 地形はレンダリングされません #${renderCountRef.current}`, {
            shouldRenderTerrain,
            hasClonedTerrain: !!clonedTerrain,
            showTerrain,
            isLoaded,
            reason: !showTerrain
              ? 'showTerrain=false'
              : !isLoaded
                ? 'isLoaded=false'
                : !clonedTerrain
                  ? 'clonedTerrain=null'
                  : 'unknown',
          });
          return null;
        })()}
      
      {/* 水面の表示 */}
      {showWater &&
        isLoaded &&
        (() => {
          const water = getWaterObject();
          return water ? (
        <primitive
          ref={waterRef}
              object={water}
          position={waterPosition}
          scale={waterScale}
          onUpdate={(self: THREE.Object3D) => {
            // 水面のマテリアルを動的に調整
                if (self?.traverse) {
              self.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.Mesh && child.material) {
                  const material = child.material as THREE.MeshStandardMaterial;
                  
                  // 透明度を設定
                  material.transparent = true;
                  material.opacity = 0.8;
                  
                  // 反射を強化
                  material.metalness = 0.3;
                  material.roughness = 0.2;
                  
                  // 色を青系に設定
                  material.color.setHSL(0.6, 0.8, 0.6);
                  
                  // 両面表示を有効化
                  material.side = THREE.DoubleSide;
                }
              });
            }
          }}
        />
          ) : null;
        })()}
      
            {/* ローディング表示 */}
            {!isLoaded && (
              <mesh>
                <boxGeometry args={[10, 1, 10]} />
                <meshStandardMaterial color="#6AB7FF" transparent opacity={0.5} />
              </mesh>
            )}
            
            {/* ローディング進捗表示（モバイル用） */}
            {!isLoaded && loadingProgress > 0 && (
              <mesh position={[0, 5, 0]}>
                <planeGeometry args={[20, 2]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.7} />
              </mesh>
            )}
    </group>
  );
}

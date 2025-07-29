import { Box, Environment, OrbitControls, Text } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { useRef, useState, useEffect, Suspense } from 'react';
import type { Mesh } from 'three';
import {
  type WebGLSupport,
  detectWebGLSupport,
  getRecommendedRenderer,
  getRendererConfig,
} from '../../utils/webgl-detector';
import { useSensors } from '../../hooks/useSensors';
import LocationBasedObjects from '../ar/LocationBasedObjects';
import OrientationCamera from '../ar/OrientationCamera';

// 基本的な建物コンポーネント
function Building({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null);

  return (
    <Box ref={meshRef} position={position} args={[2, 3, 2]}>
      <meshStandardMaterial color="#8B7355" />
    </Box>
  );
}

// 3Dシーンコンポーネント
export default function Scene3D() {
  const [webglSupport, setWebglSupport] = useState<WebGLSupport | null>(null);
  const [renderer, setRenderer] = useState<string>('webgl2');
  const { sensorData, isActive, startSensors } = useSensors();

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });
  }, []);

  // センサーを開始（許可後に一度だけ実行）
  useEffect(() => {
    // Scene3Dが読み込まれた時点で許可画面は通過済みなので、
    // センサーを開始する
    if (!isActive) {
      startSensors();
    }
  }, []); // 空配列で一度だけ実行

  if (!webglSupport) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#2B6CB0',
          color: 'white',
          fontSize: '18px',
        }}
      >
        3D環境を初期化中...
      </div>
    );
  }

  if (renderer === 'none') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F44336',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2>WebGL未対応</h2>
        <p>お使いのブラウザまたはデバイスは3D表示に対応していません。</p>
        <p>Chrome、Firefox、Safari等の最新ブラウザでお試しください。</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{
          position: [0, 50, 200], // より高く、遠くから全体を見渡す
          fov: 75,
          near: 0.1,
          far: 10000,
        }}
        gl={getRendererConfig(renderer)}
      >
        <Suspense fallback={null}>
          {/* シンプルなスカイボックス（巨大な球で空を表現） */}
          <mesh>
            <sphereGeometry args={[8000, 32, 32]} />
            <meshBasicMaterial 
              color="#87CEEB" 
              side={2} // THREE.BackSide - 内側を表示
            />
          </mesh>

          {/* 強力なライティング */}
          <ambientLight intensity={1.2} color="#ffffff" />
          <directionalLight
            position={[500, 500, 200]}
            intensity={2.0}
            color="#ffffff"
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          {/* 追加の照明 - 複数方向から */}
          <directionalLight
            position={[-500, 300, -200]}
            intensity={1.0}
            color="#ffffff"
          />
          <directionalLight
            position={[0, 800, 0]}
            intensity={1.5}
            color="#f0f8ff"
          />

          {/* 奥多摩湖の湖面（半透明） */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[2000, 2000]} />
            <meshStandardMaterial 
              color="#6AB7FF" 
              transparent 
              opacity={0.7} 
              roughness={0.05}
              metalness={0.2}
              emissive="#1a4a6b"
              emissiveIntensity={0.1}
            />
          </mesh>
          
          {/* 湖底の地面 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -20, 0]} receiveShadow>
            <planeGeometry args={[3000, 3000]} />
            <meshStandardMaterial 
              color="#A0522D" 
              emissive="#2d1810"
              emissiveIntensity={0.05}
            />
          </mesh>

          {/* ダム（参考用） */}
          <Box position={[0, 25, 800]} args={[200, 50, 20]}>
            <meshStandardMaterial color="#666666" />
          </Box>

          {/* GPS位置に基づく歴史的地点オブジェクト */}
          <LocationBasedObjects 
            userPosition={sensorData.gps || {
              latitude: 35.789472, // 奥多摩ダム中心座標（テスト用）
              longitude: 139.048889,
              altitude: 530,
              accuracy: 10,
              timestamp: Date.now()
            }}
            maxDistance={5000}
            maxObjects={15}
          />

          {/* 小河内村の建物群（湖底に配置） */}
          {/* 村の中心部 */}
          <Building position={[0, -15, 0]} />
          <Building position={[20, -15, 10]} />
          <Building position={[-15, -15, -5]} />
          
          {/* 小学校（青い建物） */}
          <Box position={[30, -12, 30]} args={[8, 6, 12]}>
            <meshStandardMaterial color="#3498DB" />
          </Box>
          
          {/* 庚申堂（紫の小さな建物） */}
          <Box position={[-20, -16, 25]} args={[4, 4, 4]}>
            <meshStandardMaterial color="#8E44AD" />
          </Box>
          
          {/* 山田家住宅（大きな茅葺き風） */}
          <Box position={[60, -14, -30]} args={[10, 8, 15]}>
            <meshStandardMaterial color="#D4A574" />
          </Box>
          
          {/* 石橋（低い石造り風） */}
          <Box position={[-50, -18, 40]} args={[15, 2, 4]}>
            <meshStandardMaterial color="#708090" />
          </Box>
          
          {/* 追加の民家 */}
          <Building position={[80, -15, 20]} />
          <Building position={[-40, -15, -20]} />
          <Building position={[40, -15, -60]} />
          <Building position={[-30, -15, 60]} />
          
          {/* 村の案内プレート */}
          <Text
            position={[0, 30, 0]}
            fontSize={8}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.5}
            outlineColor="black"
          >
            小河内村 (1957年 奥多摩ダム建設により水没)
          </Text>
          
          {/* 建物の説明ラベル */}
          <Text
            position={[30, 5, 30]}
            fontSize={4}
            color="white"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 4, 0, 0]}
            outlineWidth={0.2}
            outlineColor="black"
          >
            小河内小学校
          </Text>
          
          <Text
            position={[-20, 5, 25]}
            fontSize={3}
            color="white"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 4, 0, 0]}
            outlineWidth={0.2}
            outlineColor="black"
          >
            庚申堂
          </Text>
          
          <Text
            position={[60, 5, -30]}
            fontSize={4}
            color="white"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 4, 0, 0]}
            outlineWidth={0.2}
            outlineColor="black"
          >
            山田家住宅
          </Text>

          {/* センサー情報表示 */}
          <SensorDebugInfo sensorData={sensorData} />

          {/* デバイス方位によるARライクなカメラ制御 */}
          <OrientationCamera 
            deviceOrientation={sensorData.orientation}
            enableRotation={sensorData.orientation !== null}
            smoothing={0.05}
            arMode={true}
          />

          {/* カメラコントロール（ARモード時は制限、通常時は自由操作） */}
          <OrbitControls
            enablePan={!sensorData.orientation}
            enableZoom={true}
            enableRotate={!sensorData.orientation}
            maxPolarAngle={Math.PI / 2}
            minDistance={5}
            maxDistance={1000}
          />
        </Suspense>
      </Canvas>

      {/* UI オーバーレイ */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(43, 108, 176, 0.9)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          fontFamily: 'Noto Sans JP, sans-serif',
          maxWidth: '300px',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0' }}>湖底レンズ - 3Dビュー</h3>
        {sensorData.orientation ? (
          <p style={{ margin: '5px 0', fontSize: '14px' }}>📱 ARモード: デバイスを動かしてください</p>
        ) : (
          <p style={{ margin: '5px 0', fontSize: '14px' }}>🖱️ マウス: 回転・ズーム・パン</p>
        )}
        <p style={{ margin: '5px 0', fontSize: '14px' }}>📍 仮想的な小河内村の建物配置</p>
        <hr style={{ margin: '10px 0', opacity: 0.5 }} />
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          <p style={{ margin: '3px 0' }}>
            レンダラー: <strong>{renderer.toUpperCase()}</strong>
          </p>
          <p style={{ margin: '3px 0' }}>
            WebGPU: {webglSupport.webgpu ? '✅' : '❌'} | WebGL2:{' '}
            {webglSupport.webgl2 ? '✅' : '❌'} | WebGL: {webglSupport.webgl ? '✅' : '❌'}
          </p>
          <hr style={{ margin: '8px 0', opacity: 0.3 }} />
          <p style={{ margin: '3px 0' }}>
            GPS: {sensorData.gps ? `${sensorData.gps.latitude.toFixed(6)}, ${sensorData.gps.longitude.toFixed(6)}` : '未取得'}
          </p>
          <p style={{ margin: '3px 0' }}>
            方位: {sensorData.orientation && sensorData.compassHeading !== null ? `${sensorData.compassHeading.toFixed(1)}°` : '未取得'}
          </p>
          <p style={{ margin: '3px 0' }}>
            精度: {sensorData.gps ? `${sensorData.gps.accuracy.toFixed(1)}m` : '不明'}
          </p>
          <hr style={{ margin: '8px 0', opacity: 0.3 }} />
          <p style={{ margin: '3px 0', fontSize: '11px' }}>
            センサー状態 (isActive: {isActive ? '✅' : '❌'})
          </p>
          <p style={{ margin: '3px 0', fontSize: '11px' }}>
            方位生データ: {sensorData.orientation ? 
              `α:${sensorData.orientation.alpha?.toFixed(1) || 'null'} β:${sensorData.orientation.beta?.toFixed(1) || 'null'} γ:${sensorData.orientation.gamma?.toFixed(1) || 'null'}` : 
              '未取得'
            }
          </p>
          <p style={{ margin: '3px 0', fontSize: '11px' }}>
            モーション: {sensorData.motion && sensorData.motion.acceleration ? 
              `x:${sensorData.motion.acceleration.x?.toFixed(2) || '0'} y:${sensorData.motion.acceleration.y?.toFixed(2) || '0'} z:${sensorData.motion.acceleration.z?.toFixed(2) || '0'}` : 
              '未取得'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// センサー情報のデバッグ表示（3D空間内）
function SensorDebugInfo({ sensorData }: { sensorData: any }) {
  const { gps, orientation, compassHeading } = sensorData;
  
  return (
    <group position={[-80, 40, 0]}>
      <Text
        position={[0, 10, 0]}
        fontSize={4}
        color="white"
        anchorX="left"
        anchorY="top"
        outlineWidth={0.2}
        outlineColor="black"
      >
        {gps ? 
          `GPS: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` : 
          'GPS: 未取得'
        }
      </Text>
      
      <Text
        position={[0, 5, 0]}
        fontSize={4}
        color="white"
        anchorX="left"
        anchorY="top"
        outlineWidth={0.2}
        outlineColor="black"
      >
        {orientation && compassHeading !== null ? 
          `方位: ${compassHeading.toFixed(1)}°` : 
          '方位: 未取得'
        }
      </Text>
      
      <Text
        position={[0, 0, 0]}
        fontSize={4}
        color="white"
        anchorX="left"
        anchorY="top"
        outlineWidth={0.2}
        outlineColor="black"
      >
        {gps ? `精度: ${gps.accuracy.toFixed(1)}m` : '精度: 不明'}
      </Text>
    </group>
  );
}

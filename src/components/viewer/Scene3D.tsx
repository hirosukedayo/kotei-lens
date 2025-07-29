import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Environment } from '@react-three/drei';
import { Mesh } from 'three';
import { detectWebGLSupport, getRecommendedRenderer, getRendererConfig, type WebGLSupport } from '../../utils/webgl-detector';

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

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });
  }, []);

  if (!webglSupport) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#2B6CB0',
        color: 'white',
        fontSize: '18px'
      }}>
        3D環境を初期化中...
      </div>
    );
  }

  if (renderer === 'none') {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#F44336',
        color: 'white',
        padding: '20px'
      }}>
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
          position: [10, 10, 10],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={getRendererConfig(renderer)}
      >
        {/* 環境設定 */}
        <Environment preset="sunset" />
        
        {/* ライティング */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* 地面 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#2D5016" />
        </mesh>

        {/* サンプル建物 */}
        <Building position={[0, 0.5, 0]} />
        <Building position={[5, 0.5, 0]} />
        <Building position={[-3, 0.5, 2]} />
        <Building position={[2, 0.5, -4]} />

        {/* カメラコントロール */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
        />
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
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          🖱️ マウス: 回転・ズーム・パン
        </p>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          📍 仮想的な小河内村の建物配置
        </p>
        <hr style={{ margin: '10px 0', opacity: 0.5 }} />
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          <p style={{ margin: '3px 0' }}>
            レンダラー: <strong>{renderer.toUpperCase()}</strong>
          </p>
          <p style={{ margin: '3px 0' }}>
            WebGPU: {webglSupport.webgpu ? '✅' : '❌'} |
            WebGL2: {webglSupport.webgl2 ? '✅' : '❌'} |
            WebGL: {webglSupport.webgl ? '✅' : '❌'}
          </p>
        </div>
      </div>
    </div>
  );
}
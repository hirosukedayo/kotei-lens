import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

export default function SkyBox() {
  const { camera, gl } = useThree();
  const skyRef = useRef<THREE.Mesh>(null);

  // 空のグラデーション用シェーダーマテリアル
  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#0077be') },    // 空の上部（濃い青）
        bottomColor: { value: new THREE.Color('#87ceeb') }, // 空の下部（明るい青）
        offset: { value: 33 },      // グラデーションのオフセット
        exponent: { value: 0.6 }    // グラデーションの強さ
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      depthTest: false
    });
  }, []);

  // カメラに追従させる
  useFrame(() => {
    if (skyRef.current && camera) {
      skyRef.current.position.copy(camera.position);
    }
  });

  return (
    <mesh ref={skyRef} renderOrder={-1} material={skyMaterial}>
      {/* 適度なサイズのスカイドーム（半球でも十分） */}
      <sphereGeometry args={[500, 32, 15, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
    </mesh>
  );
}
import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';

export default function DirectionGuide() {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const hudTextRef = useRef<any>(null); // Ref for the text specifically

    useFrame(() => {
        if (groupRef.current) {
            // Follow camera X/Z, but keep Y at a fixed offset relative to camera or terrain
            // For general debugging, just keeping it below the camera is fine
            groupRef.current.position.set(camera.position.x, camera.position.y - 10, camera.position.z);
        }

        if (hudTextRef.current) {
            // Get camera rotation
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            // Convert to degrees
            const degreesY = THREE.MathUtils.radToDeg(euler.y);
            // Normalize to 0-360
            const normDeg = (degreesY >= 0) ? degreesY : (360 + degreesY);

            hudTextRef.current.text = `Y-Rot (Heading): ${normDeg.toFixed(1)}°\nNorth(-Z): 0°/360°\nEast(+X): 90° (-90° in 3JS?)\nSouth(+Z): 180°\nWest(-X): 270°`;
        }
    });

    const axisLength = 20; // Make them visible from high up

    return (
        <>
            <group ref={groupRef}>
                {/* North (-Z) - Blue */}
                <Line points={[[0, 0, 0], [0, 0, -axisLength]]} color="blue" lineWidth={3} />
                <Billboard position={[0, 0, -axisLength - 2]}>
                    <Text fontSize={3} color="blue">
                        North (-Z)
                    </Text>
                </Billboard>

                {/* South (+Z) - Light Blue */}
                <Line points={[[0, 0, 0], [0, 0, axisLength]]} color="#88CCFF" lineWidth={3} />
                <Billboard position={[0, 0, axisLength + 2]}>
                    <Text fontSize={3} color="#88CCFF">
                        South (+Z)
                    </Text>
                </Billboard>

                {/* East (+X) - Red */}
                <Line points={[[0, 0, 0], [axisLength, 0, 0]]} color="red" lineWidth={3} />
                <Billboard position={[axisLength + 2, 0, 0]}>
                    <Text fontSize={3} color="red">
                        East (+X)
                    </Text>
                </Billboard>

                {/* West (-X) - Pink */}
                <Line points={[[0, 0, 0], [-axisLength, 0, 0]]} color="#FF8888" lineWidth={3} />
                <Billboard position={[-axisLength - 2, 0, 0]}>
                    <Text fontSize={3} color="#FF8888">
                        West (-X)
                    </Text>
                </Billboard>

                {/* Center Marker */}
                <mesh>
                    <sphereGeometry args={[0.5, 16, 16]} />
                    <meshBasicMaterial color="yellow" />
                </mesh>
            </group>

            {/* Screen-fixed HUD (using Billboard at a fixed distance in front of camera) */}
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                {/* This moves with camera if we put it in a group that follows camera, or we can manually position it. 
             Actually Billboard just makes it face camera. to make it "HUD" like, better to put it as child of camera?
             No, react-three-fiber objects are in scene. simpler to just position it in useFrame relative to camera.
             Let's try a simple approach: update position in useFrame or just rely on the console/panel for exact numbers if this is too complex. 
             For now, let's put it slightly above the axes center.
         */}
                <Text
                    ref={hudTextRef}
                    position={[camera.position.x, camera.position.y - 5, camera.position.z - 10]} // Initial, will be overriden or ignored if we don't update it
                    fontSize={1}
                    color="white"
                    outlineWidth={0.05}
                    outlineColor="black"
                >
                    Heading: --
                </Text>
            </Billboard>
        </>
    );
}

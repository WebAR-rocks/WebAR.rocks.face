import React from 'react';

export default function DebugCube({
    size = 1
}) {
    return (
        <mesh name="debugCube">
            <boxBufferGeometry args={[size, size, size]} />
            <meshNormalMaterial />
        </mesh>
    )
}
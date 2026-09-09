// Relative Path: ./useNodeDrag.ts
import { useState, useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Drag hook for node editor nodes.
 * Converts pointer screen coords → orthographic world XY,
 * calls `onMove(nodeId, [x,y,z])` during drag and `onEnd()` on release.
 */
export default function useNodeDrag(
    onMove: (nodeId: string, position: [number, number, number]) => void,
    onEnd: () => void,
) {
    const { camera, size, gl } = useThree();
    const dragging = useRef<{ nodeId: string; offset: THREE.Vector3 } | null>(null);

    const screenToWorld = useCallback(
        (clientX: number, clientY: number): THREE.Vector3 => {
            const rect = gl.domElement.getBoundingClientRect();
            const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
            const vec = new THREE.Vector3(ndcX, ndcY, 0);
            vec.unproject(camera);
            return vec;
        },
        [camera, gl, size],
    );

    const handlePointerDown = useCallback(
        (nodeId: string, nodePos: [number, number, number], e: React.PointerEvent) => {
            e.stopPropagation();
            const world = screenToWorld(e.clientX, e.clientY);
            const offset = new THREE.Vector3(
                nodePos[0] - world.x,
                nodePos[1] - world.y,
                0,
            );
            dragging.current = { nodeId, offset };

            const onPointerMove = (ev: PointerEvent) => {
                if (!dragging.current) return;
                const w = screenToWorld(ev.clientX, ev.clientY);
                const { offset, nodeId: id } = dragging.current;
                onMove(id, [w.x + offset.x, w.y + offset.y, 0]);
            };

            const onPointerUp = () => {
                dragging.current = null;
                onEnd();
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        },
        [screenToWorld, onMove, onEnd],
    );

    return { handlePointerDown };
}

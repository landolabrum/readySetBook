// Relative Path: ./UiNodeEditorNodes.tsx
import React from 'react';
import { Html } from '@react-three/drei';
import UiNodeEditorNode from '../views/UiNodeEditorNode/UiNodeEditorNode';
import type { IUiNodeEditorNode, IUiNodeEditorConnection } from '@webstack/components/UiNodeEditor/models/IUiNodeEditor';
import { ModalProvider } from '@webstack/components/Containers/modal/contexts/modalContext';
import * as THREE from 'three';

interface Props {
  nodes: IUiNodeEditorNode[];
  connections: IUiNodeEditorConnection[];
  onFieldChange: (nodeId: string, event: { target: { name: string; value: any } }) => void;
  onRemove: (nodeId: string) => void;
  onDragStart: (nodeId: string, position: [number, number, number], e: React.PointerEvent) => void;
}

/** Renders connection lines between nodes as simple Three.js line segments. */
const ConnectionLines: React.FC<{ nodes: IUiNodeEditorNode[]; connections: IUiNodeEditorConnection[] }> = ({
  nodes,
  connections,
}) => {
  const posMap = new Map(nodes.map((n) => [n.id, n.position]));
  return (
    <>
      {connections.map((conn) => {
        const fromPos = posMap.get(conn.from.nodeId);
        const toPos = posMap.get(conn.to.nodeId);
        if (!fromPos || !toPos) return null;
        const points = [
          new THREE.Vector3(fromPos[0] + 1.4, fromPos[1], fromPos[2]),
          new THREE.Vector3(toPos[0] - 1.4, toPos[1], toPos[2]),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: '#6cf' });
        const lineObj = new THREE.Line(geo, mat);
        return <primitive key={conn.id} object={lineObj} />;
      })}
    </>
  );
};

const UiNodeEditorNodes: React.FC<Props> = ({
  nodes,
  connections,
  onFieldChange,
  onRemove,
  onDragStart,
}) => {
  return (
    <group>
      <ConnectionLines nodes={nodes} connections={connections} />
      {nodes.map((node) => (
        <group key={node.id} position={node.position}>
          <Html center transform={false} style={{ pointerEvents: 'auto' }}>
            <ModalProvider>
              <UiNodeEditorNode
                node={node}
                onFieldChange={onFieldChange}
                onRemove={onRemove}
                onDragStart={onDragStart}
              />
            </ModalProvider>
          </Html>
        </group>
      ))}
    </group>
  );
};

export default UiNodeEditorNodes;

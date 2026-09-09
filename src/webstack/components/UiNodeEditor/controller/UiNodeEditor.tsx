// Relative Path: ./UiNodeEditor.tsx
import React, { useCallback, useMemo } from 'react';
import styles from './UiNodeEditor.scss';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import UiNodeEditorNodes from '../views/UiNodeEditorNodes/controller/UiNodeEditorNodes';
import UiNodeEditorPanel from '../views/UiNodeEditorPanel/UiNodeEditorPanel';
import useNodeEditorState from '../hooks/useNodeEditorState';
import useNodeDrag from '../hooks/useNodeDrag';
import type { IUiNodeEditor } from '../models/IUiNodeEditor';

/** Inner component that lives inside <Canvas> so hooks like useThree() work. */
const SceneContent: React.FC<{
    state: ReturnType<typeof useNodeEditorState>;
}> = ({ state }) => {
    const { handlePointerDown } = useNodeDrag(state.moveNode, state.commitMove);

    return (
        <>
            <OrthographicCamera makeDefault zoom={80} position={[0, 0, 10]} />
            <OrbitControls enableRotate={false} enableDamping={false} mouseButtons={{ LEFT: undefined as any, MIDDLE: 2, RIGHT: 2 }} />
            <ambientLight intensity={0.4} />
            <UiNodeEditorNodes
                nodes={state.nodes}
                connections={state.connections}
                onFieldChange={state.updateNodeFields}
                onRemove={state.removeNode}
                onDragStart={handlePointerDown}
            />
        </>
    );
};

const UiNodeEditor: React.FC<IUiNodeEditor> = ({
    nodes,
    connections,
    onChange,
    fieldFactory,
    canvasSettings,
    addLabel,
}) => {
    const state = useNodeEditorState(nodes, connections, onChange, fieldFactory);

    const containerStyle = useMemo(
        () => ({
            width: canvasSettings?.width ?? '100%',
            height: canvasSettings?.height ?? '500px',
        }),
        [canvasSettings],
    );

    return (
        <div className="ui-node-editor" style={containerStyle}>
            <style jsx>{styles}</style>
            <UiNodeEditorPanel
                nodes={state.nodes}
                onAdd={state.addNode}
                onRemove={state.removeNode}
                addLabel={addLabel}
            />
            <Canvas className="ui-node-editor__canvas" style={{ background: '#1a1a2e' }}>
                <SceneContent state={state} />
            </Canvas>
        </div>
    );
};

export default UiNodeEditor;

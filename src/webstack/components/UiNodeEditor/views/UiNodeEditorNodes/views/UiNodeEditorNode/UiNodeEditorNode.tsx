// Relative Path: ./UiNodeEditorNode.tsx
import React, { useCallback } from 'react';
import styles from './UiNodeEditorNode.scss';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import type { IUiNodeEditorNode } from '@webstack/components/UiNodeEditor/models/IUiNodeEditor';

interface IUiNodeEditorNodeProps {
    node: IUiNodeEditorNode;
    onFieldChange: (nodeId: string, event: { target: { name: string; value: any } }) => void;
    onRemove: (nodeId: string) => void;
    onDragStart: (nodeId: string, position: [number, number, number], e: React.PointerEvent) => void;
}

const UiNodeEditorNode: React.FC<IUiNodeEditorNodeProps> = ({
    node,
    onFieldChange,
    onRemove,
    onDragStart,
}) => {
    const handleChange = useCallback(
        (e: any) => onFieldChange(node.id, e),
        [node.id, onFieldChange],
    );

    const handleDrag = useCallback(
        (e: React.PointerEvent) => onDragStart(node.id, node.position, e),
        [node.id, node.position, onDragStart],
    );

    const label = node.label || node.meta?.value || node.id;
    const truncated = typeof label === 'string' && label.length > 32
        ? `…${label.slice(-30)}`
        : label;

    return (
        <div className="ui-node-editor-node">
            <style jsx>{styles}</style>
            <div className="ui-node-editor-node__header" onPointerDown={handleDrag}>
                <span className="ui-node-editor-node__drag-handle">⠿</span>
                <span className="ui-node-editor-node__title" title={typeof label === 'string' ? label : ''}>
                    {truncated}
                </span>
                <button
                    className="ui-node-editor-node__remove"
                    onClick={() => onRemove(node.id)}
                    title="Remove node"
                >
                    ✕
                </button>
            </div>
            <div className="ui-node-editor-node__port ui-node-editor-node__port--out" title="Output" />
            <div className="ui-node-editor-node__port ui-node-editor-node__port--in" title="Input" />
            <div className="ui-node-editor-node__form">
                <UiForm fields={node.formFields} onChange={handleChange} size="sm" />
            </div>
        </div>
    );
};

export default UiNodeEditorNode;
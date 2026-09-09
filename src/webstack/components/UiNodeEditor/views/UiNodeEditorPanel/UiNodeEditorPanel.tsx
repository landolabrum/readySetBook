// Relative Path: ./UiNodeEditorPanel.tsx
import React, { useState, useCallback } from 'react';
import styles from './UiNodeEditorPanel.scss';
import type { IUiNodeEditorNode } from '@webstack/components/UiNodeEditor/models/IUiNodeEditor';

interface Props {
    nodes: IUiNodeEditorNode[];
    onAdd: (value: string) => void;
    onRemove: (nodeId: string) => void;
    addLabel?: string;
}

const UiNodeEditorPanel: React.FC<Props> = ({ nodes, onAdd, onRemove, addLabel }) => {
    const [inputValue, setInputValue] = useState('');

    const handleAdd = useCallback(() => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setInputValue('');
    }, [inputValue, onAdd]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') handleAdd();
        },
        [handleAdd],
    );

    return (
        <div className="ui-node-editor-panel">
            <style jsx>{styles}</style>
            <div className="ui-node-editor-panel__add">
                <input
                    className="ui-node-editor-panel__input"
                    type="text"
                    placeholder={addLabel || 'Add URL and press enter'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className="ui-node-editor-panel__btn" onClick={handleAdd} title="Add node">
                    +
                </button>
            </div>
            <div className="ui-node-editor-panel__list">
                {nodes.map((n, i) => {
                    const label = n.label || n.meta?.value || n.id;
                    const short = typeof label === 'string' && label.length > 28 ? `…${label.slice(-26)}` : label;
                    return (
                        <div key={n.id} className="ui-node-editor-panel__item">
                            <span className="ui-node-editor-panel__item-label" title={typeof label === 'string' ? label : ''}>
                                {i + 1}. {short}
                            </span>
                            <button
                                className="ui-node-editor-panel__item-remove"
                                onClick={() => onRemove(n.id)}
                                title="Remove"
                            >
                                ✕
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UiNodeEditorPanel;

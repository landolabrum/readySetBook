// Relative Path: ./useNodeEditorState.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
    IUiNodeEditorNode,
    IUiNodeEditorConnection,
    IUiNodeEditorGraph,
} from '../models/IUiNodeEditor';
import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';

type FieldFactory = (value: string, index: number) => IFormField[];

const defaultFieldFactory: FieldFactory = (value, _index) => [
    { name: 'value', label: 'Value', type: 'text', value, readonly: true },
];

const uid = () => `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const NODE_SPACING_X = 3.5;

export default function useNodeEditorState(
    initialNodes: IUiNodeEditorNode[],
    initialConnections: IUiNodeEditorConnection[] | undefined,
    onChange: (graph: IUiNodeEditorGraph) => void,
    fieldFactory: FieldFactory = defaultFieldFactory,
) {
    const [nodes, setNodes] = useState<IUiNodeEditorNode[]>(initialNodes);
    const [connections, setConnections] = useState<IUiNodeEditorConnection[]>(initialConnections ?? []);

    // Keep a ref to avoid stale closures in the debounced emitter
    const graphRef = useRef<IUiNodeEditorGraph>({ nodes, connections });
    useEffect(() => {
        graphRef.current = { nodes, connections };
    }, [nodes, connections]);

    // Debounced onChange emission
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const emit = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onChange(graphRef.current);
        }, 250);
    }, [onChange]);

    // --- Mutations ---

    const addNode = useCallback(
        (value: string) => {
            setNodes((prev) => {
                const index = prev.length;
                const lastX = prev.length > 0 ? prev[prev.length - 1].position[0] : -NODE_SPACING_X;
                const newNode: IUiNodeEditorNode = {
                    id: uid(),
                    label: value,
                    formFields: fieldFactory(value, index),
                    position: [lastX + NODE_SPACING_X, 0, 0],
                    connectedTo: [],
                    meta: { value },
                };
                return [...prev, newNode];
            });
            emit();
        },
        [fieldFactory, emit],
    );

    const removeNode = useCallback(
        (nodeId: string) => {
            setNodes((prev) => prev.filter((n) => n.id !== nodeId));
            setConnections((prev) => prev.filter((c) => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId));
            emit();
        },
        [emit],
    );

    const updateNodeFields = useCallback(
        (nodeId: string, event: { target: { name: string; value: any } }) => {
            const { name, value } = event.target;
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id !== nodeId) return node;
                    const updatedFields = node.formFields.map((f) =>
                        f.name === name ? { ...f, value } : f,
                    );
                    return { ...node, formFields: updatedFields };
                }),
            );
            emit();
        },
        [emit],
    );

    const moveNode = useCallback(
        (nodeId: string, position: [number, number, number]) => {
            setNodes((prev) =>
                prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
            );
            // Don't emit on every drag frame — only on drag end
        },
        [],
    );

    const commitMove = useCallback(() => {
        emit();
    }, [emit]);

    const addConnection = useCallback(
        (from: { nodeId: string; fieldName?: string }, to: { nodeId: string; fieldName?: string }) => {
            const id = `conn-${from.nodeId}-${to.nodeId}-${Date.now()}`;
            setConnections((prev) => [...prev, { id, from, to }]);
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id === from.nodeId && !n.connectedTo?.includes(to.nodeId)) {
                        return { ...n, connectedTo: [...(n.connectedTo ?? []), to.nodeId] };
                    }
                    return n;
                }),
            );
            emit();
        },
        [emit],
    );

    const removeConnection = useCallback(
        (connectionId: string) => {
            setConnections((prev) => prev.filter((c) => c.id !== connectionId));
            emit();
        },
        [emit],
    );

    /** Sync nodes from parent when the prop changes (controlled mode) */
    const syncNodes = useCallback((nextNodes: IUiNodeEditorNode[]) => {
        setNodes(nextNodes);
    }, []);

    return {
        nodes,
        connections,
        addNode,
        removeNode,
        updateNodeFields,
        moveNode,
        commitMove,
        addConnection,
        removeConnection,
        syncNodes,
    };
}

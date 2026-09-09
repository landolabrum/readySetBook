// Relative Path: ./IUiNodeEditor.ts
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';

// ---------- Node ----------
export interface IUiNodeEditorNode {
    id: string;
    label?: string;
    formFields: IFormField[];
    position: [number, number, number];
    connectedTo?: string[];
    meta?: Record<string, any>;
}

// ---------- Connection (field-level edge) ----------
export interface IUiNodeEditorConnection {
    id: string;
    from: { nodeId: string; fieldName?: string };
    to: { nodeId: string; fieldName?: string };
}

// ---------- Graph state emitted by onChange ----------
export interface IUiNodeEditorGraph {
    nodes: IUiNodeEditorNode[];
    connections: IUiNodeEditorConnection[];
}

// ---------- Top-level component props ----------
export interface IUiNodeEditor {
    /** Initial / controlled nodes */
    nodes: IUiNodeEditorNode[];
    /** Initial / controlled connections */
    connections?: IUiNodeEditorConnection[];
    /** Called on every mutation with the full graph state */
    onChange: (graph: IUiNodeEditorGraph) => void;
    /** Optional factory: given a raw value + index, produce IFormField[] for a new node.
     *  Defaults to a single text field showing the value. */
    fieldFactory?: (value: string, index: number) => IFormField[];
    /** Canvas container sizing */
    canvasSettings?: {
        width?: string;
        height?: string;
        cameraZ?: number;
        zoom?: number;
    };
    /** Label for the "add node" input placeholder */
    addLabel?: string;
}

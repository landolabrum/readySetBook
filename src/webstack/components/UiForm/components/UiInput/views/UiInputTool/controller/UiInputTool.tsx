// Relative Path: ./UiInputTool.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './UiInputTool.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiIconPicker from '../views/UiIconPicker/UiIconPicker';
import UiQrPicker from '../views/UiQrPicker/UiQrPicker';

export type ToolMode = 'icon' | 'qr';

export type UiInputToolProps = {
    /** Whether the tool panel is visible */
    open: boolean;
    /** Text filter forwarded to the icon picker (from :: detection) */
    filter?: string;
    /** Ref to the triggering input element (used for positioning) */
    inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    /** Called when the user selects/inserts a token */
    onSelect?: (token: string) => void;
    /** Initial mode */
    defaultMode?: ToolMode;
};

const UiInputTool: React.FC<UiInputToolProps> = ({
    open,
    filter,
    inputRef,
    onSelect,
    defaultMode = 'icon',
}) => {
    const [mode, setMode] = useState<ToolMode>(defaultMode);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Compute viewport-fixed position so the panel won't be clipped
    const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
    useIsoLayoutEffect(() => {
        if (!open) return;
        const el = inputRef?.current as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el) return;

        const width = 500;
        const gap = 8;

        const reposition = () => {
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const estimatedHeight = (width / 5) * 4;
            const placeAbove = rect.top >= estimatedHeight + gap;
            const top = placeAbove
                ? Math.max(gap, rect.top - estimatedHeight - gap)
                : Math.min(vh - estimatedHeight - gap, rect.bottom + gap);
            const left = Math.min(Math.max(gap, rect.left), vw - width - gap);
            setPos({ top, left });
        };

        reposition();

        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, { passive: true });
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition);
        };
    }, [open, inputRef]);

    if (!open) return null;

    return (
        <>
            <style jsx>{styles}</style>
            <div className='ui-input-tool' style={{ top: pos.top, left: pos.left }}>
                {/* Mode toggle tabs */}
                <div className='ui-input-tool__tabs'>
                    <button
                        type='button'
                        className={`ui-input-tool__tab${mode === 'icon' ? ' is-active' : ''}`}
                        onClick={() => setMode('icon')}
                    >
                        <UiIcon icon='fa-icons' size={14} /> Icons
                    </button>
                    <button
                        type='button'
                        className={`ui-input-tool__tab${mode === 'qr' ? ' is-active' : ''}`}
                        onClick={() => setMode('qr')}
                    >
                        <UiIcon icon='fa-qrcode' size={14} /> QR Code
                    </button>
                </div>

                {/* Active picker */}
                <div className='ui-input-tool__body'>
                    {mode === 'icon' && (
                        <UiIconPicker filter={filter} onSelect={onSelect} />
                    )}
                    {mode === 'qr' && (
                        <UiQrPicker onSelect={onSelect} />
                    )}
                </div>
            </div>
        </>
    );
};

export default UiInputTool;
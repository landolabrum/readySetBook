import React from 'react';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

type Props = {
    value: string;
    onChange: (v: string) => void;
    onPull: () => void;
    onStop: () => void;
    busy: boolean;
    pending: boolean;
    isPullActive: boolean;
    isLinkedToActiveSession: boolean;
    isRemoteLive: boolean;
    hasError: boolean;
};

const PullSourceInput: React.FC<Props> = ({
    value, onChange, onPull, onStop,
    busy, pending, isPullActive, isLinkedToActiveSession, isRemoteLive, hasError,
}) => {
    const pullVariant = (isPullActive || isRemoteLive)
        ? 'success'
        : (busy && pending) ? 'spinner'
        : hasError ? 'warning'
        : 'link';

    const stopVariant = (isPullActive || isLinkedToActiveSession) ? 'ghost' : 'disabled';

    return (
        <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 4, padding: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>
                <UiIcon icon="fa-download" /> Pull External Stream
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="rtmp://… or srt://… or https://…/index.m3u8"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onPull(); }}
                    style={{
                        flex: 1, padding: '8px 12px', borderRadius: 4,
                        border: '1px solid #444', background: '#0d0d1a',
                        color: '#fff', fontSize: 13,
                    }}
                />
                <UiButton size="sm" variant={pullVariant} traits={{ afterIcon: 'fa-download' }}
                    disabled={busy || !value.trim()} onClick={onPull}>
                    Pull
                </UiButton>
                <UiButton size="sm" variant={stopVariant} traits={{ afterIcon: 'fa-stop' }}
                    disabled={!isPullActive && !isLinkedToActiveSession} onClick={onStop}>
                    Stop
                </UiButton>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                Supports RTMP, SRT, RTSP, and HLS. Transcoded to HLS for playback.
            </div>
        </div>
    );
};

export default PullSourceInput;

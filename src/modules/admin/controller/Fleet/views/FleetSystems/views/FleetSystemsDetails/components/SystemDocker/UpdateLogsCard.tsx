import React from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type { UpdateLogEntry } from '../../../../controller/hooks/useFleetSystemsNetwork';

type Props = {
    updateLogs: UpdateLogEntry[];
    onClearUpdateLogs?: () => void;
};

/** Per-device result log of the last update-all run. */
const UpdateLogsCard: React.FC<Props> = ({ updateLogs, onClearUpdateLogs }) => {
    const [showAllLogs, setShowAllLogs] = React.useState(false);
    const visibleLogs = showAllLogs ? updateLogs : updateLogs.slice(-5);
    if (!updateLogs.length) return null;

    return (
        <div className="card--content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--gray-50)', fontFamily: 'monospace' }}>
                    <UiIcon icon="fa-cloud-arrow-down" /> update logs ({updateLogs.length} device{updateLogs.length !== 1 ? 's' : ''})
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <UiButton
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowAllLogs(!showAllLogs)}
                        traits={{ beforeIcon: showAllLogs ? 'fa-chevron-up' : 'fa-chevron-down' }}
                    >
                        {showAllLogs ? 'Collapse' : `Show all ${updateLogs.length}`}
                    </UiButton>
                    {onClearUpdateLogs && (
                        <UiButton variant="ghost" size="xs" onClick={onClearUpdateLogs}
                            traits={{ beforeIcon: 'fa-xmark' }}>
                            Clear
                        </UiButton>
                    )}
                </div>
            </div>
            <div style={{
                maxHeight: showAllLogs ? '400px' : '160px',
                overflowY: 'auto',
                fontSize: '10px',
                fontFamily: 'monospace',
                background: 'var(--gray-90)',
                padding: '8px',
                borderRadius: '4px',
            }}>
                {visibleLogs.map((entry, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid var(--gray-80)', paddingBottom: '6px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '2px',
                        }}>
                            <UiIcon
                                icon={entry.ok ? 'fa-circle-check' : 'fa-circle-xmark'}
                                color={entry.ok ? 'var(--green-40)' : 'var(--red-30)'}
                            />
                            <span style={{ color: 'var(--gray-20)', fontWeight: 600 }}>
                                {entry.device_id}
                            </span>
                            {entry.host_key && (
                                <span style={{ color: 'var(--gray-50)' }}>({entry.host_key})</span>
                            )}
                        </div>
                        {entry.error && (
                            <div style={{ color: 'var(--red-30)', wordBreak: 'break-all', marginLeft: '20px' }}>
                                {entry.error}
                            </div>
                        )}
                        {entry.output && (
                            <div style={{ color: 'var(--gray-40)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginLeft: '20px' }}>
                                {entry.output.split('\n').slice(-6).join('\n')}
                            </div>
                        )}
                        {entry.restarted && entry.restarted.length > 0 && (
                            <div style={{ color: 'var(--gray-50)', marginLeft: '20px', marginTop: '2px' }}>
                                restarted: {entry.restarted.join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UpdateLogsCard;

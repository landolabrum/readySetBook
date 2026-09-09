import React from 'react';
import { IUserStream } from '~/src/core/services/MemberService/IMemberService';
import styles from './StreamLog.scss';

const isDbusNoise = (msg: string | undefined): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
        lower.includes('bus.cc(399') ||
        lower.includes('failed to connect to the bus') ||
        lower.includes('failed to connect to system bus') ||
        lower.includes('/run/dbus/system_bus_socket') ||
        lower.includes('unable to contact d-bus') ||
        lower.includes('dbus-launch terminated abnormally') ||
        lower.includes('autolaunch error: x11 initialization failed') ||
        lower.includes('unknown address type (examples of valid types are "tcp"')
    );
};

export const StreamLogs: React.FC<{ stream: IUserStream }> = ({ stream }) => {
    const logs = stream.logTail || [];
    const [showNoise, setShowNoise] = React.useState<boolean>(false);
    const RECENT_WINDOW = 30;
    const MAX_ROWS = 10;

    if (!logs.length) return null;

    const recent = logs.slice(-RECENT_WINDOW);
    const withoutNoise = recent.filter((entry) => !isDbusNoise(entry?.msg as any));
    const displaySource = showNoise ? recent : withoutNoise;
    const filtered = displaySource.slice(-MAX_ROWS).reverse();
    const suppressedCount = recent.length - withoutNoise.length;

    return (
        <>
            <style jsx>{styles}</style>
            <div className="stream-panel__logs">
                {suppressedCount > 0 && (
                    <div className="stream-panel__log-note">
                        {suppressedCount} noisy DBus lines hidden
                        <button
                            type="button"
                            className="stream-panel__log-toggle"
                            onClick={() => setShowNoise((v) => !v)}
                        >
                            {showNoise ? 'Hide noise' : 'Show full logs'}
                        </button>
                    </div>
                )}
                {filtered.map((entry, idx) => (
                    <div key={`${stream.provider}-log-${idx}`} className="stream-panel__log-row">
                        <span className="stream-panel__log-ts">{entry.ts}</span>
                        <span className="stream-panel__log-msg">{entry.msg}</span>
                    </div>
                ))}
                {filtered.length === 0 && suppressedCount > 0 && (
                    <div className="stream-panel__log-row">
                        <span className="stream-panel__log-msg">All recent lines are DBus noise. Use "Show full logs" to view.</span>
                    </div>
                )}
            </div>
        </>
    );
};
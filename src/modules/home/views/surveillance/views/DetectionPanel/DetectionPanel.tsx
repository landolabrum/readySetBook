// DetectionPanel — polls object detection (SurveillanceService) and displays results
import React, { useState, useEffect, useCallback } from 'react';
import styles from './DetectionPanel.scss';
import { getService } from '@webstack/common';
import ISurveillanceService, { IDetectionResult } from '~/src/core/services/SurveillanceService/ISurveillanceService';

interface IDetectionPanel {
    cameraId: string;
}

const POLL_MS = 2000;

const DetectionPanel: React.FC<IDetectionPanel> = ({ cameraId }) => {
    const [data, setData] = useState<IDetectionResult | null>(null);
    const surveillance = getService<ISurveillanceService>('ISurveillanceService');

    const poll = useCallback(async () => {
        try {
            setData(await surveillance.getDetections(cameraId));
        } catch {
            /* silent — next poll will retry */
        }
    }, [cameraId, surveillance]);

    useEffect(() => {
        poll();
        const id = setInterval(poll, POLL_MS);
        return () => clearInterval(id);
    }, [poll]);

    if (!data || data.status === 'warming_up' || data.status === 'loading_model') {
        return (
            <>
                <style jsx>{styles}</style>
                <div className="detection-panel detection-panel--loading">
                    Initializing object detection…
                </div>
            </>
        );
    }

    // Group by label → { count, maxConf }
    const grouped: Record<string, { count: number; maxConf: number }> = {};
    for (const d of data.detections) {
        const g = grouped[d.label] || (grouped[d.label] = { count: 0, maxConf: 0 });
        g.count += 1;
        g.maxConf = Math.max(g.maxConf, d.confidence);
    }
    const sorted = Object.entries(grouped).sort((a, b) => b[1].maxConf - a[1].maxConf);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="detection-panel">
                <div className="detection-panel__header">
                    Detected Objects
                    <span className="detection-panel__count">{data.detections.length}</span>
                </div>
                <div className="detection-panel__list">
                    {sorted.length === 0 && (
                        <div className="detection-panel__empty">No objects detected</div>
                    )}
                    {sorted.map(([label, info]) => {
                        const level =
                            info.maxConf >= 0.7 ? 'high' : info.maxConf >= 0.5 ? 'mid' : 'low';
                        return (
                            <div key={label} className="detection-panel__item">
                                <span className="detection-panel__item--label">{label}</span>
                                {info.count > 1 && (
                                    <span className="detection-panel__item--count">×{info.count}</span>
                                )}
                                <span className={`detection-panel__item--conf detection-panel__item--conf-${level}`}>
                                    {Math.round(info.maxConf * 100)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default DetectionPanel;

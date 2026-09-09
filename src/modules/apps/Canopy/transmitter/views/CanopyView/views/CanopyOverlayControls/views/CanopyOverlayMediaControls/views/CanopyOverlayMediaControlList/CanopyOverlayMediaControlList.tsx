import React, { useCallback, useMemo } from 'react';
import styles from "./CanopyOverlayMediaControlList.scss"
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import SurveillanceController from '~/src/modules/home/views/surveillance/views/SurveillanceController/SurveillanceController';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import {
    overlayFieldsFor,
} from '@Canopy/models/canopyOverlayTypes';
import type { LocalCam, CamUrlKind, CamHealth } from '../../hooks/useLocalCams';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { useMediaSegmentEditor } from '../../functions/useMediaSegmentEditor';
import UiSelect from '@webstack/components/UiForm/components/UiSelect/UiSelect';

interface Props {
    overlay: CanonOverlay;
    showingAdvancedFields?: boolean;
    onChange: (e: any) => void;
    localCams: LocalCam[];
    camsLoading: boolean;
    selectedCam: LocalCam | null;
    onCamPick: (row: any, kind?: CamUrlKind) => void;
    onAddAllCams: (kind?: CamUrlKind) => void;
}

const HEALTH_COLOR: Record<CamHealth, string> = {
    online: '#3ddc84',
    offline: '#ff5252',
    unknown: '#f5c542',
};

const HEALTH_LABEL: Record<CamHealth, string> = {
    online: 'HLS streaming',
    offline: 'HLS not ready',
    unknown: 'Probing…',
};

const CanopyOverlayMediaControlList: React.FC<Props> = ({
    overlay,
    showingAdvancedFields,
    onChange,
    localCams,
    camsLoading,
    selectedCam,
    onCamPick,
    onAddAllCams,
}) => {
    const overlayLevelFields = useMemo(
        () => overlayFieldsFor('media', overlay, { showAdvancedFields: showingAdvancedFields }),
        [overlay, showingAdvancedFields],
    );
    const {
        segments,
        isMultiview,
        mvFields,
        activeSegmentIdx,
        setActiveSegmentIdx,
        addNewSegment,
        removeSegment,
        handleSegmentRowClick,
        handleSegmentDrag,
        handleSegmentChange,
        mediaSegmentFields,
    } = useMediaSegmentEditor(overlay, onChange);

    const segmentTableData = useMemo(
        () =>
            segments.map((seg, idx) => ({
                '#': idx + 1,
                name: seg.title,
                url: seg?.title || String(seg.url?.split('//')[1])?.split("/")[0] || '(empty)',
                kind: (typeof seg.kind === 'object' && seg.kind !== null ? (seg.kind as any).value ?? (seg.kind as any).label : seg.kind) || 'video',
                duration: `${seg.duration ?? 30}s`,
                '': <UiIcon icon="fa-trash-can" onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeSegment(idx); }} />,
                _idx: idx,
            })),
        [segments, removeSegment],
    );

    /** Build the camera dropdown. Each camera is a parent option whose two
     *  children map to the URL kinds the old AdapTables exposed — HLS (with
     *  audio) and RTSP / MJPEG (video only). Selecting a child adds that URL as
     *  a media segment via `onCamPick`. Live health is folded into the icon
     *  color + secondary label (replacing the old inline HealthDot). */
    const camOptions = useMemo(
        () =>
            localCams.map((cam) => ({
                label: cam.name,
                value: cam.id,
                secondary: HEALTH_LABEL[cam.health],
                icon: { icon: 'fa-camera-security', color: HEALTH_COLOR[cam.health] },
                items: [
                    { label: 'HLS (with audio)', value: `${cam.id}:hls`, cam, kind: 'hls' as CamUrlKind },
                    { label: 'RTSP / MJPEG (video only)', value: `${cam.id}:rtsp`, cam, kind: 'rtsp' as CamUrlKind },
                ],
            })),
        [localCams],
    );

    const handleCamSelect = useCallback(
        (selected: any) => {
            if (selected?.cam && selected?.kind) onCamPick(selected.cam, selected.kind);
        },
        [onCamPick],
    );

    return (
        <>
            <style jsx>{styles}</style>
            <div className='media-control-list'>
                {/* Multiview grid settings */}
                {isMultiview && (
                    <div style={{ marginBottom: 8 }}>
                        <div className="form__hint" style={{ margin: '4px 0 6px' }}>Multiview Grid Settings</div>
                        <UiForm fields={mvFields} variant="" onChange={onChange} />
                    </div>
                )}

                {/* Zone A: Source List */}
                <div className="media-control-list__list">
                    <div className="media-control-list__list-actions">
                        <UiButton
                            variant="primary"
                            traits={{ beforeIcon: 'fas-plus' }}
                            onClick={addNewSegment}
                        >
                            New Source
                        </UiButton>
                        <UiSelect
                            label={camsLoading ? 'Loading cameras…' : 'Add camera'}
                            search
                            options={camOptions}
                            onSelect={handleCamSelect}
                            traits={{ beforeIcon: 'fa-camera' }}
                        />
                        <div className="media-control-list__cam-header">
                            <UiButton variant="link" traits={{ beforeIcon: 'fas-plus' }} onClick={() => onAddAllCams('hls')}>
                                All HLS
                            </UiButton>
                            <UiButton variant="link" traits={{ beforeIcon: 'fas-plus' }} onClick={() => onAddAllCams('rtsp')}>
                                All RTSP
                            </UiButton>
                        </div>
                    </div>
                    <AdapTable
                        data={segmentTableData}
                        options={{
                            tableTitle: (
                                <div className="media-control-list__timeline-header">
                                    <span className="form__hint">
                                        {segments.length} source{segments.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            ),
                            hideColumns: ['_idx'],
                        }}
                        onRowClick={handleSegmentRowClick}
                        onDrag={handleSegmentDrag}
                    />
                </div>
                {/* Zone B: Edit Panel */}
                <div className="media-control-list__editor">
                    {activeSegmentIdx !== null && activeSegmentIdx < segments.length ? (
                        <>
                            {selectedCam?.hasPtz && (
                                <div className="media-control-list__ptz-wrapper">
                                    <div className="form__hint media-control-list__ptz-label">PTZ — {selectedCam.name}</div>
                                    <SurveillanceController cameraId={selectedCam.id} />
                                </div>
                            )}
                            <div className="form__hint">Editing Segment #{activeSegmentIdx + 1}</div>
                            <UiForm
                                fields={mediaSegmentFields(segments[activeSegmentIdx], activeSegmentIdx)}
                                onChange={handleSegmentChange}
                            />
                            <div className="media-control-list__segment-actions">
                                <UiButton variant="flat" onClick={() => setActiveSegmentIdx(null)}>
                                    Done
                                </UiButton>
                                <UiButton
                                    variant="danger"
                                    traits={{ beforeIcon: 'fa-trash-can' }}
                                    onClick={() => {
                                        removeSegment(activeSegmentIdx);
                                    }}
                                >
                                    Remove
                                </UiButton>
                            </div>
                        </>
                    ) : (
                        <div className="media-control-list__empty">
                            Select a source from the list to edit
                        </div>
                    )}
                </div>

                {/* Overlay-level settings (advanced) */}
                {showingAdvancedFields && (
                    <div className="media-control-list__advanced">
                        <UiForm variant="flex" fields={overlayLevelFields} onChange={onChange} />
                    </div>
                )}
            </div>
        </>
    );
};

export default CanopyOverlayMediaControlList;

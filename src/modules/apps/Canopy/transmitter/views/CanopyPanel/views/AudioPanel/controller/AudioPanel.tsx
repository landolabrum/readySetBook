import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './AudioPanel.scss';
import UiKnob, { type KnobState } from '@webstack/components/UiForm/components/UiKnob/UiKnob';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import {
  AUDIO_OVERLAY_TYPES,
  type AudioOverlayType,
  type OverlayAudio,
  useAudioPanel,
} from '../hooks/useAudioPanel';
import { buildKnobState } from '@webstack/components/UiForm/components/UiKnob/audioKnobMath';
import type { EventRow } from '@Canopy/hooks/useCanopy';
import UiRadioLayout, {
  type UiRadioLayoutView,
} from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';
import useWindow from '@webstack/hooks/window/useWindow';
import UiLoader from '@webstack/components/UiLoader/view/UiLoader';
import { overlayTypeIcon } from '@Canopy/hooks/useCanopyViewState';
import { OVERLAY_TYPES } from '@Canopy/models/canopyOverlayTypes';
import AdaptTableCell from '@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell';

const AUDIO_OVERLAY_TYPE_SET = new Set<string>(AUDIO_OVERLAY_TYPES);
const isAudioOverlayTypeId = (type: string): type is AudioOverlayType =>
  AUDIO_OVERLAY_TYPE_SET.has(type);

interface IAudioPanel {
  current: EventRow | null;
}

const AudioPanel: React.FC<IAudioPanel> = ({ current }) => {
  const { width } = useWindow();
  const {
    volume, muted, setVolume, setOverlayVolume, toggleMute,
    audioLevel, knobState, overlayAudioList,
  } = useAudioPanel(current);
  const [activeView, setActiveView] = useState<AudioOverlayType | undefined>(undefined);

  const typeLabelMap = useMemo(() => {
    return OVERLAY_TYPES.reduce<Record<AudioOverlayType, string>>((acc, it) => {
      if (!isAudioOverlayTypeId(it.type)) return acc;
      acc[it.type] = it.label;
      return acc;
    }, {} as Record<AudioOverlayType, string>);
  }, []);

  const overlaysByType = useMemo(() => {
    return overlayAudioList.reduce<Partial<Record<AudioOverlayType, OverlayAudio[]>>>((acc, ov) => {
      const bucket = acc[ov.type] ?? [];
      bucket.push(ov);
      acc[ov.type] = bucket;
      return acc;
    }, {});
  }, [overlayAudioList]);

  const availableTypes = useMemo(() => {
    return AUDIO_OVERLAY_TYPES.filter((type) => (overlaysByType[type]?.length ?? 0) > 0);
  }, [overlaysByType]);

  useEffect(() => {
    if (!availableTypes.length) {
      setActiveView(undefined);
      return;
    }
    if (!activeView || !availableTypes.includes(activeView)) {
      setActiveView(availableTypes[0]);
    }
  }, [availableTypes, activeView]);

  const handleViewChange = useCallback((viewId: string) => {
    if (!isAudioOverlayTypeId(viewId)) return;
    if (!availableTypes.includes(viewId)) return;
    setActiveView(viewId);
  }, [availableTypes]);

  const handleMasterChange = useCallback((s: KnobState) => {
    setVolume(s.normalized);
  }, [setVolume]);

  const renderMaster = useCallback(() => (
    <div className="audio-panel__master">
      <span className="audio-panel__section-label">Master</span>
      <UiKnob
        value={volume}
        measureBy="decibel"
        audioLevel={audioLevel}
        onChange={handleMasterChange}
      />
      <UiButton
        variant={muted ? 'ghost' : 'inherit'}
        traits={{ beforeIcon: muted ? 'fa-volume-xmark' : 'fa-volume-high' }}
        onClick={toggleMute}
      >
        {muted ? 'Unmute' : 'Mute'}
      </UiButton>
      <span className="audio-panel__readout">
        {knobState.db > -60 ? `${knobState.db.toFixed(1)} dB` : '-∞ dB'}
      </span>
    </div>
  ), [volume, audioLevel, handleMasterChange, muted, toggleMute, knobState.db]);

  const views: UiRadioLayoutView[] = useMemo(() => {
    return availableTypes.map((type) => {
      const rows = overlaysByType[type] ?? [];
      const typeLabel = typeLabelMap[type] ?? type;
      return {
        id: type,
        navigation: {
          icon: overlayTypeIcon[type] || 'fa-volume-high',
          alt: `${typeLabel} audio`,
          badge: rows.length ? String(rows.length) : undefined,
        },
        header: <small>{rows.length} source{rows.length === 1 ? '' : 's'}</small>,
        content: (<>
        <style jsx>{styles}</style>
          <div className="audio-panel__type-view">
            {renderMaster()}
            <div className="audio-panel__overlays">
              <span className="audio-panel__section-label">{typeLabel}</span>
              <div className="audio-panel__overlay-grid">
                {rows.map((ov) => {
                  const ovKnob = buildKnobState(ov.volume);
                  return (
                    <div key={ov.id} className={`audio-panel__overlay-row${ov.enabled ? '' : ' audio-panel__overlay-row--disabled'}`}>
                      <span className="audio-panel__overlay-label" title={ov.label}>
                        {ov.label}
                      </span>
                      <UiKnob
                        value={ov.volume}
                        variant="vertical"
                        audioLevel={ov.level}
                        measureBy="decibel"
                        onChange={(s: KnobState) => setOverlayVolume(ov.id, s.normalized)}
                        />
                      <span className="audio-panel__overlay-readout">
                        {ovKnob.db > -60 ? `${ovKnob.db.toFixed(1)} dB` : '-∞ dB'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
                </>
        ),
      };
    });
  }, [availableTypes, overlaysByType, typeLabelMap, renderMaster, setOverlayVolume]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="audio-panel">
        {!current ? (
          <UiLoader text="Select an event to manage audio" dots={false} />
        ) : !views.length ? (
          <div className="audio-panel__type-view">
            {renderMaster()}
            <UiLoader text="No audio-enabled overlay types found" dots={false} />
          </div>
        ) : (
          <UiRadioLayout
            title={
                  <AdaptTableCell cell="icon-label" data={
                    {
                      label: `Audio`,
                      icon: "fa-volume-high"
                    }
                  } />
            }
            views={views}
            value={activeView}
            onViewChange={handleViewChange}
            collapsed={width > 1100}
            layout={{ orientation: 'vertical', navigationPosition: 'left' }}
          />
        )}
      </div>
    </>
  );
};

export default AudioPanel;

// Relative Path: ./OverlayPanel.tsx
import React, { useCallback, useMemo } from 'react';
import styles from './OverlayPanel.scss';
import { useCanopyViewState, overlayTypeIcon } from '@Canopy/hooks/useCanopyViewState';
import { OVERLAY_TYPES } from '@Canopy/models/canopyOverlayTypes';
import UiRadioLayout from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import useWindow from '@webstack/hooks/window/useWindow';
// import capitalize from '@webstack/helpers/Capitalize';
import keyStringConverter from '@webstack/helpers/keyStringConverter';
// import { textTransform } from 'html2canvas/dist/types/css/property-descriptors/text-transform';
import AdaptTableCell from '@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell';

interface IOverlayPanel {
    current: any;
}

const OverlayPanel: React.FC<IOverlayPanel> = ({ current }) => {
    const { width } = useWindow();
    const {
        focusOverlay,
        selectedOverlayId,
        removeOverlay,
        reorderOverlays,
        addOverlay,
        updateOverlay,
        overlayTable,
    } = useCanopyViewState(current);

    const handleLabelChange = useCallback(
        (id: string, e: any) => {
            const val = typeof e === 'string' ? e : e?.target?.value ?? '';
            updateOverlay(id, { label: val });
        },
        [updateOverlay],
    );

    const [activeView, setActiveView] = React.useState('overlays');

    const safeOverlayTable = useMemo(
        () => (Array.isArray(overlayTable) ? overlayTable : []),
        [overlayTable],
    );

    const handleAddOverlay = useCallback(
        (type: string) => {
            addOverlay(type);
            setActiveView('overlays');
        },
        [addOverlay],
    );

    const enabledCountByType = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const ov of safeOverlayTable) {
            if (ov.enabled) counts[ov.type] = (counts[ov.type] || 0) + 1;
        }
        return counts;
    }, [safeOverlayTable]);

    const addOverlayData = useMemo(
        () =>
            OVERLAY_TYPES.map((ot) => ({
                type: ot.type,
                _type: (current?.name&&
                    <>
                        <UiIcon
                            icon={overlayTypeIcon[ot.type] || 'fa-picture-in-picture'}
                            size={18}
                            alt={`${enabledCountByType[ot.type]||'0'} ${ot.type}, in  ${current?.name}`}
                            // alt={ot.type}
                            badge={enabledCountByType[ot.type]}
                        />  {keyStringConverter(ot?.type, {textTransform:"capitalize"})}
                 </>||''
                ),
                // active: enabledCountByType[ot.type] || 0,
            })),
        [enabledCountByType],
    );

    const views = useMemo(
        () => [
            {
                id: 'overlays',
                navigation: { icon: 'fa-picture-in-picture', alt: 'Event Overlays', badge: safeOverlayTable.length > 0 ? safeOverlayTable.length : undefined },
                content: (
                    <AdapTable
                        data={safeOverlayTable.map((td) => ({
                            id: td.id,
                            enabled: td.enabled,
                            Type: (
                                <UiIcon
                                    icon={overlayTypeIcon[td.type] || 'fa-exclamation-triangle'}
                                    color={!overlayTypeIcon[td.type]&&"#f90"||undefined}
                                    alt={td.type}
                                />
                            ),
                            label: (
                                <UiInput
                                    name={`label-${td.id}`}
                                    type="markdown"
                                    variant="flat"

                                    value={td.label || ''}
                                    placeholder={td.type}
                                    onChange={(e: any) => td.id && handleLabelChange(td.id, e)}
                                    onClick={(e: any) => e.stopPropagation()}
                                />
                            ),
                            selected: td.id === selectedOverlayId,
                        }))}
                        options={{
                            tableTitle:' ',
                            // hide:['header'],
                            // tableTitle: <small id="overlay-event--title"><span style={{ color: "var(--blue-10)" }}> {` ${current?.name} Overlays` || 'selected event'}</span></small>,
                            hideColumns: ['id','selected'],
                            hoverable: true,
                            renderCell: (key, item) => {
                                if (key === 'enabled') {
                                    return (
                                        <UiIcon
                                            icon={item.enabled ? 'fa-circle-check' : 'fa-xmark'}
                                            color={item.enabled ? 'green' : 'red'}
                                            onClick={(e: any) => {
                                                e.stopPropagation();
                                                if (item.id) updateOverlay(item.id, { enabled: !item.enabled });
                                            }}
                                            alt={item.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                                        />
                                    );
                                }
                                return null;
                            },
                        }}
                        onRowClick={(row) => {
                            if (row?.id) focusOverlay(row.id);
                        }}
                        onSelect={(row) => {
                            if (row?.id) removeOverlay(row.id);
                        }}
                        onDrag={({ from, to, data }) => {
                            const orderedIds = data.map((d: any) => d.id).filter(Boolean) as string[];
                            reorderOverlays(orderedIds);
                        }}
                        variant={width < 1100 &&"compact mini"}
                    />
                ),
            },
            {
                id: 'add',
                navigation: { icon: 'fas-plus', alt: 'Add Overlays' },
                content: (<div className='card'>
                    <AdapTable
                        data={addOverlayData}
                        options={{
                            tableTitle: 'Add Overlay',
                            // hide:['header'],
                            hideColumns: ['type'],
                            hoverable: true,
                        }}
                        onRowClick={(row) => {
                            if (row?.type) handleAddOverlay(row.type);
                        }}
                        />
                        </div>
                ),
            },
        ],
        [
            safeOverlayTable,
            selectedOverlayId,
            current?.name,
            focusOverlay,
            removeOverlay,
            reorderOverlays,
            updateOverlay,
            handleLabelChange,
            addOverlayData,
            handleAddOverlay,
        ],
    );

    return (
        <>
            <style jsx>{styles}</style>
            <div className="overlay-panel">
                <UiRadioLayout
                    title={<AdaptTableCell cell="icon-label" data={{ icon:"fa-picture-in-picture",label:"Overlays"}}/>}
                    views={views}
                    value={activeView}
                    onViewChange={setActiveView}

                    collapsed={width > 1100}
                    layout={{ orientation: 'vertical', navigationPosition: 'left' }}
                />
            </div>
        </>
    );
};

export default OverlayPanel;
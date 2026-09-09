// Relative Path: ./CanopyHeader.tsx
import React, { useCallback, useMemo } from 'react';
import styles from './CanopyHeader.scss';
import EventsPanel, { EventsPanelProps } from '../views/EventsPanel/EventsPanel';
import useWindow from '@webstack/hooks/window/useWindow';
import UiMenuFan from '@webstack/components/UiMenuFan/UiMenuFan';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import StreamPanel from '../../CanopyPanel/views/StreamPanel/controller/StreamPanel';
import { CanopyProvider } from '@Canopy/context/CanopyProvider';
import AudioPanel from '../../CanopyPanel/views/AudioPanel/controller/AudioPanel';
import OverlayPanel from '../../CanopyPanel/views/OverlayPanel/controller/OverlayPanel';
import type { useCanopyViewState } from '@Canopy/hooks/useCanopyViewState';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';

type CanopyViewState = ReturnType<typeof useCanopyViewState>;

interface ICanopyHeader extends Partial<EventsPanelProps> {
    title: string | React.ReactElement;
    current?: any;
    viewState?: CanopyViewState;
}

const CanopyHeader: React.FC<ICanopyHeader> = ({
    title,
    current,
    currentIsLive,
    options,
    onSelect,
    handleToggleLive,
    onCreateEvent,
    onEditEvent,
    onCopyEvent,
    copyingId,
    onRefresh,
    onDelete,
    deletingId,
    eventTableData,
    viewState,
}) => {

    const hasEventsPanelProps = !!(onSelect && options && onDelete);
    const { width } = useWindow();
    const { openModal, replaceModal, isModalOpen } = useModal();

    const showLive = viewState?.showLive;
    const pushing = viewState?.pushing ?? false;
    const canPush = Boolean(viewState?.canPush)?? false;
    const canUndo = viewState?.canUndo ?? false;
    const onGoLive = viewState?.onGoLive;
    const onUndo = viewState?.onUndo;
    const onChangeShowLive = viewState?.onChangeShowLive;

    const toolButtons = useMemo(() => {
        if (!viewState) return [];
        return [
            {
                traits: {
                    afterIcon:
                    {
                        icon: showLive ? 'fa-display' : 'fa-picture-in-picture',
                            badge:"server monitor",
                            onClick: () => handleToolSelect('server-preview'),
                        },
                    },
                    name: 'server-preview',
                    variant:  "flat",
                },
                {
                    name: 'undo',
                    children: pushing ? 'Undo…' : 'Revert',
                    disabled: !canUndo || pushing,
                    variant: canUndo && !pushing ? 'link' : "flat",
                    onClick: () => handleToolSelect('undo'),
                    traits: {
                    afterIcon: pushing ? 'spinner' : canUndo ? 'fa-rotate-left' : 'fas-circle-check',
                }
            },
            {
                name: 'push-live',
                children: pushing ? 'Pushing…' : 'Save',
                disabled: !canPush,
                variant: canPush &&"primary glow"||"disabled",
                onClick: () => handleToolSelect('push-live'),
                traits: {
                    afterIcon:{
                        color: canPush?"var(--blue-30)": "var(--gray-50-o)",
                        icon: pushing ? 'spinner' : 'fa-floppy-disks',
                },
                },
            },
        ];
    }, [viewState, showLive, pushing, canUndo, canPush]);

    const handleToolSelect = useCallback((name: string) => {
        if (name === 'undo' && canUndo && !pushing) {
            onUndo?.();
        } else if (name === 'push-live' && canPush) {
            onGoLive?.();
        } else if (name === 'server-preview') {
            onChangeShowLive?.(!showLive);
        }
    }, [canUndo, canPush, pushing, showLive, onUndo, onGoLive, onChangeShowLive]);

    const mobileMenuItems = [
        { icon: 'fa-calendar', label: 'Events' },
        { icon: 'fa-broadcast-tower', label: 'Streams' },
        { icon: 'fa-picture-in-picture', label: 'Overlays' },
        { icon: 'fa-volume-high', label: 'Audio' },
    ];

    const handleMobileMenuClick = (item: { icon: string; label: string }) => {
        let children: React.ReactNode = null;
        switch (item.label) {
            case 'Events':
                children = hasEventsPanelProps ? (
                    <EventsPanel
                        title={title}
                        current={current ?? null}
                        currentIsLive={!!currentIsLive}
                        options={options!}
                        onSelect={onSelect!}
                        handleToggleLive={handleToggleLive}
                        onCreateEvent={onCreateEvent}
                        onEditEvent={onEditEvent}
                        onCopyEvent={onCopyEvent}
                        copyingId={copyingId}
                        onRefresh={onRefresh}
                        onDelete={onDelete!}
                        deletingId={deletingId}
                        eventTableData={eventTableData ?? []}
                    />
                ) : null;
                break;
            case 'Streams':
                children = (
                    <CanopyProvider eventId={current?.id}>
                        <StreamPanel current={current} />
                    </CanopyProvider>
                );
                break;
            case 'Overlays':
                children = (
                    <CanopyProvider eventId={current?.id}>
                        <OverlayPanel current={current} />
                    </CanopyProvider>
                );
                break;
            case 'Audio':
                children = (
                    <CanopyProvider eventId={current?.id}>
                        <AudioPanel current={current} />
                    </CanopyProvider>
                );
                break;
        }
        if (isModalOpen) replaceModal(
            { title: item.label, children, dismissable: true }
        );
        else {

            openModal({ title: item.label, children, dismissable: true });
        }
    };

    return (
        <>
            <style jsx>{styles}</style>
            <div className="canopy-header" id="canopy-header">

                {width < 1100 ? (
                    <UiMenuFan
                        icon="fa-broadcast-tower"
                        items={mobileMenuItems}
                        onClick={handleMobileMenuClick}
                    />
                ) : (

                    hasEventsPanelProps && (
                        <EventsPanel
                            title={title}
                            current={current ?? null}
                            currentIsLive={!!currentIsLive}
                            options={options!}
                            onSelect={onSelect!}
                            handleToggleLive={handleToggleLive}
                            onCreateEvent={onCreateEvent}
                            onEditEvent={onEditEvent}
                            onCopyEvent={onCopyEvent}
                            copyingId={copyingId}
                            onRefresh={onRefresh}
                            onDelete={onDelete!}
                            deletingId={deletingId}
                            eventTableData={eventTableData ?? []}
                        />
                    ) || "unknown...."

                )}
                {viewState && toolButtons.length > 0 && (
                    <div className="canopy-view__toolbar">
                        {toolButtons.map((btn, i) => (
                            <div key={i} className='canopy-view__toolbar--item'>
                                {/* <label>{btn?.alt}</label> */}
                                {/* <UiIcon */}
                                <UiButton
                                    {...btn}
                                    // onClick={() => handleToolSelect(btn.name)}
                                >
                                    {btn?.children}
                                </UiButton>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default CanopyHeader;
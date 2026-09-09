// Relative Path: ./UiRadioLayout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import styles from './UiRadioLayout.scss';
import { IUicon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';

export type UiRadioLayoutView = {
    /** Stable identifier for the view, e.g. "event" or "add" */
    id: string;
    /** Icon configuration forwarded to UiIcon for navigation. */
    navigation?: IUicon;
    /** Text (or node) rendered in the navigation item; usable alone or alongside an icon. */
    label?: React.ReactNode;
    /** Content to render when this view is active. */
    content: React.ReactNode;
    /** Optional: treat as non-selectable control rendered in the navigation bar. */
    kind?: 'view' | 'control';
    /** Optional custom node for navigation when kind === 'control'. */
    navContent?: React.ReactNode;
    /** Optional header area rendered in the nav extras slot when this view is active. */
    header?: React.ReactNode;
};

type Orientation = 'horizontal' | 'vertical';
type NavPosition = 'top' | 'bottom' | 'left' | 'right';

interface IUiRadioLayoutProps {
    /** All available views to toggle between. */
    views: UiRadioLayoutView[];
    title?: string | React.ReactNode;
    /** Currently selected view id (controlled). */
    value?: string;
    /** Initial view id when used uncontrolled. */
    defaultValue?: string;
    /** Notified when the active view changes. */
    onViewChange?: (viewId: string) => void;
    layout?: {
        orientation?: Orientation;
        navigationPosition?: NavPosition;
    };
    /** Optional content to render beside navigation (e.g., toggles or actions). */
    navExtras?: React.ReactNode;
    /** Optional footer content rendered at the bottom of the layout. */
    footer?: React.ReactNode;
    /** When true, adds a toggle button to hide/show the content area while keeping navigation visible. */
    /** Controlled collapsed state. When undefined, collapse is managed internally. */
    collapsed?: boolean;
    /** Called when collapsed state changes. */
    onCollapsedChange?: (collapsed: boolean) => void;
}

const UiRadioLayout: React.FC<IUiRadioLayoutProps> = ({
    views,
    value,
    title,
    defaultValue,
    onViewChange,
    layout,
    navExtras,
    footer,
    collapsed: controlledCollapsed,
    onCollapsedChange,
}) => {
    const selectableViews = useMemo(() => views.filter((v) => v.kind !== 'control'), [views]);
    const [internalValue, setInternalValue] = useState<string | undefined>(
        value ?? defaultValue ?? selectableViews[0]?.id
    );

    const [internalCollapsed, setInternalCollapsed] = useState(true);
    const isCollapsed = controlledCollapsed ?? internalCollapsed;
    const toggleCollapsed = () => {
        const next = !isCollapsed;
        if (controlledCollapsed === undefined) {
            setInternalCollapsed(next);
        }
        onCollapsedChange?.(next);
    };

    // Keep internal state in sync when used as a controlled component
    useEffect(() => {
        if (value === undefined) return;
        setInternalValue(value);
    }, [value]);

    const activeId = internalValue;

    const handleSelect = (id: string) => {
        if (isCollapsed) {
            if (controlledCollapsed === undefined) {
                setInternalCollapsed(false);
            }
            onCollapsedChange?.(false);
        }
        if (value === undefined) {
            setInternalValue(id);
        }
        onViewChange?.(id);
    };

    const orientationClass = useMemo<Orientation>(() => {
        return layout?.orientation ?? 'horizontal';
    }, [layout?.orientation]);

    const navPositionClass = useMemo<NavPosition>(() => {
        return layout?.navigationPosition ?? 'left';
    }, [layout?.navigationPosition]);

    const activeView = useMemo(() => selectableViews.find((v) => v.id === activeId), [activeId, selectableViews,]);
    const activeContent = activeView?.content;
    const activeHeader = activeView?.header;

    const handleGroupSelect = (e: any) => {
        const id = e?.target?.name ?? e?.detail?.name ?? e?.currentTarget?.name;
        if (id) handleSelect(id);
    };

    const navigationNodes = useMemo(() => {
        const nodes: React.ReactNode[] = [];
        let pendingGroup: UiRadioLayoutView[] = [];

        const flushGroup = () => {
            if (!pendingGroup.length) return;
            nodes.push(
                <UiButtonGroup
                    key={`nav-group-${nodes.length}`}
                    variant="bundle"
                    btnSize='sm'
                    btns={pendingGroup.map((view) => ({
                        name: view.id,
                        label: view.label as any,
                        checked: view.id === activeId,
                        traits: view.navigation ? { beforeIcon: view.navigation } : undefined,
                    }))}
                    onSelect={handleGroupSelect}
                />
            );
            pendingGroup = [];
        };

        views.forEach((view, index) => {
            if (view.kind === 'control') {
                flushGroup();
                nodes.push(
                    <div key={`${view.id}-${index}`} className="ui-radio-layout__navigation-control">
                        {view.navContent ?? view.content}
                    </div>
                );
                return;
            }
            if (!view.navigation && view.label === undefined) {
                return;
            }
            pendingGroup.push(view);
        });
        flushGroup();

        return nodes;
    }, [views, activeId]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className={`ui-radio-layout ui-radio-layout--${orientationClass} ui-radio-layout--nav-${navPositionClass}${isCollapsed ? ' ui-radio-layout--collapsed' : ''}`}>
                <div className="ui-radio-layout__navigation">
                    {title ? (
                        <div
                            onClick={toggleCollapsed}

                        className={`ui-radio-layout__navigation-title ${isCollapsed ? " ui-radio-layout__navigation-title__closed" :" ui-radio-layout__navigation-title__open"}`}>
                            {title}
                        </div>
                    ) : null}
                    <div className="ui-radio-layout__navigation-items">
                        {navigationNodes}
                    </div>

                </div>
                    <div className="ui-radio-layout__navigation-extras">
                        {activeHeader || navExtras ? (
                            <div >
                                {activeHeader}
                                {navExtras}
                            </div>
                        ) : null}
                    </div>
                {!isCollapsed && (
                    <div className="ui-radio-layout__content">
                        <div
                            key={activeId}
                            className={`ui-radio-layout__content-inner ui-radio-layout__content-inner--nav-${navPositionClass}`}
                        >
                            {activeContent}
                        </div>
                    </div>
                )}
                {footer && (
                    <div className="ui-radio-layout__footer">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
};

export default UiRadioLayout;
// src/modules/apps/Canopy/views/CanopyLiveTools/CanopyLiveTools.tsx
import React from "react";
import UiResizerLayout from "@webstack/layouts/UiResizerLayout/controller/UiResizerLayout";
import { PipelineProvider } from "~/src/modules/apps/Pipeline/context/PipelineProvider";
import styles from "./CanopyView.scss";
export interface ICanopyView {
    /** Event ID for storage key generation */
    eventId?: string;
    /** Whether on mobile layout */
    isMobile?: boolean;
    /** Windows configuration for the nested resizer layout */
    windows: Array<{
        id: string;
        defaultSize?: string | number;
        minSize?: number;
        maxSize?: number;
        resizable?: boolean;
        children: React.ReactNode;
    }>;
}

/**
 * CanopyLiveTools - PipelineProvider wrapper around the right-side vertical resizer.
 */
const CanopyView: React.FC<ICanopyView> = ({
    eventId,
    isMobile = false,
    windows,
}) => {
    return (<>
        <style jsx>{styles}</style>
        <div className="canopy__view">
            <PipelineProvider>
                <UiResizerLayout
                    storageKey={eventId ? `canopy-right-side-${eventId}` : 'canopy-right-side-root'}
                    layout="vertical"
                    minWindowSize={isMobile ? 0 : 200}
                    gutterSize={6}
                    windows={windows}
                    className="canopy-right-side-resizer"
                />
            </PipelineProvider>
        </div>
    </>
    );
};

export default CanopyView;

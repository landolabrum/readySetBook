import React, { useMemo } from 'react';
import styles from './OverlayMediaLabel.scss';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';
import UiDev from '@webstack/components/UiDev/UiDev';

export type OverlayMediaLabelProps = {
    title?: string | null;
    description?: string | null;
    srcUrl?: string | null;
    urls?: string[] | null;
    currentIndex: number;
    secondsToNext: number;
    hasPlaylist: boolean;
    isStream?: boolean;
};

const OverlayMediaLabel: React.FC<OverlayMediaLabelProps> = ({
    title,
    description,
    srcUrl,
    urls,
    currentIndex,
    secondsToNext,
    hasPlaylist,
    isStream = false,

}) => {
    const labelStyle = useMemo(() => {
        if (!hasPlaylist || !urls || urls.length <= 1 || secondsToNext == null) {
            return undefined;
        }
        if (secondsToNext <= 3) {
            return {
                opacity: 1,
                filter: 'blur(0px)',
                transition: 'opacity 0.5s, filter 0.5s',
            };
        }
        return {
            opacity: 0.5,
            filter: 'blur(1px)',
            transition: 'opacity 0.5s, filter 0.5s',
        };
    }, [hasPlaylist, urls, urls?.length, secondsToNext]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="overlay-media-label" aria-live="polite" style={hasPlaylist ? labelStyle : undefined}>
                {/* <UiDev data={{ description , title}}/> */}
                <strong>
                    {title || description? (<strong>
                        <UiMarkdown text={`${title?.length && `${title}  <br/>`}${description?.length && description || ''}` } />
                    </strong>) :
                        (
                            !isStream && srcUrl?.split('/')?.[3] && `${srcUrl.split('/')[3]}`
                        ) || undefined
                    }
                </strong>
                <br />
                {Boolean(!isStream && urls && urls.length > 1) ?? (
                    <>{currentIndex + 1} of {urls?.length} next, {urls?.[currentIndex + 1]?.split('/')?.[3] || ''} in {secondsToNext}s</>
                )}
            </div>
        </>
    );
};

export default OverlayMediaLabel;
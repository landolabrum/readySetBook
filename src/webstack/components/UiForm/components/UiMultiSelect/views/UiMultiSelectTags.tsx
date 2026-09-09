// Relative Path: ./UiMultiSelectTags.tsx
import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import styles from './UiMultiSelectTags.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { IFormControlVariant } from '@webstack/components/AdapTable/models/IVariant';
import { IFormControlIcon } from '../../FormControl/FormControl';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';

interface IUiMultiSelectTag {
    tag: string | React.ReactElement;
    isActive: boolean;
    onEdit?: () => void;
    onRemove?: () => void;
    icon?: IFormControlIcon;
}

interface IUiMultiSelectTags {
    tags: string[] | React.ReactElement[] | IUiMultiSelectTag[];
    onEdit: (idx: number) => void;
    onRemove?: (idxOrItem: number | string) => void;
    editingIdx?: number | null;
    variant?: IFormControlVariant;
    action?: {
        icon: string;
        onClick: (e?: any) => void;
    },
    onDrag?: (fromIdx: number, toIdx: number) => void;
    /** Which side touches the nav; used for asymmetric rounding */
    direction?: "left" | "right" | "top" | "bottom";
}

const UiMultiSelectTags: React.FC<IUiMultiSelectTags> = ({ tags, onEdit, onRemove, editingIdx, action, onDrag, direction ,variant}) => {
    const isDragging = Boolean(onDrag);
    const labelRefs = useRef<Record<number, HTMLDivElement | null>>({});

    useLayoutEffect(() => {
        const SPEED_PX_PER_SEC = 60; // constant scrolling speed in px/s

        const update = () => {
            Object.keys(labelRefs.current).forEach((k) => {
                const idx = Number(k);
                const el = labelRefs.current[idx];
                if (!el) return;
                const scrollWidth = el.scrollWidth;
                const clientWidth = el.clientWidth;
                const distance = Math.max(0, scrollWidth - clientWidth);
                if (distance > 5) {
                    const duration = Math.max(2, distance / SPEED_PX_PER_SEC);
                    el.style.setProperty('--scroll-duration', `${duration}s`);
                    el.style.setProperty('--scroll-translate', `-${distance}px`);
                } else {
                    el.style.setProperty('--scroll-duration', '0s');
                    el.style.removeProperty('--scroll-translate');
                }
            });
        };

        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [tags, editingIdx]);
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
        e.dataTransfer.setData('text/plain', idx.toString());
        e.dataTransfer.effectAllowed = 'move';
    }
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, toIdx: number) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (onDrag && !isNaN(fromIdx)) {
            onDrag(fromIdx, toIdx);
        }
    }

    return (
        <>
            <style jsx>{styles}</style>
            <div
                className={`ui-multi-select-tags ${direction?`dir-${direction}`:""} ${variant ? ` ui-multi-select-tags--${variant}` : ''} ${isDragging ? '  is-dragging' : ''}`}>
                <div
                    className="ui-multi-select-tags--inner">

                    {tags.map((tag, idx) => {
                        const isReactElement = React.isValidElement(tag);
                        const isCustomTag = !isReactElement && typeof tag === 'object';
                        const customTag = isCustomTag ? tag as IUiMultiSelectTag : null;
                        const tagString = (() => {
                            if (isCustomTag) {
                                const customTagValue = customTag?.tag;
                                if (typeof customTagValue === 'string') {
                                    return customTagValue;
                                }
                                if (React.isValidElement(customTagValue)) {
                                    const customType = customTagValue.type as unknown as {
                                        displayName?: string;
                                        name?: string;
                                    };
                                    const elementType =
                                        typeof customTagValue.type === 'string'
                                            ? customTagValue.type
                                            : customType.displayName ||
                                              customType.name ||
                                              'component';
                                    return `custom-${elementType}-${idx}`;
                                }
                                return `custom-tag-${idx}`;
                            }

                            if (isReactElement) {
                                const elementTagType = tag.type as unknown as {
                                    displayName?: string;
                                    name?: string;
                                };
                                const elementType =
                                    typeof tag.type === 'string'
                                        ? tag.type
                                        : elementTagType.displayName ||
                                          elementTagType.name ||
                                          'component';
                                return `element-${elementType}-${idx}`;
                            }

                            if (typeof tag === 'string') {
                                return tag;
                            }

                            return `tag-${idx}`;
                        })();
                        const displayNode: ReactNode = isCustomTag ? (customTag?.tag as ReactNode) : (tag as ReactNode);
                        const isActive = isCustomTag ? customTag?.isActive : editingIdx === idx;
                        const handleEditClick = (e?: React.MouseEvent) => {
                            e?.stopPropagation?.();
                            // ensure clicking a tag loads it into the input via onEdit
                            if (isCustomTag && customTag?.onEdit) {
                                customTag.onEdit();
                                return;
                            }
                            onEdit(idx);
                        };

                        const handleRemoveClick = (e?: React.MouseEvent) => {
                            // console.log('[UiMultiSelectTags] handleRemoveClick triggered', { idx, e });
                            e?.stopPropagation?.();
                            if (isCustomTag && customTag?.onRemove) {
                                // console.log('[UiMultiSelectTags] using customTag.onRemove');
                                return customTag.onRemove();
                            }
                            if (action?.onClick) {
                                // console.log('[UiMultiSelectTags] using action.onClick');
                                return action.onClick(e);
                            }
                            // Always pass index for reliable removal
                            // console.log('[UiMultiSelectTags] calling onRemove with idx:', idx, 'onRemove exists:', !!onRemove);
                            return onRemove?.(idx);
                        };


                        return (
                            <div
                                key={`tag-${idx}`}
                                data-tag={tagString}
                                className={`ui-multi-select__tag${isActive ? ' is-active' : ''} ${isDragging ? ' is-draggable' : ''}`}
                                draggable={!!onDrag}
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx)}
                                onClick={handleEditClick}
                            >
                                <div
                                    ref={el => { labelRefs.current[idx] = el; }}
                                    className={`ui-multi-select__tag-label${isActive ? ' is-active' : ''}`}
                                    title={(typeof displayNode === 'string' ? displayNode : undefined)}
                                >
                                    {typeof (displayNode) == 'string' ? <UiMarkdown text={displayNode} /> : displayNode}
                                </div>
                                <div
                                    className='ui-multi-select__tag__actions'

                                >{action?.icon ? <UiIcon icon={action.icon} onClick={action?.onClick} alt="Action" />:
                                   (onRemove &&     <div onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleRemoveClick(e);
                                        }}>
                                            <UiIcon icon={"fa-xmark"} alt="Remove" />
                                        </div>
                                    )}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default UiMultiSelectTags;
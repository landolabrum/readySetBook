// Relative Path: ./UiFilter.tsx
import React from 'react';
import styles from './UiFilter.scss';
import UiMarkdown from '../UiMarkDown/controller/UiMarkDown';

interface UiFilterProps {
    element?: React.ReactNode;
    text?: string;
    label?: string;
    variant?: 'crt' | 'lcd' | 'none';
    children?:any;
}

const UiFilter: React.FC<UiFilterProps> = ({
    element,
    text,
    label,
    variant = 'lcd',
    children
}) => {
    return (
        <>
            <style jsx>{styles}</style>
            <div
                className={`ui-filter ui-filter--${variant}`}
                data-variant={variant}
                aria-label={label}
            >
                <div className="ui-filter__canvas">
                    {element && <div className="ui-filter__element">{element}</div>}
                    {text && (
                        <div
                            className={`ui-filter__text ${variant === 'crt' ? 'ui-filter__text--crt' : 'ui-filter__text--lcd'}`}
                        >
                            <UiMarkdown text={text} />
                        </div>
                    )}
                </div>
                <div className="ui-filter__overlay" aria-hidden />
                <div className="ui-filter__noise" aria-hidden />
                {children}
            </div>
        </>
    );
};

export default UiFilter;
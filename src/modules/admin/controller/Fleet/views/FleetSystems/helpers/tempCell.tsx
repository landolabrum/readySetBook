import React from 'react';
import { colorPercentage } from '@webstack/helpers/userExperienceFormats';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { clampPct } from './systemUtils';

// Renders a temperature value with a heat-graded icon + color. Shared by the
// Graphics and Processor cards.
export const tempCell = (temp?: number, colorPct?: number): React.ReactNode => {
    if (typeof temp !== 'number') return 'n/a';
    const p = colorPct ?? clampPct(temp);
    const color = colorPercentage(p, true);
    const icon = p < 40 ? 'fa-temperature-quarter' : p < 70 ? 'fa-temperature-half' : p < 85 ? 'fa-temperature-three-quarters' : 'fa-temperature-full';
    return <span style={{ color }}><UiIcon icon={icon} color={color} /> {temp}°C</span>;
};

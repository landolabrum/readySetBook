import React from 'react';
import keyStringConverter from '@webstack/helpers/keyStringConverter';
import { colorPercentage } from '@webstack/helpers/userExperienceFormats';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

const RenderTemp = ({ name, value, percent }: any) => {
    const color = colorPercentage(percent, true);
    const genIcon = () => {
        if (percent < 25) return 'fa-temperature-empty';
        if (percent < 50) return 'fa-temperature-quarter';
        if (percent < 75) return 'fa-temperature-half';
        if (percent < 100) return 'fa-temperature-three-quarters';
        return 'fa-temperature-full';
    };
    return (
        <div className='fleet-systems-details__temp'>
            <div className='fleet-systems-details__temp--name'>
                {(name && keyStringConverter(name)) || 'Temp'}
            </div>
            <div className='fleet-systems-details__temp--percent' style={{ color }}>
                <UiIcon icon={genIcon()} color={color} /> {typeof value === 'number' ? `${value}°C / ${percent}%` : 'n/a'}
            </div>
        </div>
    );
};

export default RenderTemp;

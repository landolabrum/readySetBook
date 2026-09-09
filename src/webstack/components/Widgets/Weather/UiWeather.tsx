// Relative Path: ./UiWeather.tsx
import React from 'react';
import styles from './UiWeather.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { dateFormat } from '@webstack/helpers/userExperienceFormats';
import UiCollapse from '@webstack/components/UiCollapse/UiCollapse';

interface IUiWeather {
    lngLat?: [number, number];
    summary?: boolean;
}

const UiWeather: React.FC<IUiWeather> = ({ lngLat, summary = false }) => {
    const [weatherData, setWeatherData] = React.useState<any>(null);
    const [locationName, setLocationName] = React.useState<string>('');
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!lngLat) return;

        const [lng, lat] = lngLat;
        const apiKey = process.env.NEXT_PUBLIC_WEATHER_URL;
        if (!apiKey) {
            setError('Weather API key is missing');
            return;
        }

        const url = `${apiKey}/${lat},${lng}?units=us`;

        // Fetch weather data
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setWeatherData(data);
            })
            .catch((err) => {
                console.error('[Weather Fetch Error]', err);
                setError('Failed to fetch weather');
            });

        // Fetch location name using reverse geocoding
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                const address = data.address || {};
                const name =
                    address.city ||
                    address.town ||
                    address.village ||
                    address.county ||
                    address.state ||
                    'Unknown Location';
                const state = address.state ? `, ${address.state}` : '';
                setLocationName(`${name}${state}`);
            })
            .catch((err) => {
                console.error('[Geocoding Error]', err);
                setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            });
    }, [lngLat]);

    const getWeatherIcon = (icon?: string) => {
        switch (icon) {
            case 'clear-day': return 'fa-sun';
            case 'clear-night': return 'fa-moon';
            case 'rain': return 'fa-cloud-showers-heavy';
            case 'snow': return 'fa-snowflake';
            case 'sleet': return 'fa-cloud-meatball';
            case 'wind': return 'fa-wind';
            case 'fog': return 'fa-smog';
            case 'cloudy': return 'fa-cloud';
            case 'partly-cloudy-day': return 'fa-cloud-sun';
            case 'partly-cloudy-night': return 'fa-cloud-moon';
            case 'hail': return 'fa-cloud-meatball';
            case 'thunderstorm': return 'fa-bolt';
            case 'tornado': return 'fa-tornado';
            default: return 'fa-question';
        }
    };

    const formatLabel = (key: string): string => {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
    };

    const formatValue = (key: string, value: any): string => {
        if (value === null || value === undefined) return 'NA';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (key.toLowerCase().includes('time')) {
            return dateFormat(value, { isTimestamp: true });
        }
        if (key.toLowerCase().includes('temperature')) {
            return `${Math.round(value)}°F (${Math.round(((value - 32) * 5) / 9)}°C)`;
        }
        if (key.toLowerCase().includes('humidity') || key.toLowerCase().includes('probability')) {
            return `${Math.round(value * 100)}%`;
        }
        if (typeof value === 'number') {
            return value.toFixed(2);
        }
        return String(value);
    };

    const renderDataItem = (key: string, value: any) => {
        if (['icon', 'summary', 'data'].includes(key)) return null;

        return (
            <div className="ui-weather__data-item" key={key}>
                <span className="ui-weather__data-label">{formatLabel(key)}:</span>
                <span className="ui-weather__data-value">{formatValue(key, value)}</span>
            </div>
        );
    };

    const renderMinutelyData = (minutely: any) => {
        if (!minutely?.data?.length) return null;

        return (
            <UiCollapse label={`Minutely Forecast (${minutely.data.length} points)`}>
                <div className="ui-weather__minutely">
                    <div className="ui-weather__summary">{minutely.summary}</div>
                    <div className="ui-weather__data-grid">
                        {minutely.data.slice(0, 10).map((dataPoint: any, idx: number) => (
                            <UiCollapse key={idx} label={`${dateFormat(dataPoint.time, { isTimestamp: true })}`}>
                                <div className="ui-weather__section">
                                    {Object.entries(dataPoint).map(([key, value]) =>
                                        renderDataItem(key, value)
                                    )}
                                </div>
                            </UiCollapse>
                        ))}
                    </div>
                </div>
            </UiCollapse>
        );
    };

    const renderHourlyData = (hourly: any) => {
        if (!hourly?.data?.length) return null;

        return (
            <UiCollapse label={`Hourly Forecast (${hourly.data.length} hours)`}>
                <div className="ui-weather__hourly">
                    <div className="ui-weather__summary">{hourly.summary}</div>
                    <div className="ui-weather__data-grid">
                        {hourly.data.map((hour: any, idx: number) => {
                            const hourIcon = getWeatherIcon(hour.icon);
                            return (
                                <UiCollapse
                                    key={idx}
                                    label={
                                        <div className="ui-weather__hour-label">
                                            <UiIcon icon={hourIcon} />
                                            <span>{dateFormat(hour.time, { isTimestamp: true })}</span>
                                            <span>{Math.round(hour.temperature)}°F</span>
                                        </div>
                                    }
                                >
                                    <div className="ui-weather__section">
                                        <div className="ui-weather__summary">{hour.summary}</div>
                                        {Object.entries(hour).map(([key, value]) =>
                                            renderDataItem(key, value)
                                        )}
                                    </div>
                                </UiCollapse>
                            );
                        })}
                    </div>
                </div>
            </UiCollapse>
        );
    };

    const renderDailyData = (daily: any) => {
        if (!daily?.data?.length) return null;

        return (
            <UiCollapse label={`Daily Forecast (${daily.data.length} days)`}>
                <div className="ui-weather__daily">
                    <div className="ui-weather__summary">{daily.summary}</div>
                    <div className="ui-weather__data-grid">
                        {daily.data.map((day: any, idx: number) => {
                            const dayIcon = getWeatherIcon(day.icon);
                            return (
                                <UiCollapse
                                    key={idx}
                                    label={
                                        <div className="ui-weather__day-label">
                                            <UiIcon icon={dayIcon} />
                                            <span>{dateFormat(day.time, { isTimestamp: true })}</span>
                                            <span>{Math.round(day.temperatureHigh)}°F / {Math.round(day.temperatureLow)}°F</span>
                                        </div>
                                    }
                                >
                                    <div className="ui-weather__section">
                                        <div className="ui-weather__summary">{day.summary}</div>
                                        {Object.entries(day).map(([key, value]) =>
                                            renderDataItem(key, value)
                                        )}
                                    </div>
                                </UiCollapse>
                            );
                        })}
                    </div>
                </div>
            </UiCollapse>
        );
    };

    const renderAlerts = (alerts: any[]) => {
        if (!alerts?.length) return null;

        return (
            <UiCollapse label={`⚠️ Weather Alerts (${alerts.length})`}>
                <div className="ui-weather__alerts">
                    {alerts.map((alert: any, idx: number) => (
                        <UiCollapse
                            key={idx}
                            label={
                                <div className="ui-weather__alert-label">
                                    <span className="ui-weather__alert-severity">[{alert.severity}]</span>
                                    <span>{alert.title}</span>
                                </div>
                            }
                        >
                            <div className="ui-weather__alert-content">
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Regions:</span>
                                    <span className="ui-weather__data-value">{alert.regions?.join(', ')}</span>
                                </div>
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Issued:</span>
                                    <span className="ui-weather__data-value">
                                        {dateFormat(alert.time, { isTimestamp: true })}
                                    </span>
                                </div>
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Expires:</span>
                                    <span className="ui-weather__data-value">
                                        {dateFormat(alert.expires, { isTimestamp: true })}
                                    </span>
                                </div>
                                <div className="ui-weather__alert-description">
                                    {alert.description}
                                </div>
                                {alert.uri && (
                                    <a href={alert.uri} target="_blank" rel="noopener noreferrer" className="ui-weather__alert-link">
                                        View Full Alert
                                    </a>
                                )}
                            </div>
                        </UiCollapse>
                    ))}
                </div>
            </UiCollapse>
        );
    };

    if (error) return <div className="ui-weather">Error: {error}</div>;
    if (!lngLat) return <div className="ui-weather">No coordinates...</div>;
    if (!weatherData) return <div className="ui-weather">Loading...</div>;

    const { currently } = weatherData;
    const currentIcon = getWeatherIcon(currently?.icon);
    const tempF = Math.round(currently?.temperature || 0);
    const tempC = Math.round(((currently?.temperature || 0) - 32) * 5 / 9);

    return (
        <>
            <style jsx>{styles}</style>
            <UiCollapse
                label={
                    <div className="ui-weather__header__title">
                        <UiIcon icon={currentIcon} />
                        <div className="ui-weather__location-temp">
                            {locationName && <div className="ui-weather__location-name">{locationName}</div>}
                            <div className="ui-weather__temp">
                                {tempF}°F / {tempC}°C
                            </div>
                        </div>
                        <span className="ui-weather__current-summary">{currently?.summary}</span>
                    </div>
                }
            >
                <div className="ui-weather">
                    {/* Location Info */}
                    <div className="ui-weather__section">
                        <h4>Location</h4>
                        {locationName && (
                            <div className="ui-weather__data-item">
                                <span className="ui-weather__data-label">Location:</span>
                                <span className="ui-weather__data-value">{locationName}</span>
                            </div>
                        )}
                        <div className="ui-weather__data-item">
                            <span className="ui-weather__data-label">Coordinates:</span>
                            <span className="ui-weather__data-value">
                                {weatherData.latitude}, {weatherData.longitude}
                            </span>
                        </div>
                        <div className="ui-weather__data-item">
                            <span className="ui-weather__data-label">Elevation:</span>
                            <span className="ui-weather__data-value">{weatherData.elevation} ft</span>
                        </div>
                        <div className="ui-weather__data-item">
                            <span className="ui-weather__data-label">Timezone:</span>
                            <span className="ui-weather__data-value">{weatherData.timezone}</span>
                        </div>
                    </div>

                    {/* Current Conditions */}
                    <UiCollapse label="Current Conditions">
                        <div className="ui-weather__section">
                            {Object.entries(currently || {}).map(([key, value]) =>
                                renderDataItem(key, value)
                            )}
                        </div>
                    </UiCollapse>

                    {/* Weather Alerts */}
                    {weatherData.alerts && renderAlerts(weatherData.alerts)}

                    {/* Minutely Forecast */}
                    {weatherData.minutely && renderMinutelyData(weatherData.minutely)}

                    {/* Hourly Forecast */}
                    {weatherData.hourly && renderHourlyData(weatherData.hourly)}

                    {/* Daily Forecast */}
                    {weatherData.daily && renderDailyData(weatherData.daily)}

                    {/* Data Sources */}
                    {weatherData.flags && (
                        <UiCollapse label="Data Sources">
                            <div className="ui-weather__section">
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Sources:</span>
                                    <span className="ui-weather__data-value">
                                        {weatherData.flags.sources?.join(', ')}
                                    </span>
                                </div>
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Units:</span>
                                    <span className="ui-weather__data-value">{weatherData.flags.units}</span>
                                </div>
                                <div className="ui-weather__data-item">
                                    <span className="ui-weather__data-label">Version:</span>
                                    <span className="ui-weather__data-value">{weatherData.flags.version}</span>
                                </div>
                            </div>
                        </UiCollapse>
                    )}
                </div>
            </UiCollapse>
        </>
    );
};

export default UiWeather;

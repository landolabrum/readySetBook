import React from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';
import UiBarGraph from '@webstack/components/Graphs/UiBarGraph/UiBarGraph';
import UiLineGraph from '@webstack/components/Graphs/UiLineGraph/UiLineGraph';
import OverlayMap from '../../OverlayMap/OverlayMap';
import styles from './OverlayWeatherView.scss';
import type { GpsState } from '@Canopy/models/overlay/gpsSource';
import {
    formatDay,
    formatHour,
    getSurfRatingLabel,
    getMoonIcon,
    getMoonPhaseName,
    getWeatherIcon,
    toCardinalDirection,
    type SurfData,
    type WeatherDailyEntry,
    type WeatherHourlyEntry,
} from '../overlayWeatherUtils';

type OverlayWeatherViewProps = {
    variant: OverlayWeatherVariant;
    isBlank: boolean;
    lat?: number | null;
    lng?: number | null;
    currentTime: string;
    tempColor: string;
    currentIcon: string;
    tempF: number;
    locationName: string;
    locationInfo?: string;
    title?: string | null;
    description?: string | null;
    elevation?: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    uvIndex: number;
    cloudCover: number;
    visibility: number;
    pressure: number;
    precipProbability: number;
    precipType?: string;
    nearestStormDistance?: number;
    sunriseTime?: number;
    sunsetTime?: number;
    moonPhase?: number;
    timezone?: string;
    hourlyGraphData: any;
    hourlySummary?: string;
    hourlyData?: WeatherHourlyEntry[];
    dailyData?: WeatherDailyEntry[];
    dailySummary?: string;
    surfData?: SurfData | null;
    loading: boolean;
    error: string | null;
    hasCoords: boolean;
    gpsState?: GpsState;
};

const renderGpsPill = (gpsState?: GpsState) => {
    if (!gpsState || gpsState.kind === 'none') return null;
    const label = (() => {
        switch (gpsState.kind) {
            case 'live':    return `LIVE`;
            case 'pending': return `WAITING ${gpsState.label}`;
            case 'stale':   return `STALE • ${gpsState.ageSec}s`;
            case 'error':   return `NO LINK ${gpsState.label}`;
        }
    })();
    return (
        <div className={`overlay-weather__gps-pill overlay-weather__gps-pill--${gpsState.kind}`}>
            <UiIcon icon="fa-satellite-dish" />
            <span>{label}</span>
        </div>
    );
};

type OverlayWeatherVariant = 'default' | 'time-temp' | 'today' | 'surf' | string | null;

const OverlayWeatherView: React.FC<OverlayWeatherViewProps> = (props) => {
    const {
        variant,
        isBlank,
        lat,
        lng,
        currentTime,
        tempColor,
        currentIcon,
        tempF,
        locationName,
        locationInfo,
        title,
        description,
        elevation,
        feelsLike,
        humidity,
        windSpeed,
        windDirection,
        uvIndex,
        cloudCover,
        visibility,
        pressure,
        precipProbability,
        precipType,
        nearestStormDistance,
        sunriseTime,
        sunsetTime,
        moonPhase,
        timezone,
        hourlyGraphData,
        hourlySummary,
        hourlyData,
        dailyData,
        dailySummary,
        surfData,
        loading,
        error,
        hasCoords,
        gpsState,
    } = props;

    if (error) {
        return (
            <>
                <style jsx>{styles}</style>
                <div className={`overlay-weather overlay-weather--error ${isBlank ? 'overlay-weather--blank' : ''}`}>
                    <UiIcon icon="fa-exclamation-triangle" />
                    <span className="overlay-weather__error">{error}</span>
                    {renderGpsPill(gpsState)}
                </div>
            </>
        );
    }

    if (!hasCoords) {
        return (
            <>
                <style jsx>{styles}</style>
                <div className={`overlay-weather overlay-weather--empty ${isBlank ? 'overlay-weather--blank' : ''}`}>
                    <UiIcon icon="fa-map-marker-alt" />
                    <span>{gpsState && gpsState.kind !== 'none' && gpsState.kind !== 'live' ? 'Awaiting GPS' : 'Set Location'}</span>
                    {renderGpsPill(gpsState)}
                </div>
            </>
        );
    }

    if (loading) {
        return (
            <>
                <style jsx>{styles}</style>
                <div className={`overlay-weather overlay-weather--loading ${isBlank ? 'overlay-weather--blank' : ''}`}>
                    <UiIcon icon="fa-spinner" spin />
                    <span>Loading...</span>
                    {renderGpsPill(gpsState)}
                </div>
            </>
        );
    }

    const isTimeTempVariant = variant === 'time-temp';
    const isSurfVariant = variant === 'surf';
    const hasTitle = Boolean(title && String(title).trim());
    const hasDescription = Boolean(description && String(description).trim());
    const showExtended = variant !== 'today';

    const surfCurrent = surfData?.current;
    const surfForecast = Array.isArray(surfData?.forecast) ? surfData?.forecast : [];
    const surfUnits = surfData?.units === 'metric' ? 'metric' : 'imperial';

    const waveUnit = surfUnits === 'metric' ? 'm' : 'ft';
    const windUnit = surfUnits === 'metric' ? 'km/h' : 'mph';
    const tempUnit = surfUnits === 'metric' ? 'C' : 'F';

    // Open-Meteo wave height is meters; convert only for presentation.
    const toDisplayWaveHeight = React.useCallback((meters?: number) => {
        if (!Number.isFinite(meters as number)) return null;
        const m = Number(meters);
        return surfUnits === 'metric' ? m : (m * 3.28084);
    }, [surfUnits]);

    const formatWaveHeight = React.useCallback((meters?: number) => {
        const display = toDisplayWaveHeight(meters);
        if (display == null) return '--';
        if (display > 0 && display < 0.001) return `<0.001 ${waveUnit}`;
        if (display > 0 && display < 0.01) return `<0.01 ${waveUnit}`;
        const decimals = display < 0.1 ? 3 : display < 1 ? 2 : 1;
        const text = display
            .toFixed(decimals)
            .replace(/\.0+$/, '')
            .replace(/(\.\d*[1-9])0+$/, '$1');
        return `${text} ${waveUnit}`;
    }, [toDisplayWaveHeight, waveUnit]);

    return (
        <>
            <style jsx>{styles}</style>
            <div
                className={`overlay-weather ${variant ? `overlay-weather--${variant}` : ''} ${isBlank ? 'overlay-weather--blank' : ''}`}
                role="region"
                aria-label="weather"
                style={{ '--temp-color': tempColor } as React.CSSProperties}
            >
                {renderGpsPill(gpsState)}
                {/* Only render map if we have valid GPS data */}
                {Number.isFinite(lat) && Number.isFinite(lng) && (
                    <div className="overlay-weather__map-bg">
                        <OverlayMap
                            course={{ center: [lng as number, lat as number], zoom: 10, pitch: 0, markers: [] }}
                            variant="blank"
                            aspect={1}
                        />
                    </div>
                )}

                {isSurfVariant ? (
                    <div className="overlay-weather__surf">
                        {(hasTitle || hasDescription) && (
                            <div className="overlay-weather__text">
                                {hasTitle && <UiMarkdown text={title || ''} jsxClass="overlay-weather__title" />}
                                {hasDescription && <UiMarkdown text={description || ''} jsxClass="overlay-weather__description" />}
                            </div>
                        )}

                        <div className="overlay-weather__surf-header">
                            <div className="overlay-weather__surf-location">
                                <UiIcon icon="fa-water" />
                                <span>{locationName || surfData?.beachName || 'Nearest Coastline'}</span>

                                {Number.isFinite(surfData?.beachDistanceMiles as number) && (
                                    <span className="overlay-weather__surf-distance">
                                        {surfUnits === 'metric'
                                            ? `${Math.round((surfData?.beachDistanceKm ?? 0) * 10) / 10} km`
                                            : `${Math.round((surfData?.beachDistanceMiles ?? 0) * 10) / 10} mi`}
                                    </span>
                                )}
                            </div>

                            <div className={`overlay-weather__surf-rating overlay-weather__surf-rating--${surfData?.rating || 'poor'}`}>
                                {getSurfRatingLabel(surfData?.rating || 'poor')}

                            </div>
                        </div>

                        {(locationInfo || locationName) && (
                            <div className="overlay-weather__surf-nearby d-flex justify-between">
                            <div>
                                    {/* <UiIcon icon="fa-map-pin" /> */}
                                    {/* {locationInfo || locationName} */}
                                </div>
                                <div>
                                    <div className="overlay-weather__surf-weather-main">

                                        {/* <span className="overlay-weather__surf-weather-location">{locationInfo || locationName || 'Local Weather'}</span> */}
                                    </div>
                                    <div className="overlay-weather__surf-weather-meta">
                                        <UiIcon icon={currentIcon} color={tempColor} />
                                        <span className="overlay-weather__surf-weather-temp">{tempF}°F</span>
                                        <span>Feels {feelsLike}°F</span>
                                        {/* <span>{humidity}% humidity</span> */}
                                        {/* <span>{windSpeed} {windUnit} {windDirection || ''}</span> */}
                                    </div>
                                </div>
                            </div>
                        )}






                        <div className="overlay-weather__surf-summary">{surfData?.summary || 'Surf forecast unavailable'}</div>


                        <div className="overlay-weather__surf-current-grid">
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Wave</span>
                                <span className="overlay-weather__surf-value">
                                    {Number.isFinite(surfCurrent?.waveHeight as number)
                                        ? formatWaveHeight(surfCurrent?.waveHeight)
                                        : '--'}
                                </span>
                            </div>
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Period</span>
                                <span className="overlay-weather__surf-value">
                                    {Number.isFinite(surfCurrent?.wavePeriod as number)
                                        ? `${Math.round(surfCurrent?.wavePeriod ?? 0)} s`
                                        : '--'}
                                </span>
                            </div>
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Swell Dir</span>
                                <span className="overlay-weather__surf-value">
                                    {toCardinalDirection(surfCurrent?.waveDirection) || '--'}
                                </span>
                            </div>
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Wind</span>
                                <span className="overlay-weather__surf-value">
                                    {Number.isFinite(surfCurrent?.windSpeed as number)
                                        ? `${Math.round(surfCurrent?.windSpeed ?? 0)} ${windUnit} ${toCardinalDirection(surfCurrent?.windDirection)}`
                                        : '--'}
                                </span>
                            </div>
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Sea Temp</span>
                                <span className="overlay-weather__surf-value">
                                    {Number.isFinite(surfCurrent?.seaTemperature as number)
                                        ? `${Math.round(surfCurrent?.seaTemperature ?? 0)} ${tempUnit}`
                                        : '--'}
                                </span>
                            </div>
                            <div className="overlay-weather__surf-metric">
                                <span className="overlay-weather__surf-label">Updated</span>
                                <span className="overlay-weather__surf-value">{currentTime}</span>
                            </div>
                        </div>

                        <div className="overlay-weather__section-label">Wave Trend</div>
                        <div className="overlay-weather__surf-bar-wrap">
                            <UiBarGraph
                                data={surfForecast.slice(0, 12).map((entry) => ({
                                    count: Number((toDisplayWaveHeight(entry?.waveHeight) ?? 0).toFixed(2)),
                                    date: formatHour(entry.time as number, timezone),
                                }))}
                                height={120}
                                variant="vertical"
                            />
                        </div>
                    </div>
                ) : isTimeTempVariant ? (
                    <div className="overlay-weather__time-temp">
                        <div className="overlay-weather__time-section">
                            <UiIcon icon="fa-clock" />
                            <span className="overlay-weather__time">{currentTime}</span>
                        </div>
                        <div className="overlay-weather__divider"></div>
                        <div className="overlay-weather__temp-section">
                            <UiIcon color={tempColor} icon={currentIcon} />
                            <span className="overlay-weather__temp-value">{tempF}°</span>
                        </div>
                        {(hasTitle || hasDescription) && (
                            <div className="overlay-weather__text">
                                {hasTitle && <UiMarkdown text={title || ''} jsxClass="overlay-weather__title" />}
                                {hasDescription && <UiMarkdown text={description || ''} jsxClass="overlay-weather__description" />}
                            </div>
                        )}
                        {locationName && <div className="overlay-weather__location-compact">{locationName}</div>}
                    </div>
                ) : (
                    <>
                        {(hasTitle || hasDescription) && (
                            <div className="overlay-weather__text">
                                {hasTitle && <UiMarkdown text={title || ''} jsxClass="overlay-weather__title" />}
                                {hasDescription && <UiMarkdown text={description || ''} jsxClass="overlay-weather__description" />}
                            </div>
                        )}
                        <div className="overlay-weather__header">
                            <div className="overlay-weather__main">
                                <div className="overlay-weather__temp">
                                            <span className="overlay-weather__temp-value">{tempF}</span>
                                            <span className="overlay-weather__temp-unit">°F</span>
                                </div>
                                {locationName && <div className="overlay-weather__location">{locationName}</div>}
                                {elevation !== undefined && (
                                    <div className="overlay-weather__elevation">
                                        <UiIcon icon="fa-mountain" />
                                        <span>{elevation.toLocaleString()} ft</span>
                                    </div>
                                )}
                            </div>
                            <div className="overlay-weather__icon">
                                <UiIcon color={tempColor} icon={currentIcon} />
                            </div>
                            <div className="overlay-weather__divider"></div>
                            <div className="overlay-weather__time-section">
                                <UiIcon icon="fa-clock" />
                                <span className="overlay-weather__time">{currentTime}</span>
                            </div>
                        </div>

                        <div className="overlay-weather__details">
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-temperature-low" />
                                <span>Feels {feelsLike}°F</span>
                            </div>
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-tint" />
                                <span>{humidity}%</span>
                            </div>
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-wind" />
                                <span>{windSpeed} mph {windDirection}</span>
                            </div>
                        </div>

                        <div className="overlay-weather__details overlay-weather__details--secondary">
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-sun" />
                                <span>UV {uvIndex}</span>
                            </div>
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-cloud" />
                                <span>{cloudCover}%</span>
                            </div>
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-eye" />
                                <span>{visibility} mi</span>
                            </div>
                            <div className="overlay-weather__detail">
                                <UiIcon icon="fa-cloud-arrow-down" />
                                <span>{pressure} millibars</span>
                            </div>
                        </div>

                        {(precipProbability > 0 || (nearestStormDistance !== undefined && nearestStormDistance < 100)) && (
                            <div className="overlay-weather__precip">
                                <UiIcon icon={precipType === 'snow' ? 'fa-snowflake' : 'fa-cloud-rain'} />
                                <span>{precipProbability}% chance of {precipType || 'rain'}</span>
                                {nearestStormDistance !== undefined && nearestStormDistance < 100 && (
                                    <span className="overlay-weather__storm-distance">• Storm {Math.round(nearestStormDistance)} mi away</span>
                                )}
                            </div>
                        )}

                        {(sunriseTime || sunsetTime || moonPhase !== undefined) && (
                            <div className="overlay-weather__celestial">
                                {sunriseTime && (
                                    <div className="overlay-weather__celestial-item">
                                        <UiIcon icon="fa-sunrise" />
                                        <span>{formatHour(sunriseTime, timezone)}</span>
                                    </div>
                                )}
                                {sunsetTime && (
                                    <div className="overlay-weather__celestial-item">
                                        <UiIcon icon="fa-sunset" />
                                        <span>{formatHour(sunsetTime, timezone)}</span>
                                    </div>
                                )}
                                {moonPhase !== undefined && (
                                    <div className="overlay-weather__celestial-item">
                                        <UiIcon icon={getMoonIcon(moonPhase)} />
                                        <span>{getMoonPhaseName(moonPhase)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {hourlyGraphData && showExtended && (
                            <div className="overlay-weather__hourly-section">
                                <div className="overlay-weather__section-label">{hourlySummary || 'Hourly Forecast'}</div>
                                <div className="overlay-weather__hourly-graph">
                                    <UiLineGraph
                                        data={hourlyGraphData}
                                        variant="grid"
                                        traits={{ strokeWidth: 2, padding: 8, showDots: true }}
                                    />
                                    <div className="overlay-weather__hourly-labels">
                                        {hourlyData?.slice(0, 6).map((h, idx) => (
                                            <div key={idx} className="overlay-weather__hourly-label">
                                                <UiIcon icon={getWeatherIcon(h.icon)} /><br/>
                                                <span>{formatHour(h.time as number, timezone)}</span>
                                                <span>{Math.round(h.temperature ?? 0)}°</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {dailyData && dailyData.length > 1 && showExtended && (
                            <div className="overlay-weather__daily-section">
                                <div className="overlay-weather__section-label">{dailySummary || 'Weekly Forecast'}</div>
                                <div className="overlay-weather__daily-scroll">
                                    <div className="overlay-weather__daily-forecast">
                                        {dailyData.slice(0, 7).map((day, idx) => (
                                            <div key={`day-${idx}`} className="overlay-weather__daily-item">
                                                <span className="overlay-weather__daily-day">{idx === 0 ? 'Today' : formatDay(day.time as number, timezone)}</span>
                                                <UiIcon icon={getWeatherIcon(day.icon)} />
                                                <span className="overlay-weather__daily-temps">
                                                    <span className="overlay-weather__daily-high">{Math.round(day.temperatureHigh ?? 0)}°</span>
                                                    <span className="overlay-weather__daily-low">{Math.round(day.temperatureLow ?? 0)}°</span>
                                                </span>
                                                {(day.precipProbability ?? 0) > 0 && (
                                                    <span className="overlay-weather__daily-precip">
                                                        <UiIcon icon="fa-tint" />
                                                        {Math.round((day.precipProbability ?? 0) * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        {dailyData.slice(0, 7).map((day, idx) => (
                                            <div key={`day-dup-${idx}`} className="overlay-weather__daily-item">
                                                <span className="overlay-weather__daily-day">{idx === 0 ? 'Today' : formatDay(day.time as number, timezone)}</span>
                                                <UiIcon icon={getWeatherIcon(day.icon)} />
                                                <span className="overlay-weather__daily-temps">
                                                    <span className="overlay-weather__daily-high">{Math.round(day.temperatureHigh ?? 0)}°</span>
                                                    <span className="overlay-weather__daily-low">{Math.round(day.temperatureLow ?? 0)}°</span>
                                                </span>
                                                {(day.precipProbability ?? 0) > 0 && (
                                                    <span className="overlay-weather__daily-precip">
                                                        <UiIcon icon="fa-tint" />
                                                        {Math.round((day.precipProbability ?? 0) * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default OverlayWeatherView;

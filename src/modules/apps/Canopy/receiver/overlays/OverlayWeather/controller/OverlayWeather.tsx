import React from 'react';
import {
  buildHourlyGraphData,
  getTempColor,
  getWeatherIcon,
  getWindDirection,
  type SurfData,
  type SurfOverlayConfig,
  // type WeatherDailyEntry,
  // type WeatherData,
  // type WeatherHourlyEntry,
} from '../overlayWeatherUtils';
import OverlayWeatherView from '../views/OverlayWeatherView';
import { useOverlayWeather } from '../useOverlayWeather';
import type { GpsState } from '@Canopy/models/overlay/gpsSource';

// Re-exported for downstream importers — shape changed: teamNumber → label
export type { GpsState as OverlayWeatherGpsState };

export type OverlayWeatherProps = {
  lat?: number | null;
  lng?: number | null;
  variant?: 'default' | 'time-temp' | 'today' | 'surf' | string | null;
  title?: string | null;
  description?: string | null;
  /** Pre-resolved address from overlay data (avoids reverse-geocode call) */
  addressHint?: { city?: string; state?: string; country?: string } | null;
  surfConfig?: SurfOverlayConfig;
  gpsState?: GpsState;
};

const OverlayWeather: React.FC<OverlayWeatherProps> = ({
  lat,
  lng,
  variant = 'default',
  title,
  description,
  addressHint,
  surfConfig,
  gpsState,
}) => {
  const { weatherData, surfData, locationName, error, loading, currentTime, hasCoords } = useOverlayWeather(
    lat,
    lng,
    addressHint,
    variant,
    surfConfig,
  );

  const { currently } = weatherData || {};
  const currentIcon = getWeatherIcon(currently?.icon);
  const tempF = Math.round(currently?.temperature ?? 0);
  const humidity = Math.round((currently?.humidity ?? 0) * 100);
  const windSpeed = Math.round(currently?.windSpeed ?? 0);
  const feelsLike = Math.round((currently?.apparentTemperature ?? tempF));

  // Additional weather data
  const windBearing = currently?.windBearing;
  const windDirection = windBearing !== undefined ? getWindDirection(windBearing) : '';
  const uvIndex = currently?.uvIndex ?? 0;
  const visibility = currently?.visibility ?? 10;
  const pressure = Math.round(currently?.pressure ?? 0);
  const cloudCover = Math.round((currently?.cloudCover ?? 0) * 100);
  const precipProbability = Math.round((currently?.precipProbability ?? 0) * 100);
  const precipType = currently?.precipType;
  const nearestStormDistance = currently?.nearestStormDistance;

  // Location data
  const elevation = weatherData?.elevation;

  // Daily forecast data
  const dailyData = weatherData?.daily?.data;
  const todayDaily = dailyData?.[0];
  const sunriseTime = todayDaily?.sunriseTime;
  const sunsetTime = todayDaily?.sunsetTime;
  const moonPhase = todayDaily?.moonPhase;
  const dailySummary = weatherData?.daily?.summary;
  const timezone = weatherData?.timezone;

  // Hourly forecast data for graph
  const hourlyData = weatherData?.hourly?.data;
  const hourlySummary = weatherData?.hourly?.summary;
  const hourlyGraphData = React.useMemo(
    () => buildHourlyGraphData(hourlyData, 12),
    [hourlyData],
  );

  // Video overlay: No refs needed - tooltips removed for non-interactive output

  const tempColor = React.useMemo(() => getTempColor(tempF), [tempF]);
  const isBlank = variant === 'blank';
  const locationInfo = React.useMemo(() => {
    const parts = [addressHint?.city, addressHint?.state, addressHint?.country]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return parts.join(', ');
  }, [addressHint]);

  return (
    <OverlayWeatherView
      variant={variant}
      isBlank={isBlank}
      lat={lat}
      lng={lng}
      currentTime={currentTime}
      tempColor={tempColor}
      currentIcon={currentIcon}
      tempF={tempF}
      locationName={locationName}
      locationInfo={locationInfo}
      title={title}
      description={description}
      elevation={elevation}
      feelsLike={feelsLike}
      humidity={humidity}
      windSpeed={windSpeed}
      windDirection={windDirection}
      uvIndex={uvIndex}
      cloudCover={cloudCover}
      visibility={visibility}
      pressure={pressure}
      precipProbability={precipProbability}
      precipType={precipType}
      nearestStormDistance={nearestStormDistance}
      sunriseTime={sunriseTime}
      sunsetTime={sunsetTime}
      moonPhase={moonPhase}
      timezone={timezone}
      hourlyGraphData={hourlyGraphData}
      hourlySummary={hourlySummary}
      hourlyData={hourlyData}
      dailyData={dailyData}
      dailySummary={dailySummary}
      surfData={surfData as SurfData | null}
      loading={loading}
      error={error}
      hasCoords={hasCoords}
      gpsState={gpsState}
    />
  );
};

export default OverlayWeather;

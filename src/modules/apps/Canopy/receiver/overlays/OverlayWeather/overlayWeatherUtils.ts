export const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
};

export type WeatherCurrently = {
    time?: number;
    icon?: string;
    summary?: string;
    temperature?: number;
    apparentTemperature?: number;
    humidity?: number;
    windSpeed?: number;
    windBearing?: number;
    windGust?: number;
    uvIndex?: number;
    visibility?: number;
    pressure?: number;
    cloudCover?: number;
    dewPoint?: number;
    precipProbability?: number;
    precipType?: string;
    ozone?: number;
    nearestStormDistance?: number;
};

export type WeatherDailyEntry = {
    time?: number;
    sunriseTime?: number;
    sunsetTime?: number;
    moonPhase?: number;
    temperatureHigh?: number;
    temperatureLow?: number;
    precipProbability?: number;
    icon?: string;
};

export type WeatherHourlyEntry = {
    time?: number;
    temperature?: number;
    icon?: string;
};

export type WeatherData = {
    timezone?: string;
    currently?: WeatherCurrently;
    daily?: { data?: WeatherDailyEntry[]; summary?: string };
    hourly?: { data?: WeatherHourlyEntry[]; summary?: string };
    elevation?: number;
};

export type SurfUnits = 'imperial' | 'metric';

export type SurfOverlayConfig = {
    maxBeachSearchKm?: number;
    forecastHours?: number;
    units?: SurfUnits;
};

export type SurfForecastEntry = {
    time?: number;
    waveHeight?: number;
    wavePeriod?: number;
    waveDirection?: number;
    windSpeed?: number;
    windDirection?: number;
    seaTemperature?: number;
};

export type SurfData = {
    beachName?: string;
    beachDistanceMiles?: number;
    beachDistanceKm?: number;
    rating: 'poor' | 'fair' | 'good' | 'excellent';
    summary: string;
    current: SurfForecastEntry;
    forecast: SurfForecastEntry[];
    units: SurfUnits;
    provider: 'open-meteo-marine';
};

export const getWindDirection = (bearing: number): string => {
    const directions = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
    ];
    const idx = Math.round(bearing / 22.5) % 16;
    return directions[idx];
};

export const toCardinalDirection = (bearing?: number): string => {
    if (!Number.isFinite(bearing as number)) return '';
    return getWindDirection(Number(bearing));
};

export const milesToKm = (miles?: number): number | undefined => {
    if (!Number.isFinite(miles as number)) return undefined;
    return Number(miles) * 1.609344;
};

export const kmToMiles = (km?: number): number | undefined => {
    if (!Number.isFinite(km as number)) return undefined;
    return Number(km) / 1.609344;
};

export const scoreSurfConditions = (waveHeight?: number, wavePeriod?: number, windSpeed?: number): SurfData['rating'] => {
    const h = Number.isFinite(waveHeight as number) ? Number(waveHeight) : 0;
    const p = Number.isFinite(wavePeriod as number) ? Number(wavePeriod) : 0;
    const w = Number.isFinite(windSpeed as number) ? Number(windSpeed) : 99;

    if (h >= 3 && h <= 8 && p >= 10 && w <= 12) return 'excellent';
    if (h >= 2 && h <= 10 && p >= 8 && w <= 18) return 'good';
    if (h >= 1 && p >= 6 && w <= 24) return 'fair';
    return 'poor';
};

export const describeSurfRating = (
    rating: SurfData['rating'],
    opts?: {
        waveHeight?: number;
        wavePeriod?: number;
        windSpeed?: number;
        units?: SurfUnits;
    },
): string => {
    const h = Number.isFinite(opts?.waveHeight as number) ? Number(opts?.waveHeight) : null;
    const p = Number.isFinite(opts?.wavePeriod as number) ? Number(opts?.wavePeriod) : null;
    const w = Number.isFinite(opts?.windSpeed as number) ? Number(opts?.windSpeed) : null;
    const units = opts?.units === 'metric' ? 'metric' : 'imperial';

    const waveText = (() => {
        if (h == null) return '';
        // Open-Meteo marine wave height is meters.
        if (h < 0.25) return 'Minimal wave action';
        if (h < 0.75) return 'Small waves';
        if (h < 1.5) return 'Moderate waves';
        if (h < 2.5) return 'Larger waves';
        return 'High wave energy';
    })();

    const periodText = (() => {
        if (p == null) return '';
        if (p < 5) return 'short-period chop';
        if (p < 9) return 'mixed-period surface';
        return 'longer-period sets';
    })();

    const windText = (() => {
        if (w == null) return '';
        const light = units === 'metric' ? 15 : 10;
        const moderate = units === 'metric' ? 28 : 18;
        if (w <= light) return 'light winds';
        if (w <= moderate) return 'moderate winds';
        return 'strong winds';
    })();

    const parts = [waveText, periodText, windText].filter(Boolean);
    if (parts.length) return parts.join(', ');

    if (rating === 'excellent') return 'Organized wave lines with steadier surface conditions';
    if (rating === 'good') return 'Moderate wave lines with manageable chop';
    if (rating === 'fair') return 'Variable chop and mixed wave energy';
    return 'Low wave energy with wind-driven surface texture';
};

export const getSurfRatingLabel = (rating?: SurfData['rating'] | null): string => {
    if (rating === 'excellent') return 'ACTIVE';
    if (rating === 'good') return 'MODERATE';
    if (rating === 'fair') return 'LIGHT';
    return 'CALM';
};

export const formatHour = (timestamp: number, timezone?: string): string => {
    const date = new Date(timestamp * 1000);
    try {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true,
            timeZone: timezone,
        });
    } catch {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    }
};

export const formatDay = (timestamp: number, timezone?: string): string => {
    const date = new Date(timestamp * 1000);
    try {
        return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
    } catch {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
};

export const getMoonPhaseName = (phase: number): string => {
    if (phase < 0.03 || phase >= 0.97) return 'New Moon';
    if (phase < 0.22) return 'Waxing Crescent';
    if (phase < 0.28) return 'First Quarter';
    if (phase < 0.47) return 'Waxing Gibbous';
    if (phase < 0.53) return 'Full Moon';
    if (phase < 0.72) return 'Waning Gibbous';
    if (phase < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
};

export const getMoonIcon = (phase: number): string => {
    if (phase < 0.03 || phase >= 0.97) return 'fa-moon';
    if (phase < 0.25) return 'fa-moon';
    if (phase < 0.5) return 'fa-moon';
    if (phase < 0.75) return 'fa-moon';
    return 'fa-moon';
};

export const getWeatherIcon = (icon?: string): string => {
    switch (icon) {
        case 'clear-day':
            return 'fa-sun';
        case 'clear-night':
            return 'fa-moon';
        case 'rain':
            return 'fa-cloud-showers-heavy';
        case 'snow':
            return 'fa-snowflake';
        case 'sleet':
            return 'fa-cloud-meatball';
        case 'wind':
            return 'fa-wind';
        case 'fog':
            return 'fa-smog';
        case 'cloudy':
            return 'fa-cloud';
        case 'partly-cloudy-day':
            return 'fa-cloud-sun';
        case 'partly-cloudy-night':
            return 'fa-cloud-moon';
        case 'hail':
            return 'fa-cloud-meatball';
        case 'thunderstorm':
            return 'fa-bolt';
        case 'tornado':
            return 'fa-tornado';
        default:
            return 'fa-question';
    }
};

export const buildHourlyGraphData = (
    hourlyData?: WeatherHourlyEntry[],
    limit: number = 12,
) => {
    if (!hourlyData?.length) return null;
    const points = hourlyData.slice(0, limit).map((h) => ({
        x: h.time as number,
        y: Math.round(h.temperature ?? 0),
    }));
    return { temperature: { points, color: '#4fc3f7', label: '°F' } };
};

export const getTempColor = (tempF: number): string => {
    if (tempF < 0) return '#a0c4ff';
    if (tempF < 20) return '#90caf9';
    if (tempF < 40) return '#4fc3f7';
    if (tempF < 60) return '#4dd0e1';
    if (tempF < 80) return '#80deea';
    return '#b2ebf2';
};

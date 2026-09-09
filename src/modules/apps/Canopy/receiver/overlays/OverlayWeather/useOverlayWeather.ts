import React from 'react';
import {
    TIME_FORMAT_OPTIONS,
    describeSurfRating,
    scoreSurfConditions,
    type SurfData,
    type SurfOverlayConfig,
    type WeatherData,
} from './overlayWeatherUtils';

type OverlayWeatherVariant = 'default' | 'time-temp' | 'today' | 'surf' | string | null;

type AddressHint = { city?: string; state?: string; country?: string } | null | undefined;

type BeachCandidate = {
    name: string;
    lat: number;
    lng: number;
    distanceMiles: number;
};

const EARTH_RADIUS_MILES = 3958.7613;

// Cell-quantized caches: cluster nearby fetches to one network call.
// Quantize lat/lng to a grid (~5km for weather, ~10km for geocode) so a moving
// boat that hasn't crossed a cell boundary reuses the cached payload.
const WEATHER_CELL_DEG = 0.05;
const GEOCODE_CELL_DEG = 0.1;
const WEATHER_TTL_MS = 5 * 60 * 1000;
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;

const cellKey = (lat: number, lng: number, sizeDeg: number, prefix: string) => {
    const qLat = Math.round(lat / sizeDeg) * sizeDeg;
    const qLng = Math.round(lng / sizeDeg) * sizeDeg;
    return `${prefix}:${qLat.toFixed(3)},${qLng.toFixed(3)}`;
};

type CacheEntry<T> = { data: T; fetchedAt: number };
const weatherCache = new Map<string, CacheEntry<WeatherData>>();
const geocodeCache = new Map<string, CacheEntry<string>>();

const cacheGet = <T,>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > ttlMs) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};

const cacheSet = <T,>(cache: Map<string, CacheEntry<T>>, key: string, data: T) => {
    cache.set(key, { data, fetchedAt: Date.now() });
};

const toNum = (value: unknown): number | null => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

const distanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
};

const resolveNearestBeach = async (
    lat: number,
    lng: number,
    maxBeachSearchKm: number,
    signal: AbortSignal,
): Promise<BeachCandidate | null> => {
    const radiusMeters = Math.max(1000, Math.round(maxBeachSearchKm * 1000));
    const query = [
        '[out:json][timeout:20];',
        '(',
        `node(around:${radiusMeters},${lat},${lng})[natural=beach];`,
        `way(around:${radiusMeters},${lat},${lng})[natural=beach];`,
        `relation(around:${radiusMeters},${lat},${lng})[natural=beach];`,
        ');',
        'out center tags qt;',
    ].join('');

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const payload = await res.json();
    const elements: any[] = Array.isArray(payload?.elements) ? payload.elements : [];

    const candidates = elements
        .map((el) => {
            const candLat = toNum(el?.lat ?? el?.center?.lat);
            const candLng = toNum(el?.lon ?? el?.center?.lon);
            if (candLat == null || candLng == null) return null;
            const nameRaw = el?.tags?.name || el?.tags?.official_name || el?.tags?.name_en || 'Nearest Beach';
            return {
                name: String(nameRaw),
                lat: candLat,
                lng: candLng,
                distanceMiles: distanceMiles(lat, lng, candLat, candLng),
            } as BeachCandidate;
        })
        .filter(Boolean) as BeachCandidate[];

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return candidates[0] ?? null;
};

const fetchSurfFromMarineApi = async (
    lat: number,
    lng: number,
    forecastHours: number,
    units: 'imperial' | 'metric',
    signal: AbortSignal,
) => {
    const marineParams = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        timezone: 'auto',
        current: 'wave_height,wave_direction,wave_period',
        hourly: 'wave_height,wave_direction,wave_period',
    });

    const forecastParams = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        timezone: 'auto',
        hourly: 'wind_speed_10m,wind_direction_10m,sea_surface_temperature',
        wind_speed_unit: units === 'metric' ? 'kmh' : 'mph',
        temperature_unit: units === 'metric' ? 'celsius' : 'fahrenheit',
    });

    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${marineParams.toString()}`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?${forecastParams.toString()}`;

    const [marineRes, forecastRes] = await Promise.all([
        fetch(marineUrl, { signal }),
        fetch(forecastUrl, { signal }),
    ]);

    if (!marineRes.ok) {
        throw new Error(`Open-Meteo marine HTTP ${marineRes.status}`);
    }

    if (!forecastRes.ok) {
        throw new Error(`Open-Meteo forecast HTTP ${forecastRes.status}`);
    }

    const marineData = await marineRes.json();
    const forecastData = await forecastRes.json();

    const current = marineData?.current ?? {};
    const hourly = marineData?.hourly ?? {};
    const weatherHourly = forecastData?.hourly ?? {};

    const times: string[] = Array.isArray(hourly?.time) ? hourly.time : [];
    const limit = Math.max(3, Math.min(48, Math.round(forecastHours || 12)));

    const firstWindSpeed = toNum(weatherHourly?.wind_speed_10m?.[0]) ?? undefined;
    const firstWindDirection = toNum(weatherHourly?.wind_direction_10m?.[0]) ?? undefined;
    const firstSeaTemp = toNum(weatherHourly?.sea_surface_temperature?.[0]) ?? undefined;

    const forecast = times.slice(0, limit).map((iso, idx) => ({
        time: Math.floor(new Date(iso).getTime() / 1000),
        waveHeight: toNum(hourly?.wave_height?.[idx]) ?? undefined,
        wavePeriod: toNum(hourly?.wave_period?.[idx]) ?? undefined,
        waveDirection: toNum(hourly?.wave_direction?.[idx]) ?? undefined,
        windSpeed: toNum(weatherHourly?.wind_speed_10m?.[idx]) ?? undefined,
        windDirection: toNum(weatherHourly?.wind_direction_10m?.[idx]) ?? undefined,
        seaTemperature: toNum(weatherHourly?.sea_surface_temperature?.[idx]) ?? undefined,
    }));

    return {
        current: {
            time: Math.floor(new Date(current?.time || Date.now()).getTime() / 1000),
            waveHeight: toNum(current?.wave_height) ?? undefined,
            wavePeriod: toNum(current?.wave_period) ?? undefined,
            waveDirection: toNum(current?.wave_direction) ?? undefined,
            windSpeed: firstWindSpeed,
            windDirection: firstWindDirection,
            seaTemperature: firstSeaTemp,
        },
        forecast,
    };
};

export const useOverlayWeather = (
    lat?: number | null,
    lng?: number | null,
    addressHint?: AddressHint,
    variant?: OverlayWeatherVariant,
    surfConfig?: SurfOverlayConfig,
) => {
    const [weatherData, setWeatherData] = React.useState<WeatherData | null>(null);
    const [weatherError, setWeatherError] = React.useState<string | null>(null);
    const [weatherLoading, setWeatherLoading] = React.useState<boolean>(false);
    const [surfData, setSurfData] = React.useState<SurfData | null>(null);
    const [surfError, setSurfError] = React.useState<string | null>(null);
    const [surfLoading, setSurfLoading] = React.useState<boolean>(false);
    const [locationName, setLocationName] = React.useState<string>('');
    const [currentTime, setCurrentTime] = React.useState<string>('');

    const hasCoords = Number.isFinite(lat ?? NaN) && Number.isFinite(lng ?? NaN);
    const isSurfVariant = variant === 'surf';
    const timezone = weatherData?.timezone;
    const currentTimestamp = weatherData?.currently?.time;

    React.useEffect(() => {
        let formatter: Intl.DateTimeFormat | null = null;
        if (timezone) {
            try {
                formatter = new Intl.DateTimeFormat('en-US', {
                    ...TIME_FORMAT_OPTIONS,
                    timeZone: timezone,
                });
            } catch (err) {
                console.warn('[OverlayWeather] Invalid timezone', timezone, err);
            }
        }

        const timestampDate = currentTimestamp ? new Date(currentTimestamp * 1000) : null;
        const updateTime = () => {
            if (formatter) {
                setCurrentTime(formatter.format(new Date()));
                return;
            }
            if (timestampDate) {
                setCurrentTime(timestampDate.toLocaleTimeString('en-US', TIME_FORMAT_OPTIONS));
                return;
            }
            setCurrentTime(new Date().toLocaleTimeString('en-US', TIME_FORMAT_OPTIONS));
        };

        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [timezone, currentTimestamp]);

    React.useEffect(() => {
        setWeatherData(null);
        setWeatherError(null);

        if (!hasCoords) {
            setWeatherError('Location required');
            setWeatherLoading(false);
            return;
        }

        const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
        if (!apiBase) {
            setWeatherError('Weather API unavailable');
            setWeatherLoading(false);
            return;
        }

        const url = `${apiBase}/weather/${lat},${lng}?units=us`;
        let cancelled = false;
        let controller: AbortController | null = null;

        const wKey = cellKey(lat as number, lng as number, WEATHER_CELL_DEG, 'wx');

        const fetchWeather = async (showSpinner: boolean) => {
            const cached = cacheGet(weatherCache, wKey, WEATHER_TTL_MS);
            if (cached) {
                if (cancelled) return;
                setWeatherData(cached);
                setWeatherError(null);
                if (showSpinner) setWeatherLoading(false);
                return;
            }
            controller?.abort();
            controller = new AbortController();
            if (showSpinner) setWeatherLoading(true);
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: WeatherData = await res.json();
                if (cancelled) return;
                cacheSet(weatherCache, wKey, data);
                setWeatherData(data);
                setWeatherError(null);
            } catch (err: any) {
                if (cancelled || err?.name === 'AbortError') return;
                console.error('[Weather Fetch Error]', err);
                setWeatherError('Weather unavailable');
            } finally {
                if (!cancelled && showSpinner) setWeatherLoading(false);
            }
        };

        fetchWeather(true);
        const interval = setInterval(() => fetchWeather(false), 120000);
        return () => {
            cancelled = true;
            controller?.abort();
            clearInterval(interval);
        };
    }, [hasCoords, isSurfVariant, lat, lng]);

    React.useEffect(() => {
        setSurfData(null);
        setSurfError(null);

        if (!isSurfVariant) {
            setSurfLoading(false);
            return;
        }

        if (!hasCoords) {
            setSurfError('Location required');
            setSurfLoading(false);
            return;
        }

        const units = surfConfig?.units === 'metric' ? 'metric' : 'imperial';
        const maxBeachSearchKm = (() => {
            const n = Number(surfConfig?.maxBeachSearchKm ?? 60);
            if (!Number.isFinite(n)) return 60;
            return Math.max(1, Math.min(250, n));
        })();
        const forecastHours = (() => {
            const n = Number(surfConfig?.forecastHours ?? 12);
            if (!Number.isFinite(n)) return 12;
            return Math.max(3, Math.min(48, Math.round(n)));
        })();

        let cancelled = false;
        let controller: AbortController | null = null;

        const fetchSurf = async (showSpinner: boolean) => {
            controller?.abort();
            controller = new AbortController();
            if (showSpinner) setSurfLoading(true);

            try {
                const baseLat = Number(lat);
                const baseLng = Number(lng);
                const beach = await resolveNearestBeach(baseLat, baseLng, maxBeachSearchKm, controller.signal)
                    .catch(() => null);

                const surfLat = beach?.lat ?? baseLat;
                const surfLng = beach?.lng ?? baseLng;
                const marine = await fetchSurfFromMarineApi(
                    surfLat,
                    surfLng,
                    forecastHours,
                    units,
                    controller.signal,
                );

                if (cancelled) return;

                const rating = scoreSurfConditions(
                    marine.current.waveHeight,
                    marine.current.wavePeriod,
                    marine.current.windSpeed,
                );

                setSurfData({
                    beachName: beach?.name,
                    // beachName: beach?.name ?? 'Nearest Coastline',
                    beachDistanceMiles: beach?.distanceMiles,
                    beachDistanceKm: beach?.distanceMiles != null ? beach.distanceMiles * 1.609344 : undefined,
                    rating,
                    summary: describeSurfRating(rating, {
                        waveHeight: marine.current.waveHeight,
                        wavePeriod: marine.current.wavePeriod,
                        windSpeed: marine.current.windSpeed,
                        units,
                    }),
                    current: marine.current,
                    forecast: marine.forecast,
                    units,
                    provider: 'open-meteo-marine',
                });
                setSurfError(null);
            } catch (err: any) {
                if (cancelled || err?.name === 'AbortError') return;
                console.error('[Surf Fetch Error]', err);
                setSurfError('Surf unavailable');
            } finally {
                if (!cancelled && showSpinner) setSurfLoading(false);
            }
        };

        fetchSurf(true);
        const interval = setInterval(() => fetchSurf(false), 180000);
        return () => {
            cancelled = true;
            controller?.abort();
            clearInterval(interval);
        };
    }, [hasCoords, isSurfVariant, lat, lng, surfConfig?.forecastHours, surfConfig?.maxBeachSearchKm, surfConfig?.units]);

    // Use stored address from overlay data when available; fall back to nominatim reverse geocode
    const hintName = React.useMemo(() => {
        if (!addressHint) return '';
        const parts = [addressHint.city, addressHint.state, addressHint.country].filter(Boolean);
        return parts.join(', ');
    }, [addressHint]);

    React.useEffect(() => {
        if (isSurfVariant) {
            // Prefer the transmitter's address hint over a generic beach name
            if (hintName) {
                setLocationName(hintName);
                return;
            }
            if (surfData?.beachName) {
                setLocationName(surfData.beachName);
                return;
            }
            setLocationName('');
            return;
        }

        // If we already have address data from the transmitter (Google Places), use it directly
        if (hintName) {
            setLocationName(hintName);
            return;
        }

        setLocationName('');
        if (!hasCoords) return;

        let cancelled = false;
        let controller: AbortController | null = null;

        const gKey = cellKey(lat as number, lng as number, GEOCODE_CELL_DEG, 'geo');

        const loadLocation = async () => {
            const cached = cacheGet(geocodeCache, gKey, GEOCODE_TTL_MS);
            if (cached !== null) {
                if (cancelled) return;
                setLocationName(cached);
                return;
            }
            controller?.abort();
            controller = new AbortController();
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
                    { signal: controller.signal },
                );
                if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                const address = data.address || {};
                const name =
                    address.city ||
                    address.town ||
                    address.village ||
                    address.county ||
                    address.state ||
                    data.display_name ||
                    'Unknown';
                cacheSet(geocodeCache, gKey, name);
                setLocationName(name);
            } catch (err: any) {
                if (cancelled || err?.name === 'AbortError') return;
                // Silently degrade — location name is non-critical for weather display
                console.warn('[Geocoding] Reverse geocode unavailable, falling back to coords');
                setLocationName('');
            }
        };

        loadLocation();
        return () => {
            cancelled = true;
            controller?.abort();
        };
    }, [hasCoords, hintName, isSurfVariant, lat, lng, surfData?.beachName]);

    const loading = isSurfVariant ? surfLoading : weatherLoading;
    const error = isSurfVariant ? surfError : weatherError;

    return {
        weatherData,
        surfData,
        locationName,
        error,
        loading,
        currentTime,
        hasCoords,
    };
};

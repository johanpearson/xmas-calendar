// Weather for Tomten's weather scenes: a forecast for the walk day decides whether he
// says the "good", "bad" or "unknown" lines. No DOM here; fetch, storage and the clock
// can be passed in, so everything is testable with `node --test`.
//
// The forecast source sits behind a small provider interface (see openMeteo below), so
// another source (e.g. SMHI) can replace it without touching the rest.

// --- Settings: easy to change ---

// Höör, Skåne. These coordinates are all that is ever sent to the forecast source.
export const LATITUDE = 55.94;
export const LONGITUDE = 13.54;
export const TIMEZONE = 'Europe/Stockholm';

// "bad" from these values and up (precipitation_sum in mm, wind_speed_10m_max in m/s).
export const BAD_PRECIPITATION_MM = 2;
export const BAD_WIND_MS = 10;

export const FETCH_TIMEOUT_MS = 4000;
// A cached forecast younger than this is used without asking the source again.
export const CACHE_FRESH_MS = 3 * 60 * 60 * 1000;
// When the source can't be reached, a cached forecast up to this old still counts.
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const WEATHER_VARIANTS = ['good', 'bad', 'unknown'];

const CACHE_KEY = 'advent.weather.cache';
const LAST_KEY = 'advent.weather.last';

// --- Providers ---
//
// A provider is { id, attribution, attributionUrl, fetchDay(dateKey, { fetch, signal }) }.
// fetchDay resolves to { precipitation, wind, temperature } for that local date
// (mm, m/s, °C; null where the source has no value) and rejects on any failure.

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export function openMeteoUrl(dateKey) {
  const params = new URLSearchParams({
    latitude: String(LATITUDE),
    longitude: String(LONGITUDE),
    daily: 'precipitation_sum,wind_speed_10m_max,temperature_2m_max',
    wind_speed_unit: 'ms',
    timezone: TIMEZONE,
    start_date: dateKey,
    end_date: dateKey,
  });
  return `${OPEN_METEO_URL}?${params}`;
}

const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// Picks the given date out of an Open-Meteo response. Throws when the date isn't in it.
export function parseOpenMeteo(json, dateKey) {
  if (!json || json.error) throw new Error(`Open-Meteo: ${json?.reason ?? 'no data'}`);
  const daily = json.daily;
  const index = Array.isArray(daily?.time) ? daily.time.indexOf(dateKey) : -1;
  if (index < 0) throw new Error(`Open-Meteo: no forecast for ${dateKey}`);
  return {
    precipitation: numberOrNull(daily.precipitation_sum?.[index]),
    wind: numberOrNull(daily.wind_speed_10m_max?.[index]),
    temperature: numberOrNull(daily.temperature_2m_max?.[index]),
  };
}

export const openMeteo = {
  id: 'open-meteo',
  attribution: 'Väderdata: Open-Meteo.com',
  attributionUrl: 'https://open-meteo.com/',
  async fetchDay(dateKey, { fetch, signal }) {
    // No cookies and no referrer: the request carries the coordinates and nothing else.
    const response = await fetch(openMeteoUrl(dateKey), {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
    return parseOpenMeteo(await response.json(), dateKey);
  },
};

// The source in use. To switch, write another provider with the same shape and point here.
export const provider = openMeteo;

// --- Classification ---

/**
 * "bad" when precipitation or wind reaches its limit, "good" when both are known and
 * below, otherwise "unknown". A single bad value is enough for "bad" even if the other
 * one is missing.
 */
export function classify(values) {
  const precipitation = numberOrNull(values?.precipitation);
  const wind = numberOrNull(values?.wind);
  if ((precipitation !== null && precipitation >= BAD_PRECIPITATION_MM) || (wind !== null && wind >= BAD_WIND_MS)) {
    return 'bad';
  }
  return precipitation !== null && wind !== null ? 'good' : 'unknown';
}

// The scene's last forecast date is the walk day, the one that decides.
export function walkDay(forecastForDates) {
  return Array.isArray(forecastForDates) && forecastForDates.length ? forecastForDates[forecastForDates.length - 1] : null;
}

// --- Cache (localStorage, one entry per date) ---

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readJson(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the forecast is simply fetched again next time.
  }
}

// The cached entry for a date from this provider: { fetchedAt, precipitation, wind, temperature }.
export function readCache(storage, dateKey, providerId = provider.id) {
  const entry = readJson(storage, CACHE_KEY)?.[dateKey];
  if (!entry || entry.source !== providerId || typeof entry.fetchedAt !== 'number') return null;
  return entry;
}

export function writeCache(storage, dateKey, values, fetchedAt, providerId = provider.id) {
  const all = readJson(storage, CACHE_KEY) ?? {};
  const entry = { source: providerId, fetchedAt, ...values };
  all[dateKey] = entry;
  writeJson(storage, CACHE_KEY, all);
  writeJson(storage, LAST_KEY, { date: dateKey, ...entry });
}

// The most recent successful fetch (for the dev panel), or null.
export function lastFetch(storage = defaultStorage()) {
  const last = readJson(storage, LAST_KEY);
  return last && typeof last.fetchedAt === 'number' ? last : null;
}

// --- Fetching ---

// Rejects after timeoutMs, aborting the request.
export async function fetchDayWithTimeout(dateKey, { source = provider, fetch = globalThis.fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  if (typeof fetch !== 'function') throw new Error('fetch is not available');
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([source.fetchDay(dateKey, { fetch, signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The forecast for one date, following the cache rules:
 *  1. a cached forecast younger than CACHE_FRESH_MS is used as is
 *  2. otherwise the source is asked (and the answer cached)
 *  3. if that fails, a cached forecast up to CACHE_MAX_AGE_MS old is used
 *  4. otherwise there is no forecast
 * Never throws. Resolves to { variant, values, fetchedAt, from: 'cache' | 'network' | 'stale' | 'none' }.
 */
export async function getForecast(dateKey, { source = provider, fetch, storage = defaultStorage(), now = Date.now, timeoutMs } = {}) {
  const none = { variant: 'unknown', values: null, fetchedAt: null, from: 'none' };
  if (!dateKey) return none;
  const result = (entry, from) => ({ variant: classify(entry), values: entry, fetchedAt: entry.fetchedAt, from });

  const cached = readCache(storage, dateKey, source.id);
  const age = (entry) => now() - entry.fetchedAt;
  if (cached && age(cached) >= 0 && age(cached) < CACHE_FRESH_MS) return result(cached, 'cache');

  try {
    const values = await fetchDayWithTimeout(dateKey, { source, fetch, timeoutMs });
    // Only usable answers are cached; a date without data may get one later.
    if (classify(values) !== 'unknown') {
      const fetchedAt = now();
      writeCache(storage, dateKey, values, fetchedAt, source.id);
      return result({ ...values, fetchedAt }, 'network');
    }
  } catch {
    // Network error, timeout, date out of range: fall back to the cache below.
  }
  if (cached && age(cached) >= 0 && age(cached) <= CACHE_MAX_AGE_MS) return result(cached, 'stale');
  return none;
}

/**
 * Dev: asks the source right away, ignoring the cache, and caches a usable answer (so it
 * shows as the last fetch). Never throws. Resolves to { ok: true, variant, values } or
 * { ok: false, error } with the reason, which only the dev panel shows.
 */
export async function testFetch(dateKey, { source = provider, fetch, storage = defaultStorage(), now = Date.now, timeoutMs } = {}) {
  try {
    const values = await fetchDayWithTimeout(dateKey, { source, fetch, timeoutMs });
    const variant = classify(values);
    if (variant !== 'unknown') writeCache(storage, dateKey, values, now(), source.id);
    return { ok: true, variant, values };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/**
 * Which weather lines a scene should use for its forecast dates: "good", "bad" or "unknown".
 * options.override (dev mode) wins when it is one of those; anything else, such as
 * "real" or null, means a real forecast. Other options go to getForecast().
 */
export async function getWeatherVariant(forecastForDates, { override = null, ...options } = {}) {
  if (WEATHER_VARIANTS.includes(override)) return override;
  return (await getForecast(walkDay(forecastForDates), options)).variant;
}

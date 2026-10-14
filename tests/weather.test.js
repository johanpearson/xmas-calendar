// Weather: classification, the Open-Meteo request and response, cache rules, timeout and
// error handling. fetch, storage and the clock are fakes; nothing goes over the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LATITUDE,
  LONGITUDE,
  BAD_PRECIPITATION_MM,
  BAD_WIND_MS,
  CACHE_FRESH_MS,
  CACHE_MAX_AGE_MS,
  classify,
  walkDay,
  openMeteo,
  openMeteoUrl,
  parseOpenMeteo,
  readCache,
  writeCache,
  lastFetch,
  fetchDayWithTimeout,
  getForecast,
  getWeatherVariant,
  testFetch,
} from '../js/weather.js';

const DAY = '2026-12-20';
const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-12-18T10:00:00+01:00');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// An Open-Meteo style answer for one day.
function openMeteoBody({ date = DAY, precipitation = 0.4, wind = 5.2, temperature = 1.5 } = {}) {
  return {
    latitude: 55.94,
    longitude: 13.54,
    daily_units: { time: 'iso8601', precipitation_sum: 'mm', wind_speed_10m_max: 'm/s', temperature_2m_max: '°C' },
    daily: { time: [date], precipitation_sum: [precipitation], wind_speed_10m_max: [wind], temperature_2m_max: [temperature] },
  };
}

// A fake fetch that answers with `body` (status 200 unless given) and records the calls.
function fakeFetch(body, { status = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fetch.calls = calls;
  return fetch;
}

const failingFetch = async () => {
  throw new TypeError('Failed to fetch');
};

// --- Classification ---

test('classify: precipitation just under and at the limit', () => {
  assert.equal(BAD_PRECIPITATION_MM, 2);
  assert.equal(classify({ precipitation: 1.99, wind: 3 }), 'good');
  assert.equal(classify({ precipitation: 2, wind: 3 }), 'bad');
  assert.equal(classify({ precipitation: 2.01, wind: 3 }), 'bad');
});

test('classify: wind just under and at the limit', () => {
  assert.equal(BAD_WIND_MS, 10);
  assert.equal(classify({ precipitation: 0, wind: 9.99 }), 'good');
  assert.equal(classify({ precipitation: 0, wind: 10 }), 'bad');
  assert.equal(classify({ precipitation: 0, wind: 10.01 }), 'bad');
});

test('classify: both under is good, either over is bad', () => {
  assert.equal(classify({ precipitation: 0, wind: 0 }), 'good');
  assert.equal(classify({ precipitation: 5, wind: 12 }), 'bad');
});

test('classify: missing data is unknown, unless the other value is already bad', () => {
  assert.equal(classify(null), 'unknown');
  assert.equal(classify({}), 'unknown');
  assert.equal(classify({ precipitation: null, wind: null }), 'unknown');
  assert.equal(classify({ precipitation: 0.5, wind: null }), 'unknown');
  assert.equal(classify({ precipitation: null, wind: 4 }), 'unknown');
  assert.equal(classify({ precipitation: NaN, wind: 4 }), 'unknown');
  assert.equal(classify({ precipitation: '1', wind: 4 }), 'unknown');
  assert.equal(classify({ precipitation: null, wind: 15 }), 'bad');
});

test('walkDay is the last forecast date', () => {
  assert.equal(walkDay(['2026-12-19', '2026-12-20']), '2026-12-20');
  assert.equal(walkDay(['2026-12-19']), '2026-12-19');
  assert.equal(walkDay([]), null);
  assert.equal(walkDay(undefined), null);
});

// --- Open-Meteo ---

test('the Open-Meteo request asks for Höör, one day, the three variables, m/s and Swedish time', () => {
  const url = new URL(openMeteoUrl(DAY));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    latitude: String(LATITUDE),
    longitude: String(LONGITUDE),
    daily: 'precipitation_sum,wind_speed_10m_max,temperature_2m_max',
    wind_speed_unit: 'ms',
    timezone: 'Europe/Stockholm',
    start_date: DAY,
    end_date: DAY,
  });
  assert.equal(LATITUDE, 55.94);
  assert.equal(LONGITUDE, 13.54);
});

test('the request sends no cookies and no referrer', async () => {
  const fetch = fakeFetch(openMeteoBody());
  await openMeteo.fetchDay(DAY, { fetch, signal: new AbortController().signal });
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].init.credentials, 'omit');
  assert.equal(fetch.calls[0].init.referrerPolicy, 'no-referrer');
  assert.ok(fetch.calls[0].init.signal);
});

test('parseOpenMeteo picks the date out of the response', () => {
  assert.deepEqual(parseOpenMeteo(openMeteoBody({ precipitation: 3.1, wind: 7, temperature: -2 }), DAY), {
    precipitation: 3.1,
    wind: 7,
    temperature: -2,
  });
});

test('parseOpenMeteo: missing values become null, a missing date or an error throws', () => {
  const body = openMeteoBody();
  body.daily.precipitation_sum = [null];
  delete body.daily.wind_speed_10m_max;
  assert.deepEqual(parseOpenMeteo(body, DAY), { precipitation: null, wind: null, temperature: 1.5 });
  assert.throws(() => parseOpenMeteo(openMeteoBody({ date: '2026-12-19' }), DAY));
  assert.throws(() => parseOpenMeteo({ daily: { time: [] } }, DAY));
  assert.throws(() => parseOpenMeteo({}, DAY));
  assert.throws(() => parseOpenMeteo(null, DAY));
  assert.throws(() => parseOpenMeteo({ error: true, reason: "Parameter 'start_date' is out of allowed range" }, DAY));
});

// --- Fetching: timeout and errors ---

test('fetchDayWithTimeout aborts and rejects after the timeout', async () => {
  let signal;
  const hanging = (url, init) => {
    signal = init.signal;
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  };
  await assert.rejects(fetchDayWithTimeout(DAY, { fetch: hanging, timeoutMs: 20 }), /timed out/);
  assert.equal(signal.aborted, true);
});

test('fetchDayWithTimeout also gives up on a fetch that ignores the abort', async () => {
  const deaf = () => new Promise(() => {});
  await assert.rejects(fetchDayWithTimeout(DAY, { fetch: deaf, timeoutMs: 20 }), /timed out/);
});

test('getForecast: a timeout gives "unknown"', async () => {
  const deaf = () => new Promise(() => {});
  const forecast = await getForecast(DAY, { fetch: deaf, timeoutMs: 20, storage: memoryStorage(), now: () => NOW });
  assert.equal(forecast.variant, 'unknown');
  assert.equal(forecast.from, 'none');
});

test('getForecast: HTTP errors, network errors, bad JSON and no fetch give "unknown"', async () => {
  const opts = { storage: memoryStorage(), now: () => NOW };
  const outOfRange = fakeFetch({ error: true, reason: "Parameter 'start_date' is out of allowed range" }, { status: 400 });
  assert.equal((await getForecast(DAY, { ...opts, fetch: outOfRange })).variant, 'unknown');
  assert.equal((await getForecast(DAY, { ...opts, fetch: fakeFetch({}, { status: 500 }) })).variant, 'unknown');
  assert.equal((await getForecast(DAY, { ...opts, fetch: failingFetch })).variant, 'unknown');
  const badJson = async () => ({ ok: true, status: 200, json: async () => JSON.parse('<html>') });
  assert.equal((await getForecast(DAY, { ...opts, fetch: badJson })).variant, 'unknown');
  assert.equal((await getForecast(DAY, { ...opts, fetch: null })).variant, 'unknown');
});

test('getForecast: an empty answer or missing values give "unknown" and are not cached', async () => {
  const storage = memoryStorage();
  const empty = fakeFetch({ daily: { time: [] } });
  assert.equal((await getForecast(DAY, { storage, now: () => NOW, fetch: empty })).variant, 'unknown');
  const nulls = fakeFetch(openMeteoBody({ precipitation: null, wind: null }));
  assert.equal((await getForecast(DAY, { storage, now: () => NOW, fetch: nulls })).variant, 'unknown');
  assert.equal(readCache(storage, DAY), null);
});

test('getForecast: no date means "unknown" without asking anyone', async () => {
  const fetch = fakeFetch(openMeteoBody());
  assert.equal((await getForecast(null, { fetch, storage: memoryStorage() })).variant, 'unknown');
  assert.equal(fetch.calls.length, 0);
});

// --- Cache rules ---

test('getForecast fetches, classifies and caches with a timestamp', async () => {
  const storage = memoryStorage();
  const fetch = fakeFetch(openMeteoBody({ precipitation: 2.5, wind: 4 }));
  const forecast = await getForecast(DAY, { fetch, storage, now: () => NOW });
  assert.equal(forecast.variant, 'bad');
  assert.equal(forecast.from, 'network');
  assert.equal(forecast.fetchedAt, NOW);
  assert.deepEqual(readCache(storage, DAY), { source: 'open-meteo', fetchedAt: NOW, precipitation: 2.5, wind: 4, temperature: 1.5 });
  assert.deepEqual(lastFetch(storage), { date: DAY, source: 'open-meteo', fetchedAt: NOW, precipitation: 2.5, wind: 4, temperature: 1.5 });
});

test('cache: a fresh entry (under 3 hours) is used without fetching', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  const fetch = fakeFetch(openMeteoBody({ precipitation: 9 }));
  const forecast = await getForecast(DAY, { fetch, storage, now: () => NOW + CACHE_FRESH_MS - 1 });
  assert.equal(forecast.variant, 'good');
  assert.equal(forecast.from, 'cache');
  assert.equal(fetch.calls.length, 0);
});

test('cache: an entry 3 hours old is refreshed from the network', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  const fetch = fakeFetch(openMeteoBody({ precipitation: 9 }));
  const later = NOW + CACHE_FRESH_MS;
  const forecast = await getForecast(DAY, { fetch, storage, now: () => later });
  assert.equal(forecast.variant, 'bad');
  assert.equal(forecast.from, 'network');
  assert.equal(fetch.calls.length, 1);
  assert.equal(readCache(storage, DAY).fetchedAt, later);
});

test('cache: an old entry (under 24 hours) is used when the network fails', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 12, temperature: 2 }, NOW);
  const forecast = await getForecast(DAY, { fetch: failingFetch, storage, now: () => NOW + CACHE_MAX_AGE_MS });
  assert.equal(forecast.variant, 'bad');
  assert.equal(forecast.from, 'stale');
  assert.equal(forecast.fetchedAt, NOW);
});

test('cache: an old entry is also used when the source has no data or times out', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  const now = () => NOW + 5 * HOUR;
  const empty = fakeFetch({ daily: { time: [] } });
  assert.equal((await getForecast(DAY, { fetch: empty, storage, now })).from, 'stale');
  const deaf = () => new Promise(() => {});
  assert.equal((await getForecast(DAY, { fetch: deaf, timeoutMs: 20, storage, now })).variant, 'good');
});

test('cache: an entry over 24 hours old is not used, even when the network fails', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  const forecast = await getForecast(DAY, { fetch: failingFetch, storage, now: () => NOW + CACHE_MAX_AGE_MS + 1 });
  assert.equal(forecast.variant, 'unknown');
  assert.equal(forecast.from, 'none');
});

test('cache: entries are per date and per source', async () => {
  const storage = memoryStorage();
  writeCache(storage, '2026-12-19', { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW, 'smhi');
  assert.equal(readCache(storage, DAY), null);
  assert.equal((await getForecast(DAY, { fetch: failingFetch, storage, now: () => NOW })).variant, 'unknown');
  assert.equal((await getForecast('2026-12-19', { fetch: failingFetch, storage, now: () => NOW })).variant, 'good');
});

test('cache: broken or unavailable storage is ignored', async () => {
  const broken = memoryStorage({ 'advent.weather.cache': '{nope', 'advent.weather.last': '[1]' });
  assert.equal(readCache(broken, DAY), null);
  assert.equal(lastFetch(broken), null);
  const throwing = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const forecast = await getForecast(DAY, { fetch: fakeFetch(openMeteoBody()), storage: throwing, now: () => NOW });
  assert.equal(forecast.variant, 'good');
  assert.equal((await getForecast(DAY, { fetch: failingFetch, storage: null, now: () => NOW })).variant, 'unknown');
});

// --- getWeatherVariant ---

test('getWeatherVariant uses the walk day (the last forecast date)', async () => {
  const fetch = fakeFetch(openMeteoBody({ date: DAY, wind: 11 }));
  const variant = await getWeatherVariant(['2026-12-19', DAY], { fetch, storage: memoryStorage(), now: () => NOW });
  assert.equal(variant, 'bad');
  assert.equal(new URL(fetch.calls[0].url).searchParams.get('start_date'), DAY);
});

test('getWeatherVariant: the dev override wins, "real" asks the source', async () => {
  const fetch = fakeFetch(openMeteoBody());
  const opts = { fetch, storage: memoryStorage(), now: () => NOW };
  assert.equal(await getWeatherVariant([DAY], { ...opts, override: 'bad' }), 'bad');
  assert.equal(await getWeatherVariant([DAY], { ...opts, override: 'unknown' }), 'unknown');
  assert.equal(fetch.calls.length, 0);
  assert.equal(await getWeatherVariant([DAY], { ...opts, override: 'real' }), 'good');
  assert.equal(await getWeatherVariant([], { ...opts, override: null }), 'unknown');
});

// --- testFetch (dev) ---

test('testFetch asks the source even with a fresh cache, and caches a usable answer', async () => {
  const storage = memoryStorage();
  writeCache(storage, DAY, { precipitation: 0, wind: 3, temperature: 2 }, NOW);
  const fetch = fakeFetch(openMeteoBody({ precipitation: 4, wind: 3 }));
  const result = await testFetch(DAY, { fetch, storage, now: () => NOW + 1000 });
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(result, { ok: true, variant: 'bad', values: { precipitation: 4, wind: 3, temperature: 1.5 } });
  assert.equal(readCache(storage, DAY).fetchedAt, NOW + 1000);
  assert.equal(lastFetch(storage).precipitation, 4);
});

test('testFetch reports why a fetch failed, without throwing', async () => {
  const storage = memoryStorage();
  const outOfRange = fakeFetch({ error: true, reason: 'out of range' }, { status: 400 });
  assert.deepEqual(await testFetch(DAY, { fetch: outOfRange, storage }), { ok: false, error: 'Open-Meteo: HTTP 400' });
  const result = await testFetch(DAY, { fetch: failingFetch, storage });
  assert.equal(result.ok, false);
  assert.match(result.error, /Failed to fetch/);
  const empty = await testFetch(DAY, { fetch: fakeFetch(openMeteoBody({ precipitation: null, wind: null })), storage });
  assert.equal(empty.variant, 'unknown');
  assert.equal(lastFetch(storage), null, 'nothing usable, nothing cached');
});

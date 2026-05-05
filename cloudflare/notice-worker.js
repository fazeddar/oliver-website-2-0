const NOTICE_KEY = 'global-notice';
const POLL_KEY = 'site-poll-v1';
const POLL_CONFIG_KEY = 'site-poll-config-v1';
const POLL_VOTED_PREFIX = 'poll-voted:';
const VISITOR_PRESENCE_PREFIX = 'presence:';
const POPULAR_APPS_KEY_PREFIX = 'popular-apps:';
const MAINTENANCE_KEY = 'maintenance';
const TICKER_KEY = 'ticker';
const FEATURED_GAME_KEY = 'featured-game';
const ACTIVE_VISITOR_TTL_SECONDS = 120;
const DEFAULT_POLL_QUESTION = "What's your fav tool?";
const DEFAULT_POLL_OPTIONS = ['TuffTerminal', 'WebConsole', 'pr0xy', 'Apps'];

function buildCorsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

function jsonResponse(data, status = 200, origin = '*') {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...buildCorsHeaders(origin),
        },
    });
}

function parseJsonSafely(raw, fallback) {
    if (!raw || typeof raw !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function normalizeVisitorId(input) {
    const safeValue = String(input || '').trim();
    if (!safeValue) {
        return crypto.randomUUID();
    }
    return safeValue.slice(0, 120);
}

function normalizeAppName(input) {
    return String(input || '').trim().slice(0, 80);
}

function getWeekStartKey(date = new Date()) {
    const value = new Date(date);
    const day = value.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    value.setUTCHours(0, 0, 0, 0);
    value.setUTCDate(value.getUTCDate() - diffToMonday);
    return value.toISOString().slice(0, 10);
}

function getPopularAppsKey(weekKey = getWeekStartKey()) {
    return `${POPULAR_APPS_KEY_PREFIX}${weekKey}`;
}

async function readPopularApps(env, weekKey = getWeekStartKey()) {
    const key = getPopularAppsKey(weekKey);
    const raw = await env.NOTICE_STORE.get(key);
    const parsed = parseJsonSafely(raw, null);

    if (!parsed || typeof parsed !== 'object' || typeof parsed.counts !== 'object' || !parsed.counts) {
        return {
            weekKey,
            counts: {},
            updatedAt: null,
        };
    }

    return {
        weekKey,
        counts: parsed.counts,
        updatedAt: parsed.updatedAt || null,
    };
}

async function writePopularApps(env, payload) {
    const key = getPopularAppsKey(payload.weekKey || getWeekStartKey());
    await env.NOTICE_STORE.put(key, JSON.stringify(payload));
}

async function readPoll(env) {
    const config = await readPollConfig(env);
    const raw = await env.NOTICE_STORE.get(POLL_KEY);
    const parsed = parseJsonSafely(raw, null);

    if (!parsed || !Array.isArray(parsed.votes) || parsed.votes.length !== config.options.length) {
        return {
            question: config.question,
            options: config.options,
            votes: config.options.map(() => 0),
            updatedAt: null,
        };
    }

    return {
        question: config.question,
        options: config.options,
        votes: parsed.votes.map(value => Math.max(0, Number(value) || 0)),
        updatedAt: parsed.updatedAt || null,
    };
}

async function writePoll(env, poll) {
    await env.NOTICE_STORE.put(POLL_KEY, JSON.stringify(poll));
}

async function countActiveVisitors(env) {
    let cursor;
    let total = 0;

    do {
        const page = await env.NOTICE_STORE.list({
            prefix: VISITOR_PRESENCE_PREFIX,
            cursor,
            limit: 1000,
        });
        total += page.keys.length;
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    return total;
}

async function readPollConfig(env) {
    const raw = await env.NOTICE_STORE.get(POLL_CONFIG_KEY);
    const parsed = parseJsonSafely(raw, null);
    if (!parsed || !Array.isArray(parsed.options) || parsed.options.length < 2) {
        return { question: DEFAULT_POLL_QUESTION, options: DEFAULT_POLL_OPTIONS };
    }
    return {
        question: String(parsed.question || DEFAULT_POLL_QUESTION).slice(0, 120),
        options: parsed.options.map(o => String(o).slice(0, 60)).slice(0, 8),
    };
}

async function readMaintenance(env) {
    const raw = await env.NOTICE_STORE.get(MAINTENANCE_KEY);
    const parsed = parseJsonSafely(raw, null);
    if (!parsed) return { active: false, message: '', updatedAt: null };
    return {
        active: Boolean(parsed.active),
        message: String(parsed.message || '').slice(0, 280),
        updatedAt: parsed.updatedAt || null,
    };
}

async function readTicker(env) {
    const raw = await env.NOTICE_STORE.get(TICKER_KEY);
    const parsed = parseJsonSafely(raw, null);
    if (!parsed) return { active: false, message: '', updatedAt: null };
    return {
        active: Boolean(parsed.active),
        message: String(parsed.message || '').slice(0, 200),
        updatedAt: parsed.updatedAt || null,
    };
}

async function readFeaturedGame(env) {
    const raw = await env.NOTICE_STORE.get(FEATURED_GAME_KEY);
    const parsed = parseJsonSafely(raw, null);
    if (!parsed || !parsed.name) return { name: '', updatedAt: null };
    return {
        name: String(parsed.name).slice(0, 80),
        updatedAt: parsed.updatedAt || null,
    };
}

async function readNotice(env) {
    const raw = await env.NOTICE_STORE.get(NOTICE_KEY, 'json');
    if (!raw) {
        return {
            active: false,
            message: '',
            updatedAt: null,
        };
    }
    return raw;
}

async function requirePassword(request, env) {
    if (!env.ADMIN_PASSWORD) {
        return {
            ok: false,
            response: jsonResponse({ error: 'ADMIN_PASSWORD secret is missing.' }, 500, request.headers.get('Origin')),
        };
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return {
            ok: false,
            response: jsonResponse({ error: 'Invalid JSON body.' }, 400, request.headers.get('Origin')),
        };
    }

    if (!body?.password || body.password !== env.ADMIN_PASSWORD) {
        return {
            ok: false,
            response: jsonResponse({ error: 'Invalid password.' }, 401, request.headers.get('Origin')),
        };
    }

    return {
        ok: true,
        body,
    };
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '*';
        const url = new URL(request.url);
        const path = url.pathname;

        const validPath = path === '/' || path === '/api/global-notice' || path === '/api/site-stats' || path === '/api/site-poll' || path === '/api/popular-apps' || path === '/api/maintenance' || path === '/api/ticker' || path === '/api/featured-game';

        if (!validPath) {
            return jsonResponse({ error: 'Not found.' }, 404, origin);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: buildCorsHeaders(origin),
            });
        }

        if (request.method === 'GET') {
            if (path === '/' || path === '/api/global-notice') {
                return jsonResponse(await readNotice(env), 200, origin);
            }

            if (path === '/api/site-stats') {
                const activeVisitors = await countActiveVisitors(env);
                return jsonResponse({
                    activeVisitors,
                    updatedAt: new Date().toISOString(),
                }, 200, origin);
            }

            if (path === '/api/site-poll') {
                const visitorId = normalizeVisitorId(url.searchParams.get('visitorId'));
                const votedKey = `${POLL_VOTED_PREFIX}${visitorId}`;
                const hasVoted = Boolean(await env.NOTICE_STORE.get(votedKey));
                const poll = await readPoll(env);
                const totalVotes = poll.votes.reduce((sum, value) => sum + value, 0);

                return jsonResponse({
                    question: poll.question,
                    options: poll.options,
                    votes: poll.votes,
                    totalVotes,
                    voted: hasVoted,
                    updatedAt: poll.updatedAt,
                }, 200, origin);
            }

            if (path === '/api/popular-apps') {
                const payload = await readPopularApps(env);
                const apps = Object.entries(payload.counts)
                    .map(([name, launches]) => ({
                        name,
                        launches: Math.max(0, Number(launches) || 0),
                    }))
                    .sort((a, b) => b.launches - a.launches || a.name.localeCompare(b.name))
                    .slice(0, 12);

                return jsonResponse({
                    weekKey: payload.weekKey,
                    apps,
                    updatedAt: payload.updatedAt,
                }, 200, origin);
            }

            if (path === '/api/maintenance') {
                return jsonResponse(await readMaintenance(env), 200, origin);
            }

            if (path === '/api/ticker') {
                return jsonResponse(await readTicker(env), 200, origin);
            }

            if (path === '/api/featured-game') {
                return jsonResponse(await readFeaturedGame(env), 200, origin);
            }
        }

        if (request.method === 'PUT') {
            if (path === '/api/site-poll') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                const question = String(auth.body.question || DEFAULT_POLL_QUESTION).trim().slice(0, 120);
                const rawOptions = auth.body.options;
                if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
                    return jsonResponse({ error: 'options must be an array of at least 2 strings.' }, 400, origin);
                }
                const options = rawOptions.map(o => String(o).trim().slice(0, 60)).filter(Boolean);
                if (options.length < 2) {
                    return jsonResponse({ error: 'Need at least 2 non-empty options.' }, 400, origin);
                }

                const config = { question, options, updatedAt: new Date().toISOString() };
                await env.NOTICE_STORE.put(POLL_CONFIG_KEY, JSON.stringify(config));
                // Reset votes and clear all voted keys so everyone can vote again
                await env.NOTICE_STORE.put(POLL_KEY, JSON.stringify({ votes: options.map(() => 0), updatedAt: new Date().toISOString() }));
                let cursor;
                do {
                    const page = await env.NOTICE_STORE.list({ prefix: POLL_VOTED_PREFIX, cursor, limit: 1000 });
                    await Promise.all(page.keys.map(k => env.NOTICE_STORE.delete(k.name)));
                    cursor = page.list_complete ? undefined : page.cursor;
                } while (cursor);
                return jsonResponse({ ...config, votesReset: true }, 200, origin);
            }

            if (path !== '/' && path !== '/api/global-notice') {
                return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
            }

            const auth = await requirePassword(request, env);
            if (!auth.ok) {
                return auth.response;
            }

            return jsonResponse({ ok: true }, 200, origin);
        }

        if (request.method === 'POST') {
            if (path === '/api/site-stats') {
                let body = {};
                try {
                    body = await request.json();
                } catch {
                    body = {};
                }

                const visitorId = normalizeVisitorId(body.visitorId);
                const visitorKey = `${VISITOR_PRESENCE_PREFIX}${visitorId}`;

                await env.NOTICE_STORE.put(visitorKey, String(Date.now()), {
                    expirationTtl: ACTIVE_VISITOR_TTL_SECONDS,
                });

                const activeVisitors = await countActiveVisitors(env);
                return jsonResponse({
                    visitorId,
                    activeVisitors,
                    updatedAt: new Date().toISOString(),
                }, 200, origin);
            }

            if (path === '/api/site-poll') {
                let body;
                try {
                    body = await request.json();
                } catch {
                    return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin);
                }

                const option = Number(body?.option);
                const poll = await readPoll(env);
                if (!Number.isInteger(option) || option < 0 || option >= poll.options.length) {
                    return jsonResponse({ error: 'Invalid poll option.' }, 400, origin);
                }

                const visitorId = normalizeVisitorId(body?.visitorId);
                const votedKey = `${POLL_VOTED_PREFIX}${visitorId}`;
                const alreadyVoted = Boolean(await env.NOTICE_STORE.get(votedKey));

                if (!alreadyVoted) {
                    poll.votes[option] += 1;
                    poll.updatedAt = new Date().toISOString();
                    await writePoll(env, poll);
                    await env.NOTICE_STORE.put(votedKey, '1', {
                        expirationTtl: 60 * 60 * 24 * 365,
                    });
                }

                const totalVotes = poll.votes.reduce((sum, value) => sum + value, 0);
                return jsonResponse({
                    question: poll.question,
                    options: poll.options,
                    votes: poll.votes,
                    totalVotes,
                    voted: true,
                    updatedAt: poll.updatedAt,
                }, 200, origin);
            }

            if (path === '/api/maintenance') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                const active = Boolean(auth.body.active);
                const message = String(auth.body.message || '').trim().slice(0, 280);
                const maintenance = { active, message, updatedAt: new Date().toISOString() };
                await env.NOTICE_STORE.put(MAINTENANCE_KEY, JSON.stringify(maintenance));
                return jsonResponse(maintenance, 200, origin);
            }

            if (path === '/api/ticker') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                const active = Boolean(auth.body.active !== false);
                const message = String(auth.body.message || '').trim().slice(0, 200);
                if (!message) return jsonResponse({ error: 'Message cannot be empty.' }, 400, origin);
                const ticker = { active, message, updatedAt: new Date().toISOString() };
                await env.NOTICE_STORE.put(TICKER_KEY, JSON.stringify(ticker));
                return jsonResponse(ticker, 200, origin);
            }

            if (path === '/api/featured-game') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                const name = normalizeAppName(auth.body.name || '');
                if (!name) return jsonResponse({ error: 'name is required.' }, 400, origin);
                const featured = { name, updatedAt: new Date().toISOString() };
                await env.NOTICE_STORE.put(FEATURED_GAME_KEY, JSON.stringify(featured));
                return jsonResponse(featured, 200, origin);
            }

            if (path === '/api/popular-apps') {
                let body;
                try {
                    body = await request.json();
                } catch {
                    return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin);
                }

                const appName = normalizeAppName(body?.appName);
                if (!appName) {
                    return jsonResponse({ error: 'appName is required.' }, 400, origin);
                }

                const payload = await readPopularApps(env);
                payload.counts[appName] = (Number(payload.counts[appName]) || 0) + 1;
                payload.updatedAt = new Date().toISOString();
                await writePopularApps(env, payload);

                const apps = Object.entries(payload.counts)
                    .map(([name, launches]) => ({
                        name,
                        launches: Math.max(0, Number(launches) || 0),
                    }))
                    .sort((a, b) => b.launches - a.launches || a.name.localeCompare(b.name))
                    .slice(0, 12);

                return jsonResponse({
                    weekKey: payload.weekKey,
                    apps,
                    updatedAt: payload.updatedAt,
                }, 200, origin);
            }

            if (path !== '/' && path !== '/api/global-notice') {
                return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
            }

            const auth = await requirePassword(request, env);
            if (!auth.ok) {
                return auth.response;
            }

            const message = String(auth.body.message || '').trim().slice(0, 280);
            if (!message) {
                return jsonResponse({ error: 'Message cannot be empty.' }, 400, origin);
            }

            const notice = {
                active: true,
                message,
                updatedAt: new Date().toISOString(),
            };

            await env.NOTICE_STORE.put(NOTICE_KEY, JSON.stringify(notice));
            return jsonResponse(notice, 200, origin);
        }

        if (request.method === 'DELETE') {
            if (path === '/api/popular-apps') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) {
                    return auth.response;
                }

                const weekKey = getWeekStartKey();
                const key = getPopularAppsKey(weekKey);
                await env.NOTICE_STORE.put(key, JSON.stringify({ weekKey, counts: {}, updatedAt: new Date().toISOString() }));

                return jsonResponse({ weekKey, apps: [], reset: true, updatedAt: new Date().toISOString() }, 200, origin);
            }

            if (path === '/api/site-poll') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                const config = await readPollConfig(env);
                await env.NOTICE_STORE.put(POLL_KEY, JSON.stringify({ votes: config.options.map(() => 0), updatedAt: new Date().toISOString() }));

                // Clear all voted keys so everyone can vote again
                let cursor;
                let deleted = 0;
                do {
                    const page = await env.NOTICE_STORE.list({ prefix: POLL_VOTED_PREFIX, cursor, limit: 1000 });
                    await Promise.all(page.keys.map(k => env.NOTICE_STORE.delete(k.name)));
                    deleted += page.keys.length;
                    cursor = page.list_complete ? undefined : page.cursor;
                } while (cursor);

                return jsonResponse({ reset: true, votesCleared: deleted, updatedAt: new Date().toISOString() }, 200, origin);
            }

            if (path === '/api/site-stats') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                let cursor;
                let deleted = 0;
                do {
                    const page = await env.NOTICE_STORE.list({ prefix: VISITOR_PRESENCE_PREFIX, cursor, limit: 1000 });
                    await Promise.all(page.keys.map(k => env.NOTICE_STORE.delete(k.name)));
                    deleted += page.keys.length;
                    cursor = page.list_complete ? undefined : page.cursor;
                } while (cursor);

                return jsonResponse({ deleted, updatedAt: new Date().toISOString() }, 200, origin);
            }

            if (path === '/api/ticker') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                await env.NOTICE_STORE.put(TICKER_KEY, JSON.stringify({ active: false, message: '', updatedAt: new Date().toISOString() }));
                return jsonResponse({ active: false, message: '', updatedAt: new Date().toISOString() }, 200, origin);
            }

            if (path === '/api/featured-game') {
                const auth = await requirePassword(request, env);
                if (!auth.ok) return auth.response;

                await env.NOTICE_STORE.delete(FEATURED_GAME_KEY);
                return jsonResponse({ name: '', cleared: true, updatedAt: new Date().toISOString() }, 200, origin);
            }

            if (path !== '/' && path !== '/api/global-notice') {
                return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
            }

            const auth = await requirePassword(request, env);
            if (!auth.ok) {
                return auth.response;
            }

            const cleared = {
                active: false,
                message: '',
                updatedAt: new Date().toISOString(),
            };

            await env.NOTICE_STORE.put(NOTICE_KEY, JSON.stringify(cleared));
            return jsonResponse(cleared, 200, origin);
        }

        return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
    },
};
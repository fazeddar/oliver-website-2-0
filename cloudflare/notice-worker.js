const NOTICE_KEY = 'global-notice';
const POLL_KEY = 'site-poll-v1';
const POLL_VOTED_PREFIX = 'poll-voted:';
const VISITOR_PRESENCE_PREFIX = 'presence:';
const POPULAR_APPS_KEY_PREFIX = 'popular-apps:';
const ACTIVE_VISITOR_TTL_SECONDS = 120;
const POLL_OPTIONS = ['TuffTerminal', 'WebConsole', 'pr0xy', 'Games'];

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
    const raw = await env.NOTICE_STORE.get(POLL_KEY);
    const parsed = parseJsonSafely(raw, null);

    if (!parsed || !Array.isArray(parsed.votes) || parsed.votes.length !== POLL_OPTIONS.length) {
        return {
            options: POLL_OPTIONS,
            votes: POLL_OPTIONS.map(() => 0),
            updatedAt: null,
        };
    }

    return {
        options: POLL_OPTIONS,
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

        const validPath = path === '/' || path === '/api/global-notice' || path === '/api/site-stats' || path === '/api/site-poll' || path === '/api/popular-apps';

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
        }

        if (request.method === 'PUT') {
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
                if (!Number.isInteger(option) || option < 0 || option >= POLL_OPTIONS.length) {
                    return jsonResponse({ error: 'Invalid poll option.' }, 400, origin);
                }

                const visitorId = normalizeVisitorId(body?.visitorId);
                const votedKey = `${POLL_VOTED_PREFIX}${visitorId}`;
                const alreadyVoted = Boolean(await env.NOTICE_STORE.get(votedKey));
                const poll = await readPoll(env);

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
                    options: poll.options,
                    votes: poll.votes,
                    totalVotes,
                    voted: true,
                    updatedAt: poll.updatedAt,
                }, 200, origin);
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
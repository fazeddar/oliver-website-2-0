const NOTICE_KEY = 'global-notice';

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
        const validPath = url.pathname === '/' || url.pathname === '/api/global-notice';

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
            return jsonResponse(await readNotice(env), 200, origin);
        }

        if (request.method === 'PUT') {
            const auth = await requirePassword(request, env);
            if (!auth.ok) {
                return auth.response;
            }

            return jsonResponse({ ok: true }, 200, origin);
        }

        if (request.method === 'POST') {
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
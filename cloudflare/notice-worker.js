export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://oliverstools.bigguy8014.workers.dev',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.addEventListener('message', event => {
        console.log('Received:', event.data);
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    // Handle POST /api/site-stats
    const url = new URL(request.url);
    if (url.pathname === '/api/site-stats' && request.method === 'POST') {
      try {
        const data = await request.json();
        console.log('Site stats:', data);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        return new Response('Invalid JSON', {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // Not found
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};   
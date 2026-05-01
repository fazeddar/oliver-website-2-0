const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://oliverstools.bigguy8014.workers.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    try {
      // Handle WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        const url = new URL(request.url);
        const roomId = url.pathname.slice(1) || 'default';
        
        // Create WebSocket pair
        const [client, server] = Object.values(new WebSocketPair());
        
        // Accept server-side WebSocket
        server.accept();

        // Store WebSocket in Durable Object or handle here
        // For now, just echo messages back
        server.addEventListener('message', event => {
          console.log('Received:', event.data);
          // Broadcast logic would go here
        });

        // Return 101 Switching Protocols response
        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Handle POST /api/site-stats
      const url = new URL(request.url);
      if (url.pathname === '/api/site-stats' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        console.log('Received site stats:', data);

        // Simulate processing
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Not found
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};   
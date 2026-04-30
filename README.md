# Arch Linux Web App

This project is a simple web application inspired by the sleek design of Arch Linux. It features transparent windows and a minimalist aesthetic, providing a modern user experience.

## Proxy Setup (Website Deployment)

To make the proxy work on a real website, host the Ultraviolet backend and this frontend over HTTP or HTTPS.

1. Put the Ultraviolet app behind the same domain as your site, ideally at `/uv/`.
2. Keep WebSocket upgrades enabled for `/wisp/`.
3. Serve your main `index.html` from the same domain.

The frontend auto-resolves proxy URLs this way:

- `localhost` development: `http://localhost:8080/`
- deployed domain: `https://your-domain/uv/`

Optional override in `index.html` before loading `script.js`:

```html
<script>
	window.PROXY_APP_URL = 'https://your-proxy-domain.example/';
</script>
```

Note: `file://` cannot run this proxy flow because service workers require HTTP/HTTPS.
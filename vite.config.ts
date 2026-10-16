import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Dev only: feeds don't send CORS headers for localhost, so the dev page
// fetches them through this. The built extension uses host permissions.
const rssProxy = (): Plugin => ({
  name: 'rss-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/rss-proxy', async (req, res) => {
      const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
      if (!target || !/^https?:\/\//.test(target)) {
        res.statusCode = 400
        res.end('Missing or invalid url')
        return
      }
      try {
        const upstream = await fetch(target, { headers: { 'user-agent': 'DevFeed (dev)' } })
        res.statusCode = upstream.status
        res.setHeader('content-type', upstream.headers.get('content-type') ?? 'text/xml')
        res.end(Buffer.from(await upstream.arrayBuffer()))
      } catch (e) {
        res.statusCode = 502
        res.end(String(e))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), rssProxy()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // The dev page is on localhost, where the browser won't send daily.dev's
      // cookies. Forwards the cookie pasted into the Connect prompt (the
      // X-Daily-Cookie header) as the real Cookie header.
      '/daily-graphql': {
        target: 'https://api.daily.dev/graphql',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/daily-graphql/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers['x-daily-cookie']
            if (typeof cookie === 'string' && cookie) proxyReq.setHeader('cookie', cookie)
          })
        },
      },
    },
  },
})

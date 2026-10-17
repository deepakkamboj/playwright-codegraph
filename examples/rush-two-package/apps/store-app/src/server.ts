import { createServer } from 'node:http';

import { buildCheckoutSummary } from './pricing.js';

const host = '127.0.0.1';
const port = 3100;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (url.pathname === '/checkout') {
    try {
      const summary = buildCheckoutSummary(
        url.searchParams.get('sku') ?? '',
        Number(url.searchParams.get('price')),
        Number(url.searchParams.get('quantity')),
      );
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(summary));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }
  response.writeHead(404);
  response.end();
});

server.listen(port, host, () => {
  console.log(`Store example listening at http://${host}:${port}`);
});

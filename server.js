const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DATA_TABLES = new Set([
  'settings',
  'subjects',
  'courses',
  'sections',
  'classwork',
  'teachers',
  'students',
  'grades',
  'log'
]);
const PUBLIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
const MAX_BODY_BYTES = 1024 * 1024;
const projectDirectory = __dirname;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

try {
  if (new URL(SUPABASE_URL).protocol !== 'https:') {
    throw new Error('SUPABASE_URL must use HTTPS.');
  }
} catch (error) {
  console.error(`Invalid SUPABASE_URL: ${error.message}`);
  process.exit(1);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let exceededLimit = false;

    request.on('data', chunk => {
      if (exceededLimit) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        exceededLimit = true;
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (exceededLimit) return;
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

async function supabaseRequest(tableName, method, body) {
  const endpoint = new URL(`/rest/v1/${encodeURIComponent(tableName)}`, SUPABASE_URL);
  if (method === 'POST') endpoint.searchParams.set('on_conflict', 'id');

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  if (!response.ok) {
    const details = await response.text();
    throw Object.assign(new Error(`Supabase request failed (${response.status}): ${details}`), {
      statusCode: response.status >= 400 && response.status < 500 ? response.status : 502
    });
  }

  if (method === 'GET') return response.json();
  return null;
}

async function handleApiRequest(request, response, url) {
  const match = url.pathname.match(/^\/api\/tables\/([a-z]+)(?:\/([^/]+))?$/);
  if (!match) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }

  const [, tableName, recordId] = match;
  if (!DATA_TABLES.has(tableName)) {
    sendJson(response, 404, { error: 'Unknown data table.' });
    return;
  }

  if (request.method === 'GET' && !recordId) {
    const data = await supabaseRequest(tableName, 'GET');
    sendJson(response, 200, data);
    return;
  }

  if (request.method === 'PUT' && recordId) {
    const data = await readJsonBody(request);
    let decodedId;
    try {
      decodedId = decodeURIComponent(recordId);
    } catch {
      sendJson(response, 400, { error: 'Invalid record ID.' });
      return;
    }
    if (!decodedId || decodedId.length > 200) {
      sendJson(response, 400, { error: 'Invalid record ID.' });
      return;
    }

    await supabaseRequest(tableName, 'POST', [{
      id: decodedId,
      data,
      updated_at: new Date().toISOString()
    }]);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, url);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    const publicFile = PUBLIC_FILES.get(url.pathname);
    if (!publicFile) {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }

    const [fileName, contentType] = publicFile;
    const filePath = path.join(projectDirectory, fileName);
    const content = await fs.promises.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    const statusCode = error.statusCode || 502;
    if (statusCode >= 500) console.error(error);
    sendJson(response, statusCode, { error: error.message || 'Request failed.' });
  }
});

server.listen(PORT, () => {
  console.log(`GradeFlow server listening on http://localhost:${PORT}`);
});

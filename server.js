const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TRANSCRIPTS_DIR = path.join(ROOT, 'transcripts');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function loadMetadata() {
  try {
    return JSON.parse(await fs.readFile(path.join(PUBLIC_DIR, 'papers.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function listTranscripts() {
  const discovered = [];
  const summaries = [];
  const metadata = await loadMetadata();
  async function scan(directory, relativeDirectory = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return scan(path.join(directory, entry.name), relativePath);
      if (!entry.isFile()) return;
      const folders = relativeDirectory.split('/').filter(Boolean);
      if (entry.name.toLowerCase().endsWith('.srt')) {
        discovered.push({ path: relativePath, name: entry.name, format: 'srt', day: folders[0] || 'Uncategorized', session: folders[1] || 'Unscheduled' });
      }
      const summaryMatch = entry.name.match(/^(.*)_AI(\d+)\.json$/i);
      if (summaryMatch) summaries.push({ path: relativePath, base: summaryMatch[1], number: Number(summaryMatch[2]) });
      if (entry.name.toLowerCase().endsWith('.json') && !summaryMatch) {
        discovered.push({ path: relativePath, name: entry.name, format: 'json', day: folders[0] || 'Uncategorized', session: folders[1] || 'Unscheduled' });
      }
    }));
  }
  await scan(TRANSCRIPTS_DIR);
  discovered.forEach((transcript) => {
    const directory = path.posix.dirname(transcript.path);
    const base = path.posix.basename(transcript.name, path.posix.extname(transcript.name));
    transcript.summaries = summaries
      .filter((summary) => path.posix.dirname(summary.path) === directory && summary.base.toLowerCase() === base.toLowerCase())
      .sort((a, b) => a.number - b.number)
      .map((summary) => ({ path: summary.path, label: `AI${summary.number}` }));
    transcript.metadata = metadata.find((item) =>
      normalizeKey(item.id) === normalizeKey(base) &&
      normalizeKey(`day${item.day}`) === normalizeKey(transcript.day) &&
      normalizeKey(item.session) === normalizeKey(transcript.session)
    ) || null;
  });
  return discovered.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/transcripts') {
      return send(res, 200, JSON.stringify({ files: await listTranscripts() }), contentTypes['.json']);
    }

    if (url.pathname.startsWith('/api/transcripts/')) {
      const requested = decodeURIComponent(url.pathname.slice('/api/transcripts/'.length));
      const files = await listTranscripts();
      if (!files.some((file) => file.path === requested)) return send(res, 404, 'Transcript not found');
      const file = files.find((item) => item.path === requested);
      const body = await fs.readFile(path.join(TRANSCRIPTS_DIR, requested), 'utf8');
      return send(res, 200, body, file.format === 'json' ? contentTypes['.json'] : 'application/x-subrip; charset=utf-8');
    }

    if (url.pathname.startsWith('/api/summaries/')) {
      const requested = decodeURIComponent(url.pathname.slice('/api/summaries/'.length));
      const files = await listTranscripts();
      const allowed = files.some((file) => file.summaries.some((summary) => summary.path === requested));
      if (!allowed) return send(res, 404, 'Summary not found');
      const body = await fs.readFile(path.join(TRANSCRIPTS_DIR, requested), 'utf8');
      return send(res, 200, body, contentTypes['.json']);
    }

    const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const resolved = path.resolve(PUBLIC_DIR, requestedPath);
    if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== PUBLIC_DIR) {
      return send(res, 403, 'Forbidden');
    }

    const body = await fs.readFile(resolved);
    send(res, 200, body, contentTypes[path.extname(resolved)] || 'application/octet-stream');
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, 'Not found');
    console.error(error);
    send(res, 500, 'Something went wrong');
  }
});

server.listen(PORT, () => {
  console.log(`Transcript Studio is ready at http://localhost:${PORT}`);
});

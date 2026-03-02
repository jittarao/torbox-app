import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { spawn } from 'child_process';
import { getChapterCache, setChapterCache } from '@/app/api/lib/audiobook-cache';
import { getFfprobePath } from '@/app/api/lib/ffprobe-bootstrap';

const FFPROBE_TIMEOUT_MS = 60000;

/** Classify ffprobe failure for API response. */
function classifyExtractionError(message) {
  const msg = (message || '').trim();
  if (/timed out/i.test(msg)) {
    return {
      code: 'TIMEOUT',
      error: 'Chapter extraction timed out; the file may be too large or the URL too slow.',
      hint: 'Try again or use a faster CDN. Timeout is 60s.',
    };
  }
  if (/401|403|forbidden|unauthorized|expired/i.test(msg) || /Invalid data/i.test(msg)) {
    return {
      code: 'ACCESS_DENIED',
      error: 'Chapter extraction failed: link may have expired or file is not accessible.',
      hint: 'Debrid and time-limited URLs often require cookies or headers that ffprobe cannot send. Use a publicly reachable URL or a proxy that adds auth.',
    };
  }
  if (/Invalid ffprobe output|parse error/i.test(msg)) {
    return {
      code: 'INVALID_OUTPUT',
      error: 'Chapter extraction failed: ffprobe returned invalid data.',
      hint: 'The URL might point to an HTML error page instead of an audio file.',
    };
  }
  if (/ENOENT|not found|no such file/i.test(msg)) {
    return {
      code: 'FFPROBE_NOT_FOUND',
      error: 'Chapter extraction failed: ffprobe could not be run.',
      hint: 'Set FFPROBE_PATH or allow auto-download. See DEPLOYMENT.md.',
    };
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|getaddrinfo/i.test(msg)) {
    return {
      code: 'NETWORK_ERROR',
      error: 'Chapter extraction failed: server could not reach the URL.',
      hint: 'Check that the URL is reachable from this server (DNS, firewall, VPN).',
    };
  }
  return {
    code: 'EXTRACTION_FAILED',
    error: msg.length > 300 ? msg.slice(0, 297) + '...' : msg || 'Chapter extraction failed.',
    hint: 'Check that the URL returns an audio file (e.g. .m4a, .m4b) and is reachable without auth from this server.',
  };
}

/**
 * POST /api/audiobook/chapters
 * Body: { id: string, file_id: string, url: string } — cache key is id+file_id; url is the stream/CDN URL.
 * Requires x-api-key header. URL must be HTTP or HTTPS (self-hosted setups often use localhost or private URLs).
 */
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = body.id != null ? String(body.id) : '';
  const fileId = body.file_id != null ? String(body.file_id) : '';
  const cdnUrl = typeof body.url === 'string' ? body.url.trim() : '';

  if (!id || !fileId) {
    return NextResponse.json(
      { success: false, error: 'id and file_id are required' },
      { status: 400 }
    );
  }
  if (!cdnUrl || !cdnUrl.startsWith('http://') && !cdnUrl.startsWith('https://')) {
    return NextResponse.json(
      { success: false, error: 'url must be a valid HTTP(s) URL' },
      { status: 400 }
    );
  }

  try {
    new URL(cdnUrl);
  } catch {
    return NextResponse.json(
      { success: false, error: 'url must be a valid HTTP(s) URL' },
      { status: 400 }
    );
  }

  const cached = await getChapterCache(id, fileId);
  if (cached) {
    return NextResponse.json({ chapters: cached, cached: true });
  }

  let ffprobePath;
  try {
    ffprobePath = await getFfprobePath();
  } catch (err) {
    console.error('Audiobook chapters: ffprobe bootstrap failed', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Chapter extraction unavailable: ' + (err.message || 'ffprobe failed'),
        code: 'FFPROBE_UNAVAILABLE',
        hint: 'Set FFPROBE_PATH to your ffprobe binary or allow auto-download. See DEPLOYMENT.md.',
        details: err.message || undefined,
      },
      { status: 503 }
    );
  }

  const result = await new Promise((resolve, reject) => {
    const proc = spawn(
      ffprobePath,
      ['-v', 'error', '-print_format', 'json', '-show_chapters', cdnUrl],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffprobe timed out'));
    }, FFPROBE_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        try {
          const json = JSON.parse(stdout);
          const chapters = (json.chapters || []).map((ch) => {
            const start = ch.start_time != null ? Number(ch.start_time) : 0;
            const title =
              ch.tags && typeof ch.tags.title === 'string'
                ? ch.tags.title
                : ch.title || `Chapter ${ch.id != null ? ch.id + 1 : ''}`.trim();
            return { title, startSeconds: start };
          });
          resolve(chapters);
        } catch (e) {
          reject(new Error('Invalid ffprobe output: ' + (e.message || 'parse error')));
        }
      } else {
        reject(new Error(stderr || `ffprobe exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  }).catch((err) => ({ rawMessage: err.message || 'Chapter extraction failed' }));

  if (result && result.rawMessage) {
    const msg = result.rawMessage;
    const { code, error, hint } = classifyExtractionError(msg);
    if (code !== 'TIMEOUT') {
      console.error('Audiobook chapters: ffprobe error', { id, fileId, code, message: msg });
    }
    const status =
      code === 'ACCESS_DENIED' ? 401 : code === 'FFPROBE_NOT_FOUND' ? 503 : 500;
    return NextResponse.json(
      {
        success: false,
        error,
        code,
        hint,
        details: msg.length <= 500 ? msg : msg.slice(0, 497) + '...',
      },
      { status }
    );
  }

  const chapters = Array.isArray(result) ? result : [];
  await setChapterCache(id, fileId, chapters);
  return NextResponse.json({ chapters });
}

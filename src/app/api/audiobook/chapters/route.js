import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getChapterCache, setChapterCache } from '@/app/api/lib/audiobook-cache';
import { getFfprobePath } from '@/app/api/lib/ffprobe-bootstrap';

const FFPROBE_TIMEOUT_MS = 60000;

/**
 * POST /api/audiobook/chapters
 * Body: { id: string, file_id: string, url: string } — cache key is id+file_id; url is the TorBox CDN URL.
 */
export async function POST(request) {
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
  if (!cdnUrl || !cdnUrl.startsWith('http')) {
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
      },
      { status: 500 }
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
  }).catch((err) => ({ error: err.message || 'Chapter extraction failed' }));

  if (result && result.error) {
    const msg = result.error;
    const isExpired =
      /401|403|expired|forbidden|unauthorized/i.test(msg) || /Invalid data/i.test(msg);
    return NextResponse.json(
      {
        success: false,
        error: isExpired
          ? 'Chapter extraction failed: link may have expired or file is not accessible'
          : 'Chapter extraction failed: ' + msg,
      },
      { status: isExpired ? 401 : 500 }
    );
  }

  const chapters = Array.isArray(result) ? result : [];
  await setChapterCache(id, fileId, chapters);
  return NextResponse.json({ chapters });
}

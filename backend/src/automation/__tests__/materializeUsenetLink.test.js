import { describe, expect, test } from 'bun:test';
import { materializeUsenetLinkUpload } from '../materializeUsenetLink.js';

const NZB_BODY = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?>\n<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb"></nzb>'
);
const LINK = 'https://api.nzbgeek.info/api?t=get&id=123456789&apikey=qwertyuiop';

function fakeDb() {
  const calls = [];
  return {
    calls,
    db: {
      prepare: (sql) => ({
        run: (...args) => {
          calls.push({ sql, args });
        },
      }),
    },
  };
}

describe('materializeUsenetLinkUpload', () => {
  test('stores the NZB under the content-disposition name and drops the API key', async () => {
    const userDb = fakeDb();
    const quota = [];
    const fetchNzbLink = async () => ({
      finalUrl: 'https://cdn.example/dl/api',
      contentDisposition: 'attachment; filename="Movie.Name.2024.nzb"',
      contentType: 'application/x-nzb',
      body: NZB_BODY,
    });

    const result = await materializeUsenetLinkUpload(
      {
        id: 7,
        authId: 'user-1',
        type: 'usenet',
        upload_type: 'link',
        url: LINK,
        name: 'httpsapi',
      },
      userDb,
      {
        fetchNzbLink,
        saveUploadFile: async (_authId, body, filename) => {
          expect(filename).toBe('Movie.Name.2024.nzb');
          expect(body).toBe(NZB_BODY);
          return { relativePath: 'user_user-1/usenet/Movie.Name.2024.nzb', sizeBytes: body.length };
        },
        adjustQuotaCounters: (...args) => quota.push(args),
        logger: { warn() {} },
      }
    );

    expect(result.upload_type).toBe('file');
    expect(result.name).toBe('Movie.Name.2024');
    expect(result.nzbFilename).toBe('Movie.Name.2024.nzb');
    expect(result.file_path).toBe('user_user-1/usenet/Movie.Name.2024.nzb');
    expect(result.name).not.toContain('qwertyuiop');
    expect(result.nzbFilename).not.toContain('qwertyuiop');
    expect(result.name).not.toBe('httpsapi');
    expect(quota).toEqual([['user-1', 1, NZB_BODY.length]]);
    expect(userDb.calls[0].args[1]).toBe('Movie.Name.2024');
  });

  test('keeps a real title when the prefetch fails and still strips a URL name', async () => {
    const userDb = fakeDb();
    const titled = await materializeUsenetLinkUpload(
      {
        id: 8,
        authId: 'user-1',
        type: 'usenet',
        upload_type: 'link',
        url: LINK,
        name: 'Real Release Title',
      },
      userDb,
      {
        fetchNzbLink: async () => {
          throw new Error('indexer down');
        },
        logger: { warn() {} },
      }
    );

    expect(titled.upload_type).toBe('link');
    expect(titled.name).toBe('Real Release Title');
    expect(userDb.calls).toHaveLength(0);

    const leaked = await materializeUsenetLinkUpload(
      {
        id: 9,
        authId: 'user-1',
        type: 'usenet',
        upload_type: 'link',
        url: LINK,
        name: `${LINK.substring(0, 60)}...`,
      },
      userDb,
      {
        fetchNzbLink: async () => {
          throw new Error('indexer down');
        },
        logger: { warn() {} },
      }
    );

    expect(leaked.upload_type).toBe('link');
    expect(leaked.name).not.toContain('qwertyuiop');
    expect(leaked.name).not.toBe('httpsapi');
    expect(leaked.name).toMatch(/^nzb-[0-9a-f]{8}$/);
  });
});

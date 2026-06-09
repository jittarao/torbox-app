import { describe, expect, test } from 'bun:test';
import {
  getUploadResourceId,
  hasUploadResourcePayload,
  isTorboxDuplicateUploadResponse,
  isTorboxOutageResponse,
  isTorboxTransientQueuedResponse,
  isTorboxUploadApiFailure,
  isTorboxUploadApiSuccess,
} from '../uploadResponseValidation.js';

/** Documented createtorrent success (prompts/torbox-api.md) */
const CREATE_TORRENT_SUCCESS = {
  success: true,
  error: null,
  detail: 'Torrent Added Successfully',
  data: {
    hash: 'abc123',
    torrent_id: 42,
    auth_id: 'user-auth',
  },
};

/** Documented asynccreatetorrent success — TorBox may return data:null even for createtorrent */
const ASYNC_CREATE_TORRENT_SUCCESS = {
  success: true,
  error: null,
  detail:
    'Torrent creation request has been queued. You will receive a notification when it is processed.',
  data: null,
};

describe('uploadResponseValidation', () => {
  describe('getUploadResourceId / hasUploadResourcePayload', () => {
    test('torrent: uses torrent_id from API docs', () => {
      expect(getUploadResourceId(CREATE_TORRENT_SUCCESS.data, 'torrent')).toBe(42);
      expect(hasUploadResourcePayload(CREATE_TORRENT_SUCCESS.data, 'torrent')).toBe(true);
    });

    test('torrent: accepts torrent_id 0 (documented placeholder)', () => {
      expect(getUploadResourceId({ torrent_id: 0, hash: 'x' }, 'torrent')).toBe(0);
    });

    test('torrent: hash-only object is not enough without torrent_id', () => {
      expect(hasUploadResourcePayload({ hash: 'only-hash', auth_id: 'a' }, 'torrent')).toBe(false);
    });

    test('usenet: prefers usenet_id then id', () => {
      expect(getUploadResourceId({ usenet_id: 9 }, 'usenet')).toBe(9);
      expect(hasUploadResourcePayload({ id: 5 }, 'usenet')).toBe(true);
    });

    test('webdl: prefers webdownload_id then webdl_id then web_id then id', () => {
      expect(getUploadResourceId({ webdownload_id: 1133079 }, 'webdl')).toBe(1133079);
      expect(getUploadResourceId({ webdl_id: 3 }, 'webdl')).toBe(3);
      expect(getUploadResourceId({ web_id: 8 }, 'webdl')).toBe(8);
      expect(hasUploadResourcePayload({ id: 2 }, 'webdl')).toBe(true);
    });

    test('webdl: accepts real TorBox createwebdownload response', () => {
      expect(
        isTorboxUploadApiSuccess(
          {
            data: {
              success: true,
              detail: 'Kemono download started. Please wait for the download to complete.',
              error: null,
              data: {
                hash: '995c705662605fe10080182f86da9346',
                webdownload_id: 1133079,
                auth_id: 'e9e162c0-4b5c-4d91-82fa-4f08890b0435',
                link_list: ['https://coomer.st/onlyfans/user/jodie_johnson/post/1006337470'],
              },
            },
          },
          'webdl'
        )
      ).toBe(true);
    });

    test('rejects empty or missing payload', () => {
      expect(hasUploadResourcePayload(null, 'torrent')).toBe(false);
      expect(hasUploadResourcePayload({}, 'torrent')).toBe(false);
      expect(hasUploadResourcePayload([], 'torrent')).toBe(false);
    });
  });

  describe('isTorboxUploadApiSuccess', () => {
    test('accepts documented createtorrent envelope', () => {
      expect(
        isTorboxUploadApiSuccess({ data: CREATE_TORRENT_SUCCESS }, 'torrent')
      ).toBe(true);
    });

    test('accepts asynccreatetorrent-style success with data null', () => {
      expect(
        isTorboxUploadApiSuccess({ data: ASYNC_CREATE_TORRENT_SUCCESS }, 'torrent')
      ).toBe(true);
    });

    test('rejects explicit API failure envelope', () => {
      expect(
        isTorboxUploadApiSuccess(
          {
            data: {
              success: false,
              error: 'ACTIVE_LIMIT',
              detail: 'Active download limit reached',
              data: null,
            },
          },
          'torrent'
        )
      ).toBe(false);
    });

    test('accepts success:true without resource id (TorBox queued response)', () => {
      expect(
        isTorboxUploadApiSuccess(
          {
            data: { success: true, error: null, detail: 'Torrent queued successfully', data: null },
          },
          'torrent'
        )
      ).toBe(true);
    });

    test('rejects empty object, string, and missing body (old bug)', () => {
      expect(isTorboxUploadApiSuccess({ data: {} }, 'torrent')).toBe(false);
      expect(isTorboxUploadApiSuccess({ data: '' }, 'torrent')).toBe(false);
      expect(isTorboxUploadApiSuccess({ data: '<html>error</html>' }, 'torrent')).toBe(false);
      expect(isTorboxUploadApiSuccess({}, 'torrent')).toBe(false);
      expect(isTorboxUploadApiSuccess({ data: null }, 'torrent')).toBe(false);
    });

    test('rejects success omitted with error string field only', () => {
      expect(
        isTorboxUploadApiSuccess(
          {
            data: { error: 'AUTH_ERROR', detail: 'There was an error verifying your API key.' },
          },
          'torrent'
        )
      ).toBe(false);
    });
  });

  describe('isTorboxUploadApiFailure', () => {
    test('is negation of success check', () => {
      const ok = { data: CREATE_TORRENT_SUCCESS };
      const bad = { data: { success: false, error: 'AUTH_ERROR', data: null } };
      expect(isTorboxUploadApiFailure(ok, 'torrent')).toBe(false);
      expect(isTorboxUploadApiFailure(bad, 'torrent')).toBe(true);
    });
  });

  describe('isTorboxOutageResponse', () => {
    test('detects empty or non-object bodies', () => {
      expect(isTorboxOutageResponse({ data: null })).toBe(true);
      expect(isTorboxOutageResponse({ data: {} })).toBe(true);
      expect(isTorboxOutageResponse({ data: '<html>error</html>' })).toBe(true);
    });

    test('rejects real TorBox error envelopes', () => {
      expect(
        isTorboxOutageResponse({
          data: {
            success: false,
            error: 'ACTIVE_LIMIT',
            detail: 'Active download limit reached',
          },
        })
      ).toBe(false);
    });
  });

  describe('isTorboxDuplicateUploadResponse', () => {
    test('detects DUPLICATE_ITEM', () => {
      expect(
        isTorboxDuplicateUploadResponse({
          data: {
            success: false,
            error: 'DUPLICATE_ITEM',
            detail: 'This item already exists.',
          },
        })
      ).toBe(true);
    });

    test('detects already queued detail', () => {
      expect(
        isTorboxDuplicateUploadResponse({
          data: {
            success: false,
            error: 'SOME_CODE',
            detail: 'Download already queued.',
          },
        })
      ).toBe(true);
    });

    test('rejects unrelated failures', () => {
      expect(
        isTorboxDuplicateUploadResponse({
          data: {
            success: false,
            error: 'ACTIVE_LIMIT',
            detail: 'Active download limit reached',
          },
        })
      ).toBe(false);
    });
  });

  describe('isTorboxTransientQueuedResponse', () => {
    test('detects success:false with detail "Torrent Queued Successfully"', () => {
      expect(
        isTorboxTransientQueuedResponse({
          data: {
            success: false,
            error: null,
            detail: 'Torrent Queued Successfully',
            data: { upload_id: 2185, status: 'queued', queue_order: 2 },
          },
        })
      ).toBe(true);
    });

    test('detects lowercase variant', () => {
      expect(
        isTorboxTransientQueuedResponse({
          data: {
            success: false,
            error: null,
            detail: 'torrent queued successfully',
            data: null,
          },
        })
      ).toBe(true);
    });

    test('rejects success:true (legitimate queued response)', () => {
      expect(
        isTorboxTransientQueuedResponse({
          data: {
            success: true,
            error: null,
            detail: 'Torrent Queued Successfully',
            data: null,
          },
        })
      ).toBe(false);
    });

    test('rejects success:false without queued detail (real failures)', () => {
      expect(
        isTorboxTransientQueuedResponse({
          data: {
            success: false,
            error: 'ACTIVE_LIMIT',
            detail: 'Active download limit reached',
            data: null,
          },
        })
      ).toBe(false);
    });

    test('rejects success:false with duplicate/error detail', () => {
      expect(
        isTorboxTransientQueuedResponse({
          data: {
            success: false,
            error: 'DUPLICATE_ITEM',
            detail: 'This item already exists.',
          },
        })
      ).toBe(false);
    });

    test('rejects null/undefined responses', () => {
      expect(isTorboxTransientQueuedResponse({ data: null })).toBe(false);
      expect(isTorboxTransientQueuedResponse({ data: undefined })).toBe(false);
      expect(isTorboxTransientQueuedResponse({ data: {} })).toBe(false);
      expect(isTorboxTransientQueuedResponse({})).toBe(false);
    });
  });
});

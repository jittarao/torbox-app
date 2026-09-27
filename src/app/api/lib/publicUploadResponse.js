export function toPublicUploadResponse(upload) {
  const isCompleted = upload.status === 'completed';
  const data = {
    upload_id: upload.id,
    status: upload.status,
    queue_order: upload.queue_order ?? null,
    hash: isCompleted ? (upload.torbox_hash ?? null) : null,
    torrent_id: isCompleted ? (upload.torbox_torrent_id ?? null) : null,
    auth_id: isCompleted ? (upload.torbox_auth_id ?? null) : null,
  };

  if (upload.status === 'failed') {
    data.error_message = upload.error_message ?? null;
  }

  // Stable batch identity (additive): zero-based request position and name echo.
  // Single-status rows do not carry `index`, so it is omitted for them.
  if (upload.index !== undefined && upload.index !== null) {
    data.index = upload.index;
  }

  if (upload.name !== undefined && upload.name !== null) {
    data.name = upload.name;
  }

  return {
    success: true,
    error: null,
    detail:
      upload.status === 'completed'
        ? 'Torrent Created Successfully'
        : upload.status === 'failed'
          ? 'Torrent Upload Failed'
          : 'Torrent Queued Successfully',
    data,
  };
}

export function toPublicUploadError(error, status = 400, detail = null) {
  return Response.json(
    {
      success: false,
      error,
      ...(detail ? { detail } : {}),
    },
    { status }
  );
}

/** @returns {boolean} */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** @returns {Element | null} */
export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

/**
 * @param {Element} element
 * @returns {Promise<void>}
 */
export async function requestFullscreen(element) {
  if (!element) return;

  const el = /** @type {Element & { webkitRequestFullscreen?: () => Promise<void> }} */ (element);

  if (el.requestFullscreen) {
    await el.requestFullscreen({ navigationUI: 'hide' });
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
    return;
  }
  if (el.mozRequestFullScreen) {
    await el.mozRequestFullScreen();
    return;
  }
  if (el.msRequestFullscreen) {
    await el.msRequestFullscreen();
  }
}

/**
 * @param {HTMLVideoElement} video
 * @returns {Promise<void>}
 */
export async function requestVideoFullscreen(video) {
  if (!video) return;

  if (typeof video.webkitEnterFullscreen === 'function') {
    video.webkitEnterFullscreen();
    return;
  }
  if (typeof video.webkitSetPresentationMode === 'function') {
    video.webkitSetPresentationMode('fullscreen');
    return;
  }
  await requestFullscreen(video);
}

/** @returns {Promise<void>} */
export async function exitFullscreen() {
  if (typeof document === 'undefined') return;

  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (document.webkitExitFullscreen) {
    await document.webkitExitFullscreen();
    return;
  }
  if (document.mozCancelFullScreen) {
    await document.mozCancelFullScreen();
    return;
  }
  if (document.msExitFullscreen) {
    await document.msExitFullscreen();
  }
}

/**
 * @param {HTMLVideoElement | null} video
 * @returns {Promise<void>}
 */
export async function exitVideoFullscreen(video) {
  if (video && typeof video.webkitExitFullscreen === 'function') {
    try {
      video.webkitExitFullscreen();
    } catch {
      // ignore
    }
  }
  if (getFullscreenElement()) {
    await exitFullscreen();
  }
}

/** @returns {boolean} */
export function isFullscreenActive() {
  return Boolean(getFullscreenElement());
}

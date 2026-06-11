// SharedWorker for accurate background timer timing.
// Not subject to Chrome's background tab setTimeout clamping (~60s minimum after 5 min).
// Maintains accurate intervals regardless of page visibility.

const timers = new Map();

self.onconnect = (e) => {
  const port = e.ports[0];

  const clear = () => {
    const id = timers.get(port);
    if (id != null) {
      clearTimeout(id);
      timers.delete(port);
    }
  };

  port.onmessage = (event) => {
    const msg = event.data;

    if (msg.type === 'start') {
      clear();
      const id = setTimeout(() => {
        timers.delete(port);
        try {
          port.postMessage({ type: 'tick' });
        } catch {
          // Port closed
        }
      }, msg.intervalMs);
      timers.set(port, id);
    } else if (msg.type === 'stop') {
      clear();
    }
  };

  port.addEventListener('close', () => {
    clear();
  });
};

import { Window } from 'happy-dom';

const window = new Window({ url: 'https://localhost/' });

const matchMediaMock = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});
window.matchMedia = matchMediaMock;
globalThis.matchMedia = matchMediaMock;

globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.DOMException = window.DOMException;

for (const name of [
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'EvalError',
  'URIError',
]) {
  if (window[name] === undefined && globalThis[name]) {
    window[name] = globalThis[name];
  }
}

import { Window } from 'happy-dom';

const window = new Window({ url: 'https://localhost/' });

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

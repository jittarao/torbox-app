export const saEvent = (eventName) => {
  if(process.env.NODE_ENV !== 'production') return;
  if (window && window.sa_event) return window.sa_event(eventName);
};

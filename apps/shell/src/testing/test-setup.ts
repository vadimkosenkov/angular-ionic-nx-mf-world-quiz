// jsdom does not implement matchMedia; Ionic and the settings library use it.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom does not implement element scrolling; scrollable ion-segment calls it.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => undefined;
}

// Polyfill to prevent "TypeError: Cannot set property fetch of #<Window> which has only a getter"
// in restricted iframe environments where window.fetch is a getter-only property on Window or WindowProperties
(function ensureWritableFetch() {
  if (typeof window === 'undefined') return;
  try {
    let target: any = window;
    let desc = Object.getOwnPropertyDescriptor(target, 'fetch');
    if (!desc) {
      target = Object.getPrototypeOf(window);
      desc = Object.getOwnPropertyDescriptor(target, 'fetch');
    }
    if (desc && !desc.writable && !desc.set) {
      let currentFetch = window.fetch;
      Object.defineProperty(window, 'fetch', {
        get() {
          return currentFetch;
        },
        set(newFetch) {
          currentFetch = newFetch;
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch {
    // Ignore if not permitted
  }
})();

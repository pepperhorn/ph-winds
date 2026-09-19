import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement Element.scrollTo (only a no-op window.scrollTo);
// PianoKeyboard scrolls its container to the selected key, so stub it here
// rather than defensively guarding real browser code.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

afterEach(() => {
  cleanup();
});

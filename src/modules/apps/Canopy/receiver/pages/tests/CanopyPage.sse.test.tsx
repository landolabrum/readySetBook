// Placeholder test suite for Canopy overlay SSE/network behaviour.
// Future work: wire up Jest/RTL and assert that only one SSE connection
// is created per event and that overlay/roster refreshes are debounced.

import type { ReactElement } from 'react';

// NOTE: Jest/RTL are not currently configured in this repo. This file
// exists as a scaffold so that when a test runner is added, concrete
// tests can be implemented without hunting for the right location.

describe('CanopyPage SSE integration (scaffold)', () => {
    it('tracks overlays via the shared SSE pool (pending implementation)', () => {
        // TODO: when test tooling is added, mount <CanopyPage /> with a
        // mocked CanopyProvider + getOverlayStream, then assert that:
        // - getOverlayStream is called once per (eventId,url)
        // - no direct EventSource instances are constructed by the page
        // - overlay/roster refresh handlers respect debouncing.
        expect(true).toBe(true);
    });
});

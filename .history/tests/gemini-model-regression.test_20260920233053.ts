import assert from 'node:assert/strict';
import test from 'node:test';

import { GEMINI_TEXT_MODEL } from '../src/services/conversation-engine';
import { GEMINI_LIVE_MODEL } from '../src/services/voice-engine';

test('uses supported Gemini model names for standard and live requests', () => {
  assert.equal(GEMINI_TEXT_MODEL, 'gemini-3.6-flash');
  assert.equal(GEMINI_LIVE_MODEL, 'gemini-live-2.5-flash-preview');
});

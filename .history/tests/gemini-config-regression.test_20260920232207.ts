import assert from 'node:assert/strict';
import test from 'node:test';

import { isConfiguredGeminiApiKey } from '../src/services/conversation-engine';

test('gemini key validator rejects placeholder values and accepts real keys', () => {
  assert.equal(isConfiguredGeminiApiKey('PASTE_YOUR_GEMINI_API_KEY'), false);
  assert.equal(isConfiguredGeminiApiKey('MY_GEMINI_API_KEY'), false);
  assert.equal(isConfiguredGeminiApiKey('abc123def456ghi789jkl012mno345'), true);
  assert.equal(isConfiguredGeminiApiKey(''), false);
});

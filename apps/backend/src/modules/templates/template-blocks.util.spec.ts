import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTemplateBlocks } from './template-blocks.util';

test('normalizes valid blocks and drops invalid entries', () => {
  const blocks = normalizeTemplateBlocks([
    { id: 'a', type: 'text', content: 'hello' },
    { id: 'b', type: 'image', imageUrl: '/img.png', altText: 'img' },
    { id: 'c', type: 'button', href: 'https://example.com', content: 'Go' },
    { id: 'd', type: 'divider' },
    { id: 'e', type: 'spacer' },
    { id: '', type: 'text', content: 'invalid' },
    { id: 'f', type: 'image' },
    { id: 'g', type: 'button', content: 'missing href' },
    { id: 'h', type: 'unknown' },
  ]);

  assert.deepEqual(blocks, [
    { id: 'a', type: 'text', content: 'hello' },
    { id: 'b', type: 'image', imageUrl: '/img.png', altText: 'img' },
    { id: 'c', type: 'button', href: 'https://example.com', content: 'Go' },
    { id: 'd', type: 'divider' },
    { id: 'e', type: 'spacer' },
  ]);
});

test('returns empty array when explicit blocks is an empty array', () => {
  const blocks = normalizeTemplateBlocks([], '[{"id":"a","type":"text","content":"from-fallback"}]');

  assert.deepEqual(blocks, []);
});

test('falls back to persisted JSON when blocks is undefined', () => {
  const blocks = normalizeTemplateBlocks(undefined, '[{"id":"a","type":"text","content":"from-fallback"}]');

  assert.deepEqual(blocks, [{ id: 'a', type: 'text', content: 'from-fallback' }]);
});

test('returns empty array for malformed fallback JSON', () => {
  const blocks = normalizeTemplateBlocks(undefined, 'not-json');

  assert.deepEqual(blocks, []);
});

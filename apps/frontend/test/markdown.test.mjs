// Run: node --test apps/frontend/test/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInline, parseMarkdown } from '../markdown.js';

const text = t => ({ type: 'text', text: t });

test('bold, italic, inline code and links', () => {
  assert.deepEqual(parseInline('Es sind **52 Rollen** von `MCP-WH-004`, *ca.* [Doku](https://example.com/a)'), [
    text('Es sind '),
    { type: 'strong', children: [text('52 Rollen')] },
    text(' von '),
    { type: 'code', text: 'MCP-WH-004' },
    text(', '),
    { type: 'em', children: [text('ca.')] },
    text(' '),
    { type: 'link', href: 'https://example.com/a', children: [text('Doku')] },
  ]);
});

test('nested formatting inside bold', () => {
  assert.deepEqual(parseInline('**Artikel `A-1`**'), [
    { type: 'strong', children: [text('Artikel '), { type: 'code', text: 'A-1' }] },
  ]);
});

test('bold inside italic', () => {
  assert.deepEqual(parseInline('*Gesamt: **52** Stück*'), [
    { type: 'em', children: [text('Gesamt: '), { type: 'strong', children: [text('52')] }, text(' Stück')] },
  ]);
});

test('underscores (tool names) and unsafe links stay plain text', () => {
  assert.deepEqual(parseInline('erpnext__get_product_inventory'), [text('erpnext__get_product_inventory')]);
  assert.deepEqual(parseInline('[x](javascript:alert(1))'), [text('[x](javascript:alert(1))')]);
  assert.deepEqual(parseInline('2 * 3 * 4'), [text('2 * 3 * 4')]);
});

test('HTML is kept as text, never as markup', () => {
  assert.deepEqual(parseInline('<img src=x onerror=alert(1)>'), [text('<img src=x onerror=alert(1)>')]);
});

test('paragraphs with line breaks, headings and lists', () => {
  const blocks = parseMarkdown('## Bestand\n\nZeile 1\nZeile 2\n\n- **A**: 5\n- B: 7\n\n1. erst\n2. dann');
  assert.deepEqual(blocks, [
    { type: 'heading', level: 2, children: [text('Bestand')] },
    { type: 'paragraph', lines: [[text('Zeile 1')], [text('Zeile 2')]] },
    { type: 'list', ordered: false, items: [[{ type: 'strong', children: [text('A')] }, text(': 5')], [text('B: 7')]] },
    { type: 'list', ordered: true, items: [[text('erst')], [text('dann')]] },
  ]);
});

test('fenced code blocks keep their content unformatted', () => {
  assert.deepEqual(parseMarkdown('Vorher\n```json\n{ "a": **1** }\n```\nNachher'), [
    { type: 'paragraph', lines: [[text('Vorher')]] },
    { type: 'codeblock', text: '{ "a": **1** }' },
    { type: 'paragraph', lines: [[text('Nachher')]] },
  ]);
});

test('tables', () => {
  assert.deepEqual(parseMarkdown('| Lager | Menge |\n|---|---:|\n| Lagerräume - MCP | **52** |'), [{
    type: 'table',
    header: [[text('Lager')], [text('Menge')]],
    rows: [[[text('Lagerräume - MCP')], [{ type: 'strong', children: [text('52')] }]]],
  }]);
});

test('Windows line endings and empty input', () => {
  assert.deepEqual(parseMarkdown('a\r\nb'), [{ type: 'paragraph', lines: [[text('a')], [text('b')]] }]);
  assert.deepEqual(parseMarkdown(''), []);
});

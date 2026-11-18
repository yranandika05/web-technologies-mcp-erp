// Small Markdown renderer for the chat answers – no dependency, no build step.
// Supports what LLMs typically write: paragraphs, headings, lists, tables, code blocks,
// **bold**, *italic*, `code` and [links](https://…).
//
// Safety: the model's text is never parsed as HTML. parseMarkdown() builds a small tree and
// renderMarkdown() turns it into DOM nodes with textContent, so "<script>" stays plain text.
// Only http(s) links are turned into links.

const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const INLINE = /`([^`\n]+)`|\*\*(?=\S)(.+?)(?<=\S)\*\*|\*(?=\S)((?:\*\*[^*\n]+\*\*|[^*\n])+?)(?<=\S)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Parses inline formatting into [{ type: 'text' | 'strong' | 'em' | 'code' | 'link', … }]. */
export function parseInline(source) {
  const nodes = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    if (match.index > last) nodes.push({ type: 'text', text: source.slice(last, match.index) });
    const [, code, strong, em, linkText, href] = match;
    if (code !== undefined) nodes.push({ type: 'code', text: code });
    else if (strong !== undefined) nodes.push({ type: 'strong', children: parseInline(strong) });
    else if (em !== undefined) nodes.push({ type: 'em', children: parseInline(em) });
    else nodes.push({ type: 'link', href, children: parseInline(linkText) });
    last = match.index + match[0].length;
  }
  if (last < source.length) nodes.push({ type: 'text', text: source.slice(last) });
  return nodes;
}

const isTableStart = (lines, i) => lines[i].includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]);

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => parseInline(cell.trim()));
}

/** Parses Markdown into blocks: heading, paragraph, list, codeblock, table. */
export function parseMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const startsBlock = j => FENCE.test(lines[j]) || HEADING.test(lines[j]) || LIST_ITEM.test(lines[j]) || isTableStart(lines, j);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ type: 'codeblock', text: code.join('\n') });
    } else if (HEADING.test(line)) {
      const [, hashes, content] = line.match(HEADING);
      blocks.push({ type: 'heading', level: hashes.length, children: parseInline(content) });
      i++;
    } else if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ type: 'table', header, rows });
    } else if (LIST_ITEM.test(line)) {
      const ordered = LIST_ITEM.exec(line)[1] !== undefined;
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const item = LIST_ITEM.exec(lines[i]);
        if (item && (item[1] !== undefined) === ordered) items.push(item[2]);
        else if (!item && !startsBlock(i) && items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
        i++;
      }
      blocks.push({ type: 'list', ordered, items: items.map(parseInline) });
    } else {
      const paragraph = [];
      while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !startsBlock(i))) {
        paragraph.push(parseInline(lines[i++].trim()));
      }
      blocks.push({ type: 'paragraph', lines: paragraph });
    }
  }
  return blocks;
}

/** Renders Markdown as a DocumentFragment (DOM nodes only, never innerHTML). */
export function renderMarkdown(source, doc = document) {
  const el = (tag, children = []) => {
    const node = doc.createElement(tag);
    node.append(...children);
    return node;
  };
  const inline = nodes => nodes.map(node => {
    switch (node.type) {
      case 'strong': return el('strong', inline(node.children));
      case 'em': return el('em', inline(node.children));
      case 'code': return el('code', [node.text]);
      case 'link': {
        const a = el('a', inline(node.children));
        a.href = node.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        return a;
      }
      default: return doc.createTextNode(node.text);
    }
  });
  const block = node => {
    switch (node.type) {
      case 'heading': return el(`h${Math.min(node.level + 2, 6)}`, inline(node.children)); // keep headings small
      case 'list': return el(node.ordered ? 'ol' : 'ul', node.items.map(item => el('li', inline(item))));
      case 'codeblock': return el('pre', [el('code', [node.text])]);
      case 'table': return el('div', [el('table', [
        el('thead', [el('tr', node.header.map(cell => el('th', inline(cell))))]),
        el('tbody', node.rows.map(row => el('tr', row.map(cell => el('td', inline(cell)))))),
      ])]);
      default: return el('p', node.lines.flatMap((line, index) => index ? [el('br'), ...inline(line)] : inline(line)));
    }
  };
  const fragment = doc.createDocumentFragment();
  fragment.append(...parseMarkdown(source).map(block));
  return fragment;
}

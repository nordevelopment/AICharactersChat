import type { LorebookEntryType } from '../models/Lorebook.js';

export interface LorebookMatchResult {
  matchedEntries: LorebookEntryType[];
  promptBlock: string;
}

/**
 * Escapes regex special characters in keyword
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a key matches in text.
 * Uses word boundary if key is alphanumeric/cyrillic word, or simple lower-case includes for phrases.
 */
function isKeyMatched(textLower: string, key: string): boolean {
  const cleanKey = key.trim().toLowerCase();
  if (!cleanKey) return false;

  // If single word, try word boundary search if supported, fallback to lower includes
  if (/^[a-zA-Z0-9_\u0400-\u04FF]+$/.test(cleanKey)) {
    try {
      const regex = new RegExp(`(?:^|\\s|\\b|[.,!?;:"'()])` + escapeRegExp(cleanKey) + `(?:$|\\s|\\b|[.,!?;:"'()])`, 'i');
      return regex.test(textLower);
    } catch {
      return textLower.includes(cleanKey);
    }
  }

  return textLower.includes(cleanKey);
}

/**
 * Match lorebook entries against a given context text window.
 */
export function matchLorebookEntries(textWindow: string, entries: LorebookEntryType[]): LorebookEntryType[] {
  if (!textWindow || entries.length === 0) return [];

  const textLower = textWindow.toLowerCase();
  const matchedEntries: LorebookEntryType[] = [];
  const seenIds = new Set<number>();

  for (const entry of entries) {
    if (!entry.is_active || (entry.id && seenIds.has(entry.id))) continue;

    const keys = Array.isArray(entry.keys) ? entry.keys : [];
    const matched = keys.some(key => isKeyMatched(textLower, key));

    if (matched) {
      matchedEntries.push(entry);
      if (entry.id) seenIds.add(entry.id);
    }
  }

  return matchedEntries;
}

/**
 * Build System Prompt injection block from matched lorebook entries.
 */
export function buildLorebookPromptBlock(matchedEntries: LorebookEntryType[]): string {
  if (matchedEntries.length === 0) return '';

  const entryLines = matchedEntries.map(e => {
    const title = e.comment ? ` [${e.comment}]` : '';
    return `- ${e.content.trim()}${title}`;
  });

  return `\n\n[World & Setting Lore Information]\n${entryLines.join('\n')}\n`;
}

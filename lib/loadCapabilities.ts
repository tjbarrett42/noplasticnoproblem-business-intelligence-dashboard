import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { CapabilityNode } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadCapabilities(): CapabilityNode[] {
  const capDir = path.join(wikiPath(), 'wiki/business/capabilities');
  const files = fs.readdirSync(capDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(capDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug: file.replace('.md', ''),
      node: data.node ?? file.replace('.md', ''),
      parent: data.parent ?? null,
      status: data.status ?? 'not-started',
      global_blocker: data.global_blocker === true,
      focus: data.focus === true,
      depends_on: Array.isArray(data.depends_on) ? data.depends_on : [],
      unlocks: Array.isArray(data.unlocks) ? data.unlocks : [],
      enables: Array.isArray(data.enables) ? data.enables : [],
      system: Array.isArray(data.system) ? data.system : [],
      measured: data.measured ?? false,
      notes: data.notes ?? '',
      body: content.trim(),
    } as CapabilityNode;
  });
}

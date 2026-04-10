import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ArchitectureObject } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadArchitectureObjects(): ArchitectureObject[] {
  const archDir = path.join(wikiPath(), 'wiki/architecture');
  if (!fs.existsSync(archDir)) return [];
  const files = fs.readdirSync(archDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(archDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug: file.replace('.md', ''),
      node: data.node ?? file.replace('.md', ''),
      type: data.type ?? 'service',
      status: data.status ?? 'proposed',
      capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
      requires: Array.isArray(data.requires) ? data.requires : [],
      reads_from: Array.isArray(data.reads_from) ? data.reads_from : [],
      writes_to: Array.isArray(data.writes_to) ? data.writes_to : [],
      calls: Array.isArray(data.calls) ? data.calls : [],
      part_of: Array.isArray(data.part_of) ? data.part_of : [],
      exposes: Array.isArray(data.exposes) ? data.exposes : [],
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      notes: data.notes ?? '',
      body: content.trim(),
    } as ArchitectureObject;
  });
}

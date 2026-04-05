import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { OperationNode } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadOperations(): OperationNode[] {
  const opDir = path.join(wikiPath(), 'wiki/business/operations');
  if (!fs.existsSync(opDir)) return [];
  const files = fs.readdirSync(opDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(opDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug: file.replace('.md', ''),
      node: data.node ?? file.replace('.md', ''),
      type: data.type ?? 'process',
      parent: data.parent ?? null,
      status: data.status ?? 'not-started',
      requires: Array.isArray(data.requires) ? data.requires : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
      outputs: Array.isArray(data.outputs) ? data.outputs : [],
      notes: data.notes ?? '',
      body: content.trim(),
    } as OperationNode;
  });
}

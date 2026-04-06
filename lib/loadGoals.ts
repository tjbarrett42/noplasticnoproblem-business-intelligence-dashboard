import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { GoalNode } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadGoals(): GoalNode[] {
  const goalsDir = path.join(wikiPath(), 'wiki/business/goals');
  const files = fs.readdirSync(goalsDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(goalsDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug: file.replace('.md', ''),
      node: data.node ?? file.replace('.md', ''),
      parent: data.parent ?? null,
      current_value: data.current_value ?? null,
      data_ref: data.data_ref ?? null,
      system: Array.isArray(data.system) ? data.system : [],
      measured: data.measured ?? false,
      depends_on: Array.isArray(data.depends_on) ? data.depends_on : [],
      horizon: data.horizon ?? null,
      confidence: data.confidence ?? null,
      status: data.status ?? 'unknown',
      requires_capabilities: Array.isArray(data.requires_capabilities)
        ? data.requires_capabilities
        : [],
      focus: data.focus === true,
      body: content.trim(),
    } as GoalNode;
  });
}

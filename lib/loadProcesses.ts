import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Process } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadProcesses(): Process[] {
  const processesDir = path.join(wikiPath(), 'wiki/processes');
  if (!fs.existsSync(processesDir)) return [];
  const files = fs.readdirSync(processesDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(processesDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      id: data.id ?? file.replace('.md', ''),
      name: data.name ?? '',
      trigger: data.trigger ?? 'user-action',
      capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
      steps: Array.isArray(data.steps) ? data.steps : [],
      status: data.status ?? 'draft',
      notes: data.notes ?? '',
      body: content.trim(),
    } as Process;
  });
}

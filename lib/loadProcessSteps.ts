import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ProcessStep } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadProcessSteps(): ProcessStep[] {
  const stepsDir = path.join(wikiPath(), 'wiki/process-steps');
  if (!fs.existsSync(stepsDir)) return [];
  const files = fs.readdirSync(stepsDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(stepsDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      id: data.id ?? file.replace('.md', ''),
      name: data.name ?? '',
      actor: data.actor ?? 'system',
      architecture: Array.isArray(data.architecture) ? data.architecture : [],
      processes: Array.isArray(data.processes) ? data.processes : [],
      status: data.status ?? 'draft',
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      external_calls: Array.isArray(data.external_calls) ? data.external_calls : [],
      notes: data.notes ?? '',
      body: content.trim(),
    } as ProcessStep;
  });
}

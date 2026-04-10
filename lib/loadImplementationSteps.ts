import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ImplementationStep } from './types';

function wikiPath(): string {
  return process.env.WIKI_PATH
    ? process.env.WIKI_PATH
    : path.join(process.cwd(), '../noplasticnoproblem-wiki');
}

export function loadImplementationSteps(): ImplementationStep[] {
  const buildsDir = path.join(wikiPath(), 'wiki/business/builds');
  if (!fs.existsSync(buildsDir)) return [];
  const files = fs.readdirSync(buildsDir).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(buildsDir, file), 'utf-8');
    const { data, content } = matter(raw);
    const artifacts = Array.isArray(data.artifacts)
      ? (data.artifacts as { type?: string; path?: string; repo?: string }[]).map((a) => ({
          type: a.type ?? '',
          path: a.path ?? '',
          ...(a.repo ? { repo: a.repo } : {}),
        }))
      : [];
    return {
      id: file.replace('.md', ''),
      capabilities_supported: Array.isArray(data.capabilities_supported)
        ? data.capabilities_supported
        : [],
      architecture: Array.isArray(data.architecture) ? data.architecture : [],
      status: data.status ?? 'ready',
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      artifacts,
      notes: data.notes ?? '',
      body: content.trim(),
    } as ImplementationStep;
  });
}

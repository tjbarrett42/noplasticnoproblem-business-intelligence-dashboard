import { loadGoals } from '@/lib/loadGoals';
import { loadCapabilities } from '@/lib/loadCapabilities';
import { loadOperations } from '@/lib/loadOperations';
import Dashboard from './components/Dashboard';

// Always read fresh from disk — no caching
export const dynamic = 'force-dynamic';

export default function Home() {
  const goals = loadGoals();
  const capabilities = loadCapabilities();
  const operations = loadOperations();

  return <Dashboard goals={goals} capabilities={capabilities} operations={operations} />;
}

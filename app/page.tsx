import { loadGoals } from '@/lib/loadGoals';
import { loadCapabilities } from '@/lib/loadCapabilities';
import Dashboard from './components/Dashboard';

// Always read fresh from disk — no caching
export const dynamic = 'force-dynamic';

export default function Home() {
  const goals = loadGoals();
  const capabilities = loadCapabilities();

  return <Dashboard goals={goals} capabilities={capabilities} />;
}

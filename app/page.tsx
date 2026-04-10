import { loadGoals } from '@/lib/loadGoals';
import { loadCapabilities } from '@/lib/loadCapabilities';
import { loadOperations } from '@/lib/loadOperations';
import { loadArchitectureObjects } from '@/lib/loadArchitectureObjects';
import { loadImplementationSteps } from '@/lib/loadImplementationSteps';
import Dashboard from './components/Dashboard';

// Always read fresh from disk — no caching
export const dynamic = 'force-dynamic';

export default function Home() {
  const goals = loadGoals();
  const capabilities = loadCapabilities();
  const operations = loadOperations();
  const archObjects = loadArchitectureObjects();
  const steps = loadImplementationSteps();

  return (
    <Dashboard
      goals={goals}
      capabilities={capabilities}
      operations={operations}
      archObjects={archObjects}
      steps={steps}
    />
  );
}

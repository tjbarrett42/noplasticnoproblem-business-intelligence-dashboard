import { loadGoals } from '@/lib/loadGoals';
import { loadCapabilities } from '@/lib/loadCapabilities';
import { loadProcesses } from '@/lib/loadProcesses';
import { loadProcessSteps } from '@/lib/loadProcessSteps';
import { loadArchitectureObjects } from '@/lib/loadArchitectureObjects';
import { loadImplementationSteps } from '@/lib/loadImplementationSteps';
import Dashboard from './components/Dashboard';

// Always read fresh from disk — no caching
export const dynamic = 'force-dynamic';

export default function Home() {
  const goals = loadGoals();
  const capabilities = loadCapabilities();
  const processes = loadProcesses();
  const processSteps = loadProcessSteps();
  const archObjects = loadArchitectureObjects();
  const steps = loadImplementationSteps();

  return (
    <Dashboard
      goals={goals}
      capabilities={capabilities}
      processes={processes}
      processSteps={processSteps}
      archObjects={archObjects}
      steps={steps}
    />
  );
}

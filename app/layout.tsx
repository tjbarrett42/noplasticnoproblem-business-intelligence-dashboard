import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NPNP Business Intelligence',
  description: 'Two-tree business model: causal goals + capability DAG',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import Link from 'next/link';
import { Activity } from 'lucide-react';

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Relay Ranking Dashboard</span>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/rankings"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                Rankings
              </Link>
              <Link
                href="/api/health"
                className="text-gray-700 hover:text-primary transition-colors"
                target="_blank"
              >
                API Status
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

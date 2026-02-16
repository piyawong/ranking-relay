'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/slots', label: 'Block Slots' },
  { href: '/slot-detail', label: 'Slot Map' },
  { href: '/bloxroute', label: 'Bloxroute' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/relays', label: 'All Relays' },
  { href: '/relay-management', label: 'Relay Mgmt' },
  { href: '/trades', label: 'Trades' },
  { href: '/report', label: 'Report' },
  { href: '/services', label: 'Services' },
  { href: '/api/health', label: 'API Status', external: true },
];

export default function AppLayout({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-lg md:text-xl font-bold truncate">Relay Dashboard</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-700 hover:text-primary transition-colors whitespace-nowrap"
                  {...(link.external ? { target: '_blank' } : {})}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-700" />
              ) : (
                <Menu className="h-6 w-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-white">
            <nav className="container mx-auto px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  {...(link.external ? { target: '_blank' } : {})}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className={fullWidth ? '' : 'container mx-auto px-0 py-4 md:py-8'}>{children}</main>
    </div>
  );
}

import AppLayout from '@/components/AppLayout';

export const metadata = {
  title: 'Relay Network Map - Relay Dashboard',
  description: 'View global distribution of relay nodes on an interactive map',
};

export default function RelaysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout fullWidth>{children}</AppLayout>;
}


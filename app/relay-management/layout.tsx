import AppLayout from '@/components/AppLayout';

export const metadata = {
  title: 'Relay Management - Relay Dashboard',
  description: 'Manage relay nodes and view their locations on a map',
};

export default function RelayManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

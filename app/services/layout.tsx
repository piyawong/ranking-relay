import AppLayout from '@/components/AppLayout';

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

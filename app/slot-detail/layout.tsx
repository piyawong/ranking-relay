import AppLayout from '@/components/AppLayout';

export default function SlotDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

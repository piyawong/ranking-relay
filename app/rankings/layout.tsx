import AppLayout from '@/components/AppLayout';

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

import AppLayout from '@/components/AppLayout';

export default function BloxrouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

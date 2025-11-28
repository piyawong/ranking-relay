import AppLayout from '@/components/AppLayout';

export default function RelaysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}


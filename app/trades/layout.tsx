import AppLayout from "@/components/AppLayout";

export default function TradesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
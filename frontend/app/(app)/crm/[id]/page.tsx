import { LeadDetail } from "@/components/crm/LeadDetail";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetail leadId={id} />;
}

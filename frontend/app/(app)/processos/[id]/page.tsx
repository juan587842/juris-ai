import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ProcessoDetail } from "@/components/processos/ProcessoDetail";
import type { ProcessoDetail as ProcessoDetailType } from "@/types/processos";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function ProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const res = await fetch(`${API_URL}/api/processos/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) redirect("/processos");

  const data: ProcessoDetailType = await res.json();

  return <ProcessoDetail data={data} />;
}

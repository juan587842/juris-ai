import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { InboxView } from "@/components/chat/InboxView";

export default async function InboxPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <InboxView currentUserId={user.id} />;
}

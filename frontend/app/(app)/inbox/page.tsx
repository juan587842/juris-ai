import { createServerClient } from "@/lib/supabase/server";
import { InboxView } from "@/components/chat/InboxView";

export default async function InboxPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <InboxView currentUserId={user!.id} />;
}

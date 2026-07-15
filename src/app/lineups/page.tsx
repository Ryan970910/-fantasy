import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { LineupPicker } from "@/components/lineup-picker";
import { getCurrentUser } from "@/lib/auth";

export default async function LineupsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="shell">
      <AppTopbar subtitle="五人上阵" />
      <LineupPicker />
    </main>
  );
}

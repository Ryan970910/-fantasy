import { AppTopbar } from "@/components/app-topbar";
import { BallShareLookup } from "@/components/ball-share-demo";

export default function BallSharePage() {
  return (
    <main className="shell">
      <AppTopbar subtitle="赛前情报" showLogout={false} />
      <BallShareLookup />
    </main>
  );
}

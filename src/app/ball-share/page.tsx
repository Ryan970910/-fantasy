import { AppTopbar } from "@/components/app-topbar";
import { BallShareDemo } from "@/components/ball-share-demo";

export default function BallSharePage() {
  return (
    <main className="shell">
      <AppTopbar subtitle="赛前情报" showLogout={false} />
      <BallShareDemo />
    </main>
  );
}

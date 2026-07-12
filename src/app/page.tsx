import { LineupPicker } from "@/components/lineup-picker";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  async function logoutAction() {
    "use server";

    await clearSession();
    redirect("/login");
  }

  return (
    <main className="shell">
      <header className="appTopbar">
        <div className="brandCluster">
          <strong>梦幻篮球</strong>
          <span>阵容编辑</span>
        </div>
        <div className="jianghuNav" aria-label="赛季信息">
          <span>赛季 2025-26</span>
          <span>常规赛 第 28 轮</span>
          <span>江湖令 1,250</span>
          <span>梦幻分 12,450</span>
        </div>
        <form action={logoutAction}>
          <button className="refreshButton" type="submit">退出</button>
        </form>
      </header>
      <LineupPicker />
    </main>
  );
}

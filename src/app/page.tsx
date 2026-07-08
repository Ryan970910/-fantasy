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
        <div>
          <strong>梦幻 NBA</strong>
          <span>{currentUser.name} - {currentUser.email}</span>
        </div>
        <form action={logoutAction}>
          <button className="refreshButton" type="submit">退出登录</button>
        </form>
      </header>
      <LineupPicker />
    </main>
  );
}

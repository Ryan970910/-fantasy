import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LoginSearchParams = {
  next?: string;
  error?: string;
};

function safeRedirectPath(value: FormDataEntryValue | string | null) {
  const path = typeof value === "string" ? value : "/";
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}

function loginErrorUrl(message: string, nextPath: string) {
  const params = new URLSearchParams({
    error: message,
    next: nextPath
  });
  return `/login?${params.toString()}`;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginSearchParams> }) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next || "/");

  async function loginAction(formData: FormData) {
    "use server";

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const redirectTo = safeRedirectPath(formData.get("next"));

    if (!email || !password) {
      redirect(loginErrorUrl("请输入邮箱和密码。", redirectTo));
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      redirect(loginErrorUrl("邮箱或密码不正确。", redirectTo));
    }

    await createSession(user.id);
    redirect(redirectTo);
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="login-title">
        <p className="eyebrow">梦幻 NBA</p>
        <h1 id="login-title">登录</h1>
        <p className="authCopy">登录后进入阵容选择页面。</p>

        {params.error ? <div className="authError">{params.error}</div> : null}

        <form className="authForm" action={loginAction}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            邮箱
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            密码
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="authButton" type="submit">登录</button>
        </form>

        <p className="authSwitch">
          还没有账号？<Link href={`/register?next=${encodeURIComponent(nextPath)}`}>注册</Link>
        </p>
      </section>
    </main>
  );
}

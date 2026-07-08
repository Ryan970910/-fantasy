import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RegisterSearchParams = {
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

function registerErrorUrl(message: string, nextPath: string) {
  const params = new URLSearchParams({
    error: message,
    next: nextPath
  });
  return `/register?${params.toString()}`;
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<RegisterSearchParams> }) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next || "/");

  async function registerAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const redirectTo = safeRedirectPath(formData.get("next"));

    if (!name || !email || !password) {
      redirect(registerErrorUrl("请输入姓名、邮箱和密码。", redirectTo));
    }

    if (password.length < 8) {
      redirect(registerErrorUrl("密码至少需要 8 个字符。", redirectTo));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      redirect(registerErrorUrl("这个邮箱已经注册。", redirectTo));
    }

    try {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hashPassword(password)
        },
        select: {
          id: true
        }
      });

      await createSession(user.id);
    } catch (error) {
      console.error("Registration failed", error);
      redirect(registerErrorUrl("无法创建账号，请稍后重试。", redirectTo));
    }

    redirect(redirectTo);
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="register-title">
        <p className="eyebrow">梦幻 NBA</p>
        <h1 id="register-title">创建账号</h1>
        <p className="authCopy">注册后进入阵容选择页面。</p>

        {params.error ? <div className="authError">{params.error}</div> : null}

        <form className="authForm" action={registerAction}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            姓名
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            邮箱
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            密码
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="authButton" type="submit">注册</button>
        </form>

        <p className="authSwitch">
          已有账号？<Link href={`/login?next=${encodeURIComponent(nextPath)}`}>登录</Link>
        </p>
      </section>
    </main>
  );
}

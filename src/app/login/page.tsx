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
      redirect(loginErrorUrl("Email and password are required.", redirectTo));
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      redirect(loginErrorUrl("Invalid email or password.", redirectTo));
    }

    await createSession(user.id);
    redirect(redirectTo);
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="login-title">
        <p className="eyebrow">Fantasy NBA</p>
        <h1 id="login-title">Log in</h1>
        <p className="authCopy">Use your account to access live stats and lineup selection.</p>

        {params.error ? <div className="authError">{params.error}</div> : null}

        <form className="authForm" action={loginAction}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="authButton" type="submit">Log in</button>
        </form>

        <p className="authSwitch">
          No account yet? <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>Register</Link>
        </p>
      </section>
    </main>
  );
}

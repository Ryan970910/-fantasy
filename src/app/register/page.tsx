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
      redirect(registerErrorUrl("Name, email, and password are required.", redirectTo));
    }

    if (password.length < 8) {
      redirect(registerErrorUrl("Password must be at least 8 characters.", redirectTo));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      redirect(registerErrorUrl("That email is already registered.", redirectTo));
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
      redirect(registerErrorUrl("Unable to create account. Please try again.", redirectTo));
    }

    redirect(redirectTo);
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="register-title">
        <p className="eyebrow">Fantasy NBA</p>
        <h1 id="register-title">Create account</h1>
        <p className="authCopy">Register before entering the fantasy NBA dashboard.</p>

        {params.error ? <div className="authError">{params.error}</div> : null}

        <form className="authForm" action={registerAction}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="authButton" type="submit">Register</button>
        </form>

        <p className="authSwitch">
          Already registered? <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Log in</Link>
        </p>
      </section>
    </main>
  );
}

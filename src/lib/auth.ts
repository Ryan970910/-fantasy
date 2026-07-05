import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const HASH_ALGORITHM = "pbkdf2_sha256";
const HASH_ITERATIONS = 120000;
const SESSION_DAYS = 30;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function encodeBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return encodeBase64Url(new Uint8Array(hash));
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number) {
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function hashPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePasswordKey(password, salt, HASH_ITERATIONS);

  return [
    HASH_ALGORITHM,
    String(HASH_ITERATIONS),
    encodeBase64Url(salt),
    encodeBase64Url(hash)
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, hashValue] = storedHash.split("$");
  const iterations = Number(iterationsValue);

  if (algorithm !== HASH_ALGORITHM || !Number.isInteger(iterations) || !saltValue || !hashValue) {
    return false;
  }

  const hash = await derivePasswordKey(password, decodeBase64Url(saltValue), iterations);
  return constantTimeEqual(encodeBase64Url(hash), hashValue);
}

export async function createSession(userId: string) {
  const token = randomToken();
  const tokenHash = await digest(token);
  const cookieExpiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(cookieExpiresAt.getTime() + BEIJING_OFFSET_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: cookieExpiresAt
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: await digest(token)
      }
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: await digest(token),
      expiresAt: {
        gt: new Date(Date.now() + BEIJING_OFFSET_MS)
      }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    }
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return session.user;
}

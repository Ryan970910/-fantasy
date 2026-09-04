import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: false, error: "Ball share probes run locally through Python nba_api." }, { status: 501 });
}

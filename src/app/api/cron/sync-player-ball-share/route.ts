import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: false, error: "Ball share sync runs locally through Python nba_api. Run pnpm player-ball-share:sync on an approved machine." }, { status: 501 });
}

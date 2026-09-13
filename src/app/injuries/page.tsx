import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { InjuryBoard } from "@/components/injury-board";
import { getCurrentUser } from "@/lib/auth";
import "./injuries.css";

export default async function InjuriesPage() {
  if (!await getCurrentUser()) redirect("/login");
  return <main className="shell"><AppTopbar subtitle="赛前情报" /><InjuryBoard /></main>;
}

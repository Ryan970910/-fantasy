import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { nbaGameDate } from '@/lib/game-window';
import { AppTopbar } from '@/components/app-topbar';
import { LiveRanking } from '@/components/live-ranking';
import './ranking.css';

export default async function RankingsPage() {
  if (!await getCurrentUser()) redirect('/login');
  return <main className="shell"><AppTopbar subtitle="实时排名"/><LiveRanking initialDate={nbaGameDate()}/></main>;
}

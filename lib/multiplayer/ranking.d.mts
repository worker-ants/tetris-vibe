export function calculateRankings(players: Array<{
  id: string;
  name: string;
  score: number;
}>): Array<{
  playerId: string;
  name: string;
  score: number;
  rank: number;
}>;

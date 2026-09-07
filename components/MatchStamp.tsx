export default function MatchStamp({ score }: { score: number }) {
  return (
    <div className="match-stamp" aria-label={`${score} percent match`}>
      <span className="text-sm">{score}%</span>
    </div>
  );
}

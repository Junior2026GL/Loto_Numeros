export default function LotteryBall({ number, size = 'md', tone = 'gold' }) {
  return (
    <span className={`ball ${size} ${tone}`}>
      {String(number).padStart(2, '0')}
    </span>
  );
}

export function BallsRow({ numbers, size, tone }) {
  return (
    <div className="balls-row">
      {numbers.map((n) => <LotteryBall key={n} number={n} size={size} tone={tone} />)}
    </div>
  );
}

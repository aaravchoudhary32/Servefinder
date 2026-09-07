type Props = {
  className?: string;
};

export default function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-line/70 bg-[linear-gradient(90deg,rgba(220,227,220,0.5)_0%,rgba(250,250,246,0.9)_50%,rgba(220,227,220,0.5)_100%)] bg-[length:400px_100%] ${className}`}
    />
  );
}

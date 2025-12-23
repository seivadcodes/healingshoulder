// src/components/LiveSessionCard.tsx
interface LiveSessionCardProps {
  title: string;
  participants: number;
}

export default function LiveSessionCard({ title, participants }: LiveSessionCardProps) {
  return (
    <div className="flex justify-between items-center p-3 border rounded-lg">
      <span>{title}</span>
      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
        {participants} inside
      </span>
    </div>
  );
}
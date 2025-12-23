// src/app/call/layout.tsx
export default function CallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] w-full bg-black">
      {children}
    </div>
  );
}
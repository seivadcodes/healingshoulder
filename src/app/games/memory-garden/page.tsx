'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Flower, Plus, Users } from 'lucide-react';

type FlowerEntry = {
  id: string;
  name: string;
  message: string;
  x: number;
  y: number;
  createdAt: number;
  isUser?: boolean;
  showPersistentMessage?: boolean; // for tap interaction
};

const generateId = () => Math.random().toString(36).substring(2, 10);
const sampleMessages = [
  "I still talk to you every evening.",
  "Your kindness lives in me.",
  "I see you in sunsets.",
  "Holding you gently today.",
  "Grief is love continuing.",
  "Thank you for loving me.",
  "I carry your strength.",
];

const COLORS = {
  flower: '#d97706',
  userFlower: '#2563eb',
  bg: '#fdf6ee',
  surface: '#fef9f3',
  text: '#1c1917',
  textMuted: '#78716c',
};

// Prevent overlap: ensure new flower isn't too close to existing ones
const findNonOverlappingPosition = (
  existingFlowers: FlowerEntry[],
  attempts = 20
): { x: number; y: number } => {
  for (let i = 0; i < attempts; i++) {
    const x = 0.15 + Math.random() * 0.7;
    const y = 0.15 + Math.random() * 0.7;
    const tooClose = existingFlowers.some(
      (f) => Math.hypot(f.x - x, f.y - y) < 0.12 // min distance ~12% of canvas
    );
    if (!tooClose) return { x, y };
  }
  // Fallback (rare): return random
  return { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7 };
};

export default function MemoryGarden() {
  const [flowers, setFlowers] = useState<FlowerEntry[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [useAnon, setUseAnon] = useState(true);
  const [activeGardeners, setActiveGardeners] = useState(5);
  const [isPlanting, setIsPlanting] = useState(false);
  const recentlyPlantedRef = useRef<Set<string>>(new Set());

  // Simulate initial flowers
  useEffect(() => {
    const initialFlowers: FlowerEntry[] = [];
    for (let i = 0; i < 4; i++) {
      const pos = findNonOverlappingPosition(initialFlowers);
      initialFlowers.push({
        id: generateId(),
        name: 'A Friend',
        message: sampleMessages[i % sampleMessages.length],
        x: pos.x,
        y: pos.y,
        createdAt: Date.now() - Math.random() * 1000 * 60 * 10,
      });
    }
    setFlowers(initialFlowers);

    // Simulate others
    const planter = setInterval(() => {
      setFlowers((prev) => {
        if (prev.length >= 60) return prev;
        const pos = findNonOverlappingPosition(prev);
        const newFlower: FlowerEntry = {
          id: generateId(),
          name: 'A Friend',
          message: sampleMessages[Math.floor(Math.random() * sampleMessages.length)],
          x: pos.x,
          y: pos.y,
          createdAt: Date.now(),
        };
        return [newFlower, ...prev];
      });
    }, 12000 + Math.random() * 8000);

    const presence = setInterval(() => {
      setActiveGardeners(4 + Math.floor(Math.random() * 5));
    }, 10000);

    return () => {
      clearInterval(planter);
      clearInterval(presence);
    };
  }, []);

  const handlePlant = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    setError('');
    setIsPlanting(true);

    setTimeout(() => {
      setFlowers((prev) => {
        const pos = findNonOverlappingPosition(prev);
        const newFlower: FlowerEntry = {
          id: generateId(),
          name: useAnon ? 'You' : name.trim(),
          message: message.trim().substring(0, 120),
          x: pos.x,
          y: pos.y,
          createdAt: Date.now(),
          isUser: true,
        };
        const updated = [newFlower, ...prev].slice(0, 70);
        // Mark as recently planted → show message for 5s
        recentlyPlantedRef.current.add(newFlower.id);
        setTimeout(() => {
          recentlyPlantedRef.current.delete(newFlower.id);
          setFlowers((f) => f.map((fl) => 
            fl.id === newFlower.id ? { ...fl, showPersistentMessage: false } : fl
          ));
        }, 5000);
        return updated;
      });
      setName('');
      setMessage('');
      setIsPlanting(false);
    }, 600);
  }, [name, message, useAnon]);

  const toggleMessage = (id: string) => {
    setFlowers((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              showPersistentMessage: !f.showPersistentMessage,
            }
          : f
      )
    );
    // Auto-hide after 4 seconds if revealed by tap
    const flower = flowers.find(f => f.id === id);
    if (flower && !flower.showPersistentMessage) {
      setTimeout(() => {
        setFlowers((f) =>
          f.map((fl) =>
            fl.id === id ? { ...fl, showPersistentMessage: false } : fl
          )
        );
      }, 4000);
    }
  };

  const now = Date.now();
  const visibleFlowers = flowers.filter(f => now - f.createdAt < 10 * 60 * 1000); // 10 min

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>
      <div className="p-4 pb-24 flex-grow">
        <div className="max-w-lg mx-auto">
          {/* Presence Bar */}
          <div className="flex items-center justify-center gap-1.5 bg-amber-100/80 text-amber-800 rounded-full py-1.5 px-3 mb-5 w-fit mx-auto">
            <Users size={14} />
            <span className="text-xs font-medium">{activeGardeners} tending the garden</span>
          </div>

          <div className="text-center mb-6">
            <Flower className="w-9 h-9 mx-auto mb-2" style={{ color: COLORS.flower }} />
            <h1 className="text-xl font-medium">Memory Garden</h1>
            <p className="text-sm mt-1 opacity-80">Place a flower in quiet remembrance.</p>
          </div>

          {/* Garden Canvas */}
          <div
            className="relative w-full h-[50vh] max-h-[420px] rounded-xl overflow-hidden mb-6 border"
            style={{ backgroundColor: COLORS.surface, borderColor: '#f5e7d3' }}
          >
            {visibleFlowers.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center opacity-70 text-sm">
                A space held in love...
              </div>
            ) : (
              visibleFlowers.map((flower) => {
                const age = (now - flower.createdAt) / 1000; // seconds
                const isRecentlyPlanted = recentlyPlantedRef.current.has(flower.id);
                const showMessage =
                  isRecentlyPlanted ||
                  flower.showPersistentMessage ||
                  age < 5; // show for first 5s even if not user-planted

                return (
                  <div
                    key={flower.id}
                    className="absolute flex flex-col items-center cursor-pointer transition-opacity"
                    style={{
                      left: `${flower.x * 100}%`,
                      top: `${flower.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={() => toggleMessage(flower.id)}
                  >
                    <Flower
                      className="w-8 h-8 transition-colors"
                      style={{ color: flower.isUser ? COLORS.userFlower : COLORS.flower }}
                    />
                    {showMessage && flower.message && (
                      <div
                        className="absolute bottom-8 px-2 py-1 text-xs rounded-full max-w-[120px] text-center"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: COLORS.text,
                          backdropFilter: 'blur(2px)',
                          animation: 'fadeInOut 5s forwards',
                        }}
                      >
                        {flower.message}
                      </div>
                    )}
                    <span className="text-xs mt-1 max-w-[90px] text-center truncate opacity-90">
                      {flower.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Plant Form */}
          <div
            className="rounded-xl p-4 shadow-sm"
            style={{ backgroundColor: 'white', border: '1px solid #f0e0ca' }}
          >
            <h2 className="font-medium text-center text-base mb-3">Place in Memory</h2>
            {error && <p className="text-red-600 text-sm mb-2 text-center">{error}</p>}
            <form onSubmit={handlePlant} className="space-y-3">
              <input
                type="text"
                placeholder="Name of your person, pet, or memory"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-lg border"
                style={{ borderColor: '#e0d0b8', backgroundColor: '#fdfaf6' }}
                maxLength={50}
              />
              <textarea
                placeholder="A word, phrase, or feeling (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2.5 rounded-lg border"
                style={{ borderColor: '#e0d0b8', backgroundColor: '#fdfaf6' }}
                rows={2}
                maxLength={120}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center text-xs opacity-80">
                  <input
                    type="checkbox"
                    checked={useAnon}
                    onChange={(e) => setUseAnon(e.target.checked)}
                    className="mr-2 w-4 h-4 text-amber-600 rounded"
                  />
                  Display as "You" (private)
                </label>
              </div>
              <button
                type="submit"
                disabled={isPlanting}
                style={{
                  backgroundColor: isPlanting ? '#d1a04c' : COLORS.flower,
                  color: 'white',
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition"
              >
                <Plus size={16} />
                {isPlanting ? 'Placing...' : 'Place Flower'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-4 opacity-70">
            Messages appear briefly, then fade. Tap any flower to reveal its words again.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .transition,
          .transition-opacity {
            transition: none !important;
          }
          div[style*="animation"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
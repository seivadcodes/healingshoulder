// lib/utils.ts
export function generateRoomName(userId1: string, userId2: string): string {
  // Sort IDs to ensure consistent room naming
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}-${sortedIds[1]}`;
}
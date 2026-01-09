// app/lib/conversationHandoff.ts
let pendingUserId: string | null = null;

export function setPendingConversation(userId: string) {
  pendingUserId = userId;
}

export function consumePendingConversation() {
  const id = pendingUserId;
  pendingUserId = null;
  return id;
}
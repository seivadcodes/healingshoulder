// src/lib/griefTypes.ts

export interface GriefType {
  id: string;
  name: string;
  description?: string;
}

export const griefLabels: Record<string, string> = {
  loss: "Loss",
  trauma: "Trauma",
  change: "Change",
  separation: "Separation",
  // Add more as needed
};
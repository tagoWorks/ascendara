import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function sanitizeText(text) {
  if (!text) return '';
  
  return text
    .replace(/ŌĆÖ/g, "'") // Replace the specific quote character
    .replace(/ŌĆō/g, "-") // Replace the specific dash character
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes (single)
    .replace(/[\u201C\u201D]/g, '"') // Smart quotes (double)
    .replace(/[\u2013\u2014]/g, '-') // En dash and em dash
    .trim();
}

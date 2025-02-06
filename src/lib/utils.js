import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function sanitizeText(text) {
  if (!text) return '';
  
  return text
    .replace(/ŌĆÖ/g, "'") 
    .replace(/ŌĆō/g, "-") 
    .replace(/├Č/g, "ö") 
    .replace(/ŌĆ£/g, '"')
    .replace(/ŌĆØ/g, '"')
    .replace(/ŌĆ"/g, '...')
    .replace(/ŌĆś/g, "'") 
    .replace(/[\u2018\u2019]/g, "'") 
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\//g, '-')
    .trim();
}

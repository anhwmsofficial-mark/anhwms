import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escapeLike(str: string) {
  return str.replace(/[%\_]/g, '\\$&');
}

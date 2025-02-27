import {clsx, type ClassValue} from "clsx";
import {Stage} from "konva/lib/Stage";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function haveIntersection(
  r1?: Rect,
  r2?: Rect
): {intersects: boolean; sides: string[]} {
  // If either rectangle is undefined, return no intersection
  if (!r1 || !r2) return {intersects: false, sides: []};

  // Check if there’s no intersection (same logic as your original function)
  const noIntersection =
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y;

  // If no intersection, return early
  if (noIntersection) return {intersects: false, sides: []};

  // Determine which sides of r1 are intersected by r2
  const sides: string[] = [];

  // Left side of r1: r2's left edge is within r1's bounds
  if (r2.x >= r1.x && r2.x <= r1.x + r1.width) {
    sides.push("left");
  }

  // Right side of r1: r2's right edge is within r1's bounds
  if (r2.x + r2.width >= r1.x && r2.x + r2.width <= r1.x + r1.width) {
    sides.push("right");
  }

  // Top side of r1: r2's top edge is within r1's bounds
  if (r2.y >= r1.y && r2.y <= r1.y + r1.height) {
    sides.push("top");
  }

  // Bottom side of r1: r2's bottom edge is within r1's bounds
  if (r2.y + r2.height >= r1.y && r2.y + r2.height <= r1.y + r1.height) {
    sides.push("bottom");
  }

  return {intersects: true, sides};
}

export function isInside(r1?: Rect, r2?: Stage | null): boolean {
  if (!r1 || !r2) return true;

  return (
    r1.x >= r2.x() &&
    r1.y >= r2.y() &&
    r1.x + r1.width <= r2.x() + r2.width() &&
    r1.y + r1.height <= r2.y() + r2.height()
  );
}

type Rect = {
  width: number;
  height: number;
  x: number;
  y: number;
};

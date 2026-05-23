'use client';
import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {label}
    </span>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

interface TablePageSizeSelectProps {
  id?: string;
  value: number;
  onChange: (size: number) => void;
}

export function TablePageSizeSelect({ id, value, onChange }: TablePageSizeSelectProps) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="h-[var(--touch-target)] w-[5.5rem] shrink-0 justify-between">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {PAGE_SIZE_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

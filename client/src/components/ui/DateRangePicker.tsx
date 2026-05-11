/**
 * DateRangePicker — single popover with start+end date selection and presets.
 * Presets: Today, Yesterday, Last 7d, Last 14d, Last 30d, Last 90d
 */
import { useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type { DateRange };

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  /** Extra presets to show. Pass empty array to hide presets. */
  presets?: Array<{ label: string; range: DateRange }>;
  /** Whether to show the "Yesterday" preset (default: true) */
  showYesterday?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function buildDefaultPresets(showYesterday: boolean) {
  const today = startOfDay(new Date());
  const presets: Array<{ label: string; range: DateRange }> = [];
  presets.push({ label: "Today", range: { from: today, to: today } });
  if (showYesterday) {
    const yesterday = subDays(today, 1);
    presets.push({ label: "Yesterday", range: { from: yesterday, to: yesterday } });
  }
  presets.push({ label: "Last 7 days", range: { from: subDays(today, 6), to: today } });
  presets.push({ label: "Last 14 days", range: { from: subDays(today, 13), to: today } });
  presets.push({ label: "Last 30 days", range: { from: subDays(today, 29), to: today } });
  presets.push({ label: "Last 90 days", range: { from: subDays(today, 89), to: today } });
  return presets;
}

export function DateRangePicker({
  value,
  onChange,
  presets,
  showYesterday = true,
  placeholder = "Select date range",
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const defaultPresets = buildDefaultPresets(showYesterday);
  const allPresets = presets ?? defaultPresets;

  const label =
    value?.from && value?.to
      ? value.from.getTime() === value.to.getTime()
        ? format(value.from, "MMM d, yyyy")
        : `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`
      : value?.from
      ? format(value.from, "MMM d, yyyy")
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-between font-normal text-sm min-w-[220px]",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 opacity-60" />
            {label}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          {allPresets.length > 0 && (
            <div className="flex flex-col gap-1 border-r p-3 min-w-[130px]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">
                Presets
              </p>
              {allPresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs h-7 px-2"
                  onClick={() => {
                    onChange(preset.range);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          {/* Calendar */}
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            defaultMonth={value?.from ?? subDays(new Date(), 13)}
            className="p-3"
          />
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Converts a DateRange to { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } strings */
export function dateRangeToStrings(range: DateRange | undefined): { from: string; to: string } | null {
  if (!range?.from || !range?.to) return null;
  return {
    from: format(range.from, "yyyy-MM-dd"),
    to: format(range.to, "yyyy-MM-dd"),
  };
}

/** Converts string dates back to a DateRange */
export function stringsToDateRange(from: string, to: string): DateRange {
  return { from: new Date(from + "T00:00:00"), to: new Date(to + "T00:00:00") };
}

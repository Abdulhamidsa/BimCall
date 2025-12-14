import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Layers, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Discipline } from "@shared/schema";

const DISCIPLINE_COLORS: Record<string, string> = {
  GEN: "bg-gray-100 text-gray-700 border-gray-300",
  ARCH: "bg-blue-100 text-blue-700 border-blue-300",
  STR: "bg-amber-100 text-amber-700 border-amber-300",
  MEP: "bg-violet-100 text-violet-700 border-violet-300",
  EL: "bg-yellow-100 text-yellow-700 border-yellow-300",
  MECH: "bg-orange-100 text-orange-700 border-orange-300",
  PL: "bg-cyan-100 text-cyan-700 border-cyan-300",
  FIRE: "bg-red-100 text-red-700 border-red-300",
  ICT: "bg-indigo-100 text-indigo-700 border-indigo-300",
  CIVIL: "bg-lime-100 text-lime-700 border-lime-300",
  QA: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export function getDisciplineColor(code: string): string {
  return DISCIPLINE_COLORS[code] || "bg-muted text-muted-foreground border-border";
}

interface DisciplineMultiSelectProps {
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function DisciplineMultiSelect({
  value,
  onChange,
  placeholder = "Select disciplines",
  disabled = false,
  className,
  compact = false,
}: DisciplineMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: disciplines = [] } = useQuery<Discipline[]>({
    queryKey: ["disciplines"],
    queryFn: async () => {
      const response = await fetch("/api/disciplines");
      if (!response.ok) throw new Error("Failed to fetch disciplines");
      return response.json();
    },
    staleTime: Infinity,
  });

  const toggleDiscipline = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter(c => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedDisciplines = disciplines.filter(d => value.includes(d.code));

  const getDisplayContent = () => {
    if (selectedDisciplines.length === 0) {
      return (
        <span className="text-muted-foreground">{placeholder}</span>
      );
    }

    if (compact && selectedDisciplines.length > 2) {
      return (
        <div className="flex items-center gap-1">
          {selectedDisciplines.slice(0, 2).map(d => (
            <Badge
              key={d.code}
              variant="outline"
              className={cn("text-xs py-0 px-1.5 h-5", getDisciplineColor(d.code))}
            >
              {d.code}
            </Badge>
          ))}
          <Badge variant="secondary" className="text-xs py-0 px-1.5 h-5">
            +{selectedDisciplines.length - 2}
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {selectedDisciplines.map(d => (
          <Badge
            key={d.code}
            variant="outline"
            className={cn("text-xs py-0 px-1.5 h-5", getDisciplineColor(d.code))}
          >
            {d.code}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-9 py-1.5",
            className
          )}
          data-testid="button-discipline-select"
        >
          <div className="flex items-center gap-2 flex-1 mr-2">
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            {getDisplayContent()}
          </div>
          <div className="flex items-center gap-1">
            {value.length > 0 && (
              <X
                className="h-3.5 w-3.5 shrink-0 opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Disciplines</span>
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 px-2 text-xs text-muted-foreground"
              data-testid="button-clear-disciplines"
            >
              Clear all
            </Button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
          {disciplines.map((discipline) => {
            const isSelected = value.includes(discipline.code);
            return (
              <div
                key={discipline.code}
                className={cn(
                  "flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors",
                  isSelected && "bg-accent/50"
                )}
                onClick={() => toggleDiscipline(discipline.code)}
                data-testid={`discipline-option-${discipline.code}`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleDiscipline(discipline.code)}
                  className="pointer-events-none"
                />
                <Badge
                  variant="outline"
                  className={cn("text-xs py-0 px-1.5 shrink-0", getDisciplineColor(discipline.code))}
                >
                  {discipline.code}
                </Badge>
                <span className="text-sm flex-1 truncate">{discipline.name}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DisciplineBadgesProps {
  codes: string[];
  className?: string;
  maxDisplay?: number;
  size?: "sm" | "default";
}

export function DisciplineBadges({
  codes,
  className,
  maxDisplay = 3,
  size = "default"
}: DisciplineBadgesProps) {
  const { data: disciplines = [] } = useQuery<Discipline[]>({
    queryKey: ["disciplines"],
    queryFn: async () => {
      const response = await fetch("/api/disciplines");
      if (!response.ok) throw new Error("Failed to fetch disciplines");
      return response.json();
    },
    staleTime: Infinity,
  });

  if (!codes || codes.length === 0) return null;

  const disciplineMap = new Map(disciplines.map(d => [d.code, d]));
  const displayCodes = codes.slice(0, maxDisplay);
  const remaining = codes.length - maxDisplay;

  const sizeClasses = size === "sm" 
    ? "text-[10px] py-0 px-1 h-4"
    : "text-xs py-0 px-1.5 h-5";

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {displayCodes.map(code => {
        const discipline = disciplineMap.get(code);
        return (
          <Badge
            key={code}
            variant="outline"
            className={cn(sizeClasses, getDisciplineColor(code))}
            title={discipline?.name}
          >
            {code}
          </Badge>
        );
      })}
      {remaining > 0 && (
        <Badge 
          variant="secondary" 
          className={sizeClasses}
          title={codes.slice(maxDisplay).map(c => disciplineMap.get(c)?.name || c).join(", ")}
        >
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

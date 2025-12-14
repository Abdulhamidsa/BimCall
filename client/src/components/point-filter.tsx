import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import { Status, mockAttendees } from "@/lib/mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { DisciplineMultiSelect } from "./discipline-multi-select";

interface FilterState {
  status: Status | "all";
  assignedTo: string | "all";
  search: string;
  disciplines: string[];
}

interface PointFilterProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function PointFilter({ filters, onFilterChange }: PointFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const clearFilters = () => {
    onFilterChange({ status: "all", assignedTo: "all", search: "", disciplines: [] });
    setIsOpen(false);
  };

  const activeFiltersCount = 
    (filters.status !== "all" ? 1 : 0) + 
    (filters.assignedTo !== "all" ? 1 : 0) + 
    ((filters.disciplines?.length ?? 0) > 0 ? 1 : 0);

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <div className="relative flex-1 md:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search points..." 
          className="pl-9 h-9" 
          value={filters.search}
          onChange={handleSearchChange}
        />
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2 border-dashed">
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filter Points</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select 
                value={filters.status} 
                onValueChange={(val) => onFilterChange({ ...filters, status: val as Status | "all" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="postponed">Postponed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
              <Select 
                value={filters.assignedTo} 
                onValueChange={(val) => onFilterChange({ ...filters, assignedTo: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {mockAttendees.map(att => (
                    <SelectItem key={att.id} value={att.name}>{att.name}</SelectItem>
                  ))}
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Disciplines</label>
              <DisciplineMultiSelect
                value={filters.disciplines ?? []}
                onChange={(disciplines) => onFilterChange({ ...filters, disciplines })}
                placeholder="All Disciplines"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {(filters.status !== "all" || filters.assignedTo !== "all" || (filters.disciplines?.length ?? 0) > 0) && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearFilters}>
           <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

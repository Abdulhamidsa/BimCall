import { createContext, useContext, useState, ReactNode } from "react";

interface ProjectFilterContextType {
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
  toggleProject: (id: string) => void;
  clearSelection: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const ProjectFilterContext = createContext<ProjectFilterContextType | undefined>(undefined);

export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id) 
        : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedProjectIds([]);
  };

  return (
    <ProjectFilterContext.Provider value={{ 
      selectedProjectIds, 
      setSelectedProjectIds, 
      toggleProject, 
      clearSelection,
      searchQuery,
      setSearchQuery
    }}>
      {children}
    </ProjectFilterContext.Provider>
  );
}

export function useProjectFilter() {
  const context = useContext(ProjectFilterContext);
  if (context === undefined) {
    throw new Error("useProjectFilter must be used within a ProjectFilterProvider");
  }
  return context;
}

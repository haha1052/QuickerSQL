import { create } from 'zustand';

interface ProjectState {
  projects: string[];
  currentProject: string;
  showProjectModal: boolean;
  newProjectName: string;
  currentDbPath: string;
  useCustomPath: boolean;
  customDbPath: string;
  selectedProjects: Set<string>;
  
  setProjects: (projects: string[]) => void;
  setCurrentProject: (project: string) => void;
  setShowProjectModal: (show: boolean) => void;
  setNewProjectName: (name: string) => void;
  setCurrentDbPath: (path: string) => void;
  setUseCustomPath: (use: boolean) => void;
  setCustomDbPath: (path: string) => void;
  toggleSelectedProject: (project: string) => void;
  clearSelectedProjects: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: '',
  showProjectModal: false,
  newProjectName: '',
  currentDbPath: '',
  useCustomPath: false,
  customDbPath: '',
  selectedProjects: new Set(),

  setProjects: (projects) => set({ projects }),
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  setShowProjectModal: (show) => set({ showProjectModal: show }),
  
  setNewProjectName: (name) => set({ newProjectName: name }),
  
  setCurrentDbPath: (path) => set({ currentDbPath: path }),
  
  setUseCustomPath: (use) => set({ useCustomPath: use }),
  
  setCustomDbPath: (path) => set({ customDbPath: path }),
  
  toggleSelectedProject: (project) => set((state) => {
    const newSelected = new Set(state.selectedProjects);
    if (newSelected.has(project)) {
      newSelected.delete(project);
    } else {
      newSelected.add(project);
    }
    return { selectedProjects: newSelected };
  }),
  
  clearSelectedProjects: () => set({ selectedProjects: new Set() }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  content: string; // raw todo.txt content
  trashedContent?: string;
}

interface TodoStore {
  projects: Record<string, Project>;
  activeProjectId: string | null;
  theme: string;
  setTheme: (theme: string) => void;
  addProject: (name: string) => void;
  setActiveProject: (id: string) => void;
  updateProjectContent: (id: string, content: string) => void;
  updateProjectTrashedContent: (id: string, content: string) => void;
  updateProjectName: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  importProject: (name: string, content: string) => void;
  collapsedGroups: Record<string, boolean>;
  collapsedTasks: Record<string, boolean>;
  toggleGroup: (date: string) => void;
  toggleTask: (id: string) => void;
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set) => ({
      projects: {
        'default': {
          id: 'default',
          name: 'Inbox',
          content: ''
        }
      },
      activeProjectId: 'default',
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      addProject: (name) => set((state) => {
        const id = crypto.randomUUID();
        return {
          projects: {
            ...state.projects,
            [id]: { id, name, content: '' }
          },
          activeProjectId: id
        };
      }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      updateProjectContent: (id, content) => set((state) => ({
        projects: {
          ...state.projects,
          [id]: { ...state.projects[id], content }
        }
      })),
      updateProjectTrashedContent: (id, content) => set((state) => ({
        projects: {
          ...state.projects,
          [id]: { ...state.projects[id], trashedContent: content }
        }
      })),
      updateProjectName: (id, name) => set((state) => ({
        projects: {
          ...state.projects,
          [id]: { ...state.projects[id], name }
        }
      })),
      deleteProject: (id) => set((state) => {
        const newProjects = { ...state.projects };
        delete newProjects[id];
        const remainingIds = Object.keys(newProjects);
        return {
          projects: newProjects,
          activeProjectId: state.activeProjectId === id ? (remainingIds[0] || null) : state.activeProjectId
        };
      }),
      importProject: (name, content) => set((state) => {
        const id = crypto.randomUUID();
        return {
          projects: {
            ...state.projects,
            [id]: { id, name, content }
          },
          activeProjectId: id
        };
      }),
      collapsedGroups: {},
      collapsedTasks: {},
      toggleGroup: (date) => set((state) => ({
        collapsedGroups: {
          ...state.collapsedGroups,
          [date]: !state.collapsedGroups[date]
        }
      })),
      toggleTask: (id) => set((state) => ({
        collapsedTasks: {
          ...state.collapsedTasks,
          [id]: !state.collapsedTasks[id]
        }
      }))
    }),
    {
      name: 'todotxt-storage',
    }
  )
);

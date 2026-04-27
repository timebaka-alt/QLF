import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Stage = string;

export interface StageConfig {
  id: string;
  label: string;
}

export const INITIAL_STAGES: StageConfig[] = [
  { id: 'cbnl', label: 'CBNL' },
  { id: 'dich', label: 'Dịch' },
  { id: 'tm_lt', label: 'TM/LT' },
  { id: 'mix', label: 'Mix' },
  { id: 'tp', label: 'Thành Phẩm' },
];

// export const STAGES: Stage[] = ['cbnl', 'dich', 'tm_lt', 'mix', 'tp'];
// export const STAGE_LABELS: Record<Stage, string> = ...


export const STAGE_COLORS: Record<string, string> = {
  cbnl: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  dich: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  tm_lt: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  mix: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  tp: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export interface Notification {
  id: string;
  userId: string;
  message: string;
  projectId: string;
  createdAt: number;
  read: boolean;
}

export type TaskStatus = 'waiting' | 'pending' | 'in_progress' | 'done' | 'rejected';

export interface HistoryEvent {
  id: string;
  userId: string;
  projectId: string;
  stage: string;
  action: 'accept' | 'reject';
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  isLeader?: boolean;
  customTitle?: string;
  roles: Stage[];
}

export type VoiceType = 'TM_NGUOI' | 'TM_AI' | 'LT_AI';

export interface Client {
  id: string;
  name: string;
  prefix: string;
}

export interface FilmProject {
  id: string;
  projectType: 'client' | 'internal';
  clientId?: string;
  block: string;
  code: string;
  originalName: string;
  translatedName: string;
  otherNames?: Record<string, string>;
  videoLink: string;
  finalLink?: string;
  duration?: number | string; // Changed to allow "Cần nhập liệu" if missing initially, though number is better. Actually let's make it optional string for flexibility
  language?: string;
  timeline?: string;
  voiceType?: VoiceType;
  posterUrl?: string;
  
  assignments: Partial<Record<Stage, string>>; // userId
  statuses: Record<Stage, TaskStatus>;
  files: Partial<Record<Stage, string>>;
  notes: string;
  createdAt: number;
  updatedAt?: number;
  userIds?: string[];
}

interface AppState {
  users: User[];
  availableTitles: string[];
  projects: FilmProject[];
  clients: Client[];
  currentUser: string | null; // ID of current user (for mocking auth)
  notifications: Notification[];
  historyEvents: HistoryEvent[];
  lastAssignedUserIds: Record<string, string>; // stageId -> userId
  
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  
  setCurrentUser: (userId: string | null) => void;
  addProject: (project: Omit<FilmProject, 'id' | 'createdAt' | 'statuses' | 'files'>) => void;
  updateProjectDetails: (projectId: string, updates: Partial<Omit<FilmProject, 'id' | 'createdAt' | 'statuses' | 'files' | 'assignments'>>) => void;
  removeProject: (projectId: string) => void;
  updateProjectStatus: (projectId: string, stage: Stage, status: TaskStatus, fileUrl?: string) => void;
  assignUser: (projectId: string, stage: Stage, userId: string) => void;
  addFile: (projectId: string, stage: Stage, fileUrl: string) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<Omit<User, 'id'>>) => void;
  removeUser: (userId: string) => void;
  addAvailableTitle: (title: string) => void;
  removeAvailableTitle: (title: string) => void;
  acceptTask: (projectId: string, stage: Stage) => void;
  rejectTask: (projectId: string, stage: Stage) => void;
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (id: string, client: Omit<Client, 'id'>) => void;
  removeClient: (id: string) => void;
  importProjects: (projects: FilmProject[]) => void;
  refreshPipelines: () => void;
  customStageLabels: Partial<Record<Stage, string>>;
  updateStageLabel: (stage: Stage, newLabel: string) => void;
  updateCustomTitle: (oldTitle: string, newTitle: string) => void;
  // added stages management
  stages: StageConfig[];
  addStage: (label: string) => void;
  updateStage: (id: string, label: string) => void;
  removeStage: (id: string) => void;
  moveStage: (id: string, targetOrDirection: 'left' | 'right' | string) => void;
}

const initialUsers: User[] = [
  { 
    id: 'u1', 
    name: 'Quản trị viên', 
    email: 'dammevietdt@gmail.com', 
    password: 'Congtoan1910!', 
    isAdmin: true,
    roles: ['cbnl', 'dich', 'tm_lt', 'mix', 'tp']
  }
];

const initialClients: Client[] = [
  { id: 'c1', name: 'Khách VIP', prefix: 'VIP' },
  { id: 'c2', name: 'CCAP', prefix: 'CC' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      users: initialUsers,
      availableTitles: [],
      projects: [],
      clients: initialClients,
      stages: INITIAL_STAGES,
      currentUser: 'u1',
      notifications: [],
      historyEvents: [],
      lastAssignedUserIds: {},
      
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      })),
      
      markAllNotificationsRead: (userId) => set((state) => ({
        notifications: state.notifications.map(n => n.userId === userId ? { ...n, read: true } : n)
      })),

      setCurrentUser: (currentUser) => set({ currentUser }),
      
      addProject: (data) => set((state) => {
        const stagesConfig = state.stages || INITIAL_STAGES;
        const STAGES = stagesConfig.map(s => s.id);
        const newLastAssignedUserIds = { ...(state.lastAssignedUserIds || {}) };
        
        let currentAssignments = { ...(data.assignments || {}) };
        
        // Auto assign users for unassigned stages
        STAGES.forEach(stageId => {
           if (!currentAssignments[stageId]) {
              // Exclude admin and leader from auto-assignment by default, unless they are the only ones with the role
              let capableUsers = state.users.filter(u => u.roles && u.roles.includes(stageId) && !u.isAdmin && !u.isLeader);
              if (capableUsers.length === 0) {
                 capableUsers = state.users.filter(u => u.roles && u.roles.includes(stageId) && !u.isAdmin);
              }
              if (capableUsers.length === 0) {
                 capableUsers = state.users.filter(u => u.roles && u.roles.includes(stageId));
              }

              if (capableUsers.length > 0) {
                 capableUsers.sort((a,b) => a.id.localeCompare(b.id)); // consistent order
                 
                 let nextIndex = 0;
                 const lastAssignedId = newLastAssignedUserIds[stageId];
                 if (lastAssignedId) {
                    const idx = capableUsers.findIndex(u => u.id === lastAssignedId);
                    if (idx !== -1) {
                        nextIndex = (idx + 1) % capableUsers.length;
                    }
                 }
                 
                 const chosenUserId = capableUsers[nextIndex].id;
                 currentAssignments[stageId] = chosenUserId;
                 newLastAssignedUserIds[stageId] = chosenUserId;
              }
           }
        });

        const statuses: Record<Stage, TaskStatus> = {};
        STAGES.forEach(s => statuses[s] = 'waiting');
        
        // The first stage assigned becomes 'pending'
        const firstStage = STAGES.find(s => currentAssignments[s]);
        if (firstStage) {
          statuses[firstStage] = 'pending';
        }
        
        const isClient = data.projectType === 'client';
        const client = isClient ? state.clients.find(c => c.id === data.clientId) : null;
        let prefix = 'DMV';
        if (isClient) {
          prefix = client ? client.prefix : 'KH';
        }
        
        let max = 0;
        const safePrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`^${safePrefix}(\\d+)`);
        
        state.projects.forEach(p => {
           if (p.projectType === data.projectType && (!isClient || p.clientId === data.clientId)) {
             const match = p.code.match(regex);
             if (match) {
                 const num = parseInt(match[1], 10);
                 if(num > max) max = num;
             }
           }
        });
        
        const nextNum = (max + 1).toString().padStart(2, '0');
        const baseCode = data.code && data.code.toUpperCase() !== 'UNKNOWN' ? data.code : '000';
        const finalCode = `${prefix}${nextNum}_${baseCode}`;
        
        const newProject: FilmProject = {
          ...data,
          assignments: currentAssignments,
          code: finalCode,
          id: generateId(),
          createdAt: Date.now(),
          statuses,
          files: {}
        };

        const newNotifications: Notification[] = [];
        const stagesConfigForNotif = state.stages || INITIAL_STAGES;
        Object.entries(currentAssignments).forEach(([stage, userId]) => {
          if (userId && userId !== 'unassigned') {
            const stageLabel = stagesConfigForNotif.find(s => s.id === stage)?.label || stage;
            newNotifications.push({
              id: generateId(),
              userId: userId as string,
              projectId: newProject.id,
              message: `Bạn được phân công làm ${stageLabel} cho dự án ${newProject.code} - ${newProject.translatedName || newProject.originalName}`,
              createdAt: Date.now(),
              read: false
            });
          }
        });

        return { 
          projects: [...state.projects, newProject],
          notifications: [...state.notifications, ...newNotifications],
          lastAssignedUserIds: newLastAssignedUserIds
        };
      }),
      
      updateProjectDetails: (projectId, updates) => set((state) => {
        const project = state.projects.find(p => p.id === projectId);
        if (project) {
          const updated = { ...project, ...updates, updatedAt: Date.now() };
          return {
            projects: state.projects.map(p => p.id === projectId ? updated : p)
          };
        }
        return state;
      }),
      
      removeProject: (projectId) => set((state) => {
        return {
          projects: state.projects.filter(p => p.id !== projectId)
        };
      }),
      
      updateProjectStatus: (projectId, stage, status, fileUrl) => set((state) => {
        const stagesConfig = state.stages || INITIAL_STAGES;
        const STAGES = stagesConfig.map(s => s.id);
        let createdNotifications: Notification[] = [];
        
        const newProjects = state.projects.map(p => {
          if (p.id !== projectId) return p;
          
          const newStatuses: Record<string, TaskStatus> = { ...p.statuses, [stage]: status };
          const newFiles = { ...p.files };
          if (fileUrl) newFiles[stage] = fileUrl;
          
          // Generate notification for next stages
          if (status === 'done') {
             // Find next stage
             let nextStage: Stage | undefined;
             const currentIdx = STAGES.indexOf(stage);
             for(let i = currentIdx + 1; i < STAGES.length; i++) {
               if(p.assignments[STAGES[i]] && newStatuses[STAGES[i]] !== 'done') {
                 nextStage = STAGES[i];
                 break;
               }
             }
             if (nextStage && p.assignments[nextStage] && p.assignments[nextStage] !== 'unassigned') {
               const currentLabel = stagesConfig.find(s => s.id === stage)?.label || stage;
               const nextLabel = stagesConfig.find(s => s.id === nextStage)?.label || nextStage;
               createdNotifications.push({
                  id: generateId(),
                  userId: p.assignments[nextStage] as string,
                  projectId: p.id,
                  message: `Công đoạn ${currentLabel} đã hoàn thành. Đến lượt bạn làm ${nextLabel} cho dự án ${p.code} - ${p.translatedName || p.originalName}`,
                  createdAt: Date.now(),
                  read: false
               });
             }
          }
          
          // Advance workflow
          let firstViableFound = false;
          for (const s of STAGES) {
            if (p.assignments[s] && newStatuses[s] !== 'done') {
              if (!firstViableFound) {
                firstViableFound = true;
                if (newStatuses[s] === 'waiting' || newStatuses[s] === 'rejected') {
                  newStatuses[s] = 'pending';
                  
                  // If it's a completely new pending task and we didn't just 'done' the immediate previous one
                  // (if we did done it, we already notified above)
                  // Wait, actually it's easier to just notify here if it TRANSITIONS from waiting/rejected to pending.
                  // But let's avoid double notifying. The above done check is sufficient for sequential flow.
                }
              } else {
                if (newStatuses[s] === 'pending') {
                  newStatuses[s] = 'waiting';
                }
              }
            }
          }
          
          const updatedProject = { ...p, statuses: newStatuses, files: newFiles };

          return updatedProject;
        });

        return {
          projects: newProjects,
          notifications: [...state.notifications, ...createdNotifications]
        };
      }),
      
      assignUser: (projectId, stage, userId) => set((state) => {
        const stagesConfig = state.stages || INITIAL_STAGES;
        const STAGES = stagesConfig.map(s => s.id);
        return {
          projects: state.projects.map(p => {
            if (p.id !== projectId) return p;
            
            const newAssignments = { ...p.assignments };
            if (userId === 'unassigned') {
              delete newAssignments[stage];
            } else {
              newAssignments[stage] = userId;
            }
            
            const newStatuses: Record<string, TaskStatus> = { ...p.statuses };
            // Reset to waiting if unassigned and not done
            if (userId === 'unassigned' && newStatuses[stage] !== 'done') {
              newStatuses[stage] = 'waiting';
            }
            
            // Recalculate pipeline
            let foundActive = false;
            for (const s of STAGES) {
              if (!newAssignments[s]) continue;
              if (newStatuses[s] === 'done') continue;
              
              if (newStatuses[s] === 'in_progress') {
                foundActive = true;
                break;
              }
              
              if (newStatuses[s] === 'pending') {
                foundActive = true;
                break;
              }
              
              if (!foundActive && (newStatuses[s] === 'waiting' || newStatuses[s] === 'rejected')) {
                newStatuses[s] = 'pending';
                foundActive = true;
                break;
              }
            }
            
            // If we still haven't found an active task, we might need to reset 'pending' to 'waiting' 
            // for any stage that inappropriately retained it? 
            // No, because we only ever set the FIRST viable stage to pending above.
            // But what if a stage WAS pending, and we unassigned the previous one?
            // Actually, if we assign a previous stage, should the current pending stage revert to waiting?
            // Yes!
            let firstViableFound = false;
            for (const s of STAGES) {
              if (newAssignments[s] && newStatuses[s] !== 'done') {
                if (!firstViableFound) {
                  // This is the first viable stage
                  firstViableFound = true;
                  if (newStatuses[s] === 'waiting' || newStatuses[s] === 'rejected') {
                    newStatuses[s] = 'pending';
                  }
                } else {
                  // Any subsequent viable stages must NOT be pending or in progress if pipeline is strictly linear.
                  // But we don't want to break "in_progress" if they somehow worked in parallel.
                  // Standard strictly linear workflow: we just reset 'pending' to 'waiting' 
                  // if a prior stage was just introduced and took the spotlight.
                  if (newStatuses[s] === 'pending') {
                    newStatuses[s] = 'waiting';
                  }
                }
              }
            }

            const updatedProject = {
              ...p,
              assignments: newAssignments,
              statuses: newStatuses,
              userIds: Object.values(newAssignments).filter(Boolean) as string[]
            };

            return updatedProject;
          })
        };
      }),
      
      addFile: (projectId, stage, fileUrl) => set((state) => {
        return {
          projects: state.projects.map(p => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              files: { ...p.files, [stage]: fileUrl }
            };
          })
        };
      }),
      
      addUser: (user) => set((state) => ({
        users: [...state.users, user]
      })),
      
      updateUser: (id, userUpdates) => set((state) => {
        return {
          users: state.users.map(u => u.id === id ? { ...u, ...userUpdates } : u)
        };
      }),
      
      removeUser: (userId) => set((state) => ({
        users: state.users.filter(u => u.id !== userId)
      })),

      acceptTask: (projectId, stage) => set((state) => {
        const project = state.projects.find(p => p.id === projectId);
        const userId = project?.assignments[stage];
        const newEvent: HistoryEvent | null = userId ? {
          id: generateId(),
          userId,
          projectId,
          stage,
          action: 'accept',
          timestamp: Date.now()
        } : null;

        return {
          historyEvents: newEvent ? [...(state.historyEvents || []), newEvent] : state.historyEvents,
          projects: state.projects.map(p => {
            if (p.id !== projectId) return p;
            const newStatuses: Record<string, TaskStatus> = { ...p.statuses, [stage]: 'in_progress' };
            return {
              ...p,
              statuses: newStatuses
            };
          })
        };
      }),

      rejectTask: (projectId, stage) => set((state) => {
        const stagesConfig = state.stages || INITIAL_STAGES;
        const STAGES = stagesConfig.map(s => s.id);
        const project = state.projects.find(p => p.id === projectId);
        const userId = project?.assignments[stage];
        const newEvent: HistoryEvent | null = userId ? {
          id: generateId(),
          userId,
          projectId,
          stage,
          action: 'reject',
          timestamp: Date.now()
        } : null;

        return {
          historyEvents: newEvent ? [...(state.historyEvents || []), newEvent] : state.historyEvents,
          projects: state.projects.map(p => {
            if (p.id !== projectId) return p;
            
            const currentIdx = STAGES.indexOf(stage);
            let prevStage: Stage | null = null;
            
            // Find the immediate previous stage that had an assignment
            for (let i = currentIdx - 1; i >= 0; i--) {
              if (p.assignments[STAGES[i]]) {
                prevStage = STAGES[i];
                break;
              }
            }
            
            const newStatuses: Record<string, TaskStatus> = { ...p.statuses, [stage]: 'waiting' };
            if (prevStage) {
              newStatuses[prevStage] = 'rejected';
            }
            
            return {
              ...p,
              statuses: newStatuses
            };
          })
        };
      }),
      
      addClient: (client) => set(state => ({
        clients: [...state.clients, { ...client, id: `c${Date.now()}` }]
      })),
      
      updateClient: (id, updatedClient) => set(state => ({
        clients: state.clients.map(c => c.id === id ? { ...c, ...updatedClient } : c)
      })),
      
      removeClient: (id) => set(state => ({
        clients: state.clients.filter(c => c.id !== id)
      })),

      addAvailableTitle: (title) => set(state => ({
        availableTitles: state.availableTitles.includes(title) ? state.availableTitles : [...state.availableTitles, title]
      })),

      removeAvailableTitle: (title) => set(state => ({
        availableTitles: state.availableTitles.filter(t => t !== title)
      })),

      importProjects: (importedProjects) => set(state => {
        const projectMap = new Map(state.projects.map(p => [p.id, p]));
        importedProjects.forEach(p => {
            projectMap.set(p.id, p);
        });
        return { projects: Array.from(projectMap.values()) };
      }),

      refreshPipelines: () => set(state => {
        const stagesConfig = state.stages || INITIAL_STAGES;
        const STAGES = stagesConfig.map(s => s.id);
        return {
          projects: state.projects.map(p => {
            const newStatuses: Record<string, TaskStatus> = { ...p.statuses };
            let firstViableFound = false;
            for (const s of STAGES) {
              if (p.assignments[s] && newStatuses[s] !== 'done') {
                if (!firstViableFound) {
                  firstViableFound = true;
                  if (newStatuses[s] === 'waiting' || newStatuses[s] === 'rejected') {
                     newStatuses[s] = 'pending';
                  }
                } else {
                  if (newStatuses[s] === 'pending') {
                     newStatuses[s] = 'waiting';
                  }
                }
              }
            }
            return { ...p, statuses: newStatuses };
          })
        };
      }),
      customStageLabels: {},
      updateStageLabel: (stage, newLabel) => set(state => ({
        customStageLabels: { ...state.customStageLabels, [stage]: newLabel }
      })),
      updateCustomTitle: (oldTitle, newTitle) => set(state => {
        const newAvailableTitles = state.availableTitles.map(t => t === oldTitle ? newTitle : t);
        const newUsers = state.users.map(u => {
          if (!u.customTitle) return u;
          const titles = u.customTitle.split(', ').map(t => t === oldTitle ? newTitle : t);
          return { ...u, customTitle: titles.join(', ') };
        });
        return { availableTitles: newAvailableTitles, users: newUsers };
      }),
      addStage: (label) => set(state => ({
        stages: [...(state.stages || INITIAL_STAGES), { id: `stage_${Date.now()}`, label }]
      })),
      updateStage: (id, label) => set(state => ({
        stages: (state.stages || INITIAL_STAGES).map(s => s.id === id ? { ...s, label } : s)
      })),
      removeStage: (id) => set(state => ({
        stages: (state.stages || INITIAL_STAGES).filter(s => s.id !== id)
      })),
      moveStage: (id, targetOrDirection) => set(state => {
        const stages = [...(state.stages || INITIAL_STAGES)];
        const idx = stages.findIndex(s => s.id === id);
        if (idx === -1) return state;
        
        if (targetOrDirection === 'left' && idx > 0) {
          [stages[idx - 1], stages[idx]] = [stages[idx], stages[idx - 1]];
        } else if (targetOrDirection === 'right' && idx < stages.length - 1) {
          [stages[idx + 1], stages[idx]] = [stages[idx], stages[idx + 1]];
        } else if (targetOrDirection !== 'left' && targetOrDirection !== 'right') {
          const targetIdx = stages.findIndex(s => s.id === targetOrDirection);
          if (targetIdx !== -1 && targetIdx !== idx) {
            const item = stages.splice(idx, 1)[0];
            stages.splice(targetIdx, 0, item);
          }
        }
        return { stages };
      }),
    }),
    {
      name: 'post-production-storage-v2',
    }
  )
);

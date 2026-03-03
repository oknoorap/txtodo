import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTodoStore } from './store';
import { parseTodoList, serializeTodoList, ParsedTodo, parseTodo } from './lib/todotxt';
import { format, isToday, isYesterday, isTomorrow, parseISO } from 'date-fns';
import { Search, Plus, Download, Upload, Moon, Sun, Monitor, Trash2, CheckSquare, Square, GripVertical, ChevronDown, ChevronRight, HelpCircle, Menu } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useFavicon } from './hooks/useFavicon';

function formatDateGroup(dateStr: string | null) {
  if (!dateStr) return 'No Date';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'dd MMM yyyy');
  } catch (e) {
    return dateStr;
  }
}

function SortableTodoItem({ 
  todo, 
  date, 
  handleToggleTodo, 
  handleUpdateTodo, 
  handleInsertTaskAfter, 
  handleIndentTodo, 
  handleDeleteTodo 
}: { 
  todo: ParsedTodo, 
  date: string, 
  handleToggleTodo: (t: ParsedTodo) => void, 
  handleUpdateTodo: (t: ParsedTodo, d: string) => void, 
  handleInsertTaskAfter: (id: string, d: string) => void, 
  handleIndentTodo: (t: ParsedTodo, dir: 1 | -1) => void, 
  handleDeleteTodo: (id: string) => void 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${(todo.depth || 0) * 1.5}rem`,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start space-x-2 py-1 px-2 rounded-md transition-colors hover:bg-muted/50`}
    >
      <button
        onClick={() => handleToggleTodo(todo)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {todo.completed ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>
      <div className="flex-1 min-w-0 break-words flex items-center">
        <Input
          id={`todo-input-${todo.id}`}
          className={`h-auto p-0 border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent rounded-none text-sm transition-colors ${todo.completed ? 'line-through text-primary/30' : ''}`}
          value={`${todo.priority ? `(${todo.priority}) ` : ''}${todo.description.replace(/(?:^|\s)\+[^\s]+/g, '').replace(/(?:^|\s)@[^\s]+/g, '').trimStart()}`}
          onChange={(e) => {
            const tags = todo.description.match(/(?:^|\s)[+@][^\s]+/g) || [];
            const newDesc = e.target.value + tags.join('');
            handleUpdateTodo(todo, newDesc);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleInsertTaskAfter(todo.id, date);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              handleIndentTodo(todo, e.shiftKey ? -1 : 1);
            } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
              e.preventDefault();
              handleDeleteTodo(todo.id);
              setTimeout(() => {
                const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="todo-input-"]'));
                const currentIndex = inputs.findIndex(input => input.id === `todo-input-${todo.id}`);
                if (currentIndex > 0) {
                  const prevInput = inputs[currentIndex - 1];
                  prevInput.focus();
                  prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
                }
              }, 0);
            }
          }}
        />
      </div>
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => handleDeleteTodo(todo.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useFavicon();
  const { projects, activeProjectId, theme, setTheme, addProject, setActiveProject, updateProjectContent, updateProjectName, deleteProject, importProject } = useTodoStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [todos, setTodos] = useState<ParsedTodo[]>([]);
  const lastSerializedRef = useRef<string>('');

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(
      'light', 'dark', 'theme-dracula', 'theme-nord', 'theme-github-dark', 'theme-solarized-dark', 'theme-monokai',
      'theme-gruvbox', 'theme-tokyo-night', 'theme-catppuccin', 'theme-synthwave', 'theme-cyberpunk',
      'theme-oceanic-next', 'theme-one-dark', 'theme-rose-pine', 'theme-dracula-soft', 'theme-material-palenight',
      'theme-solarized-light', 'theme-github-light', 'theme-catppuccin-latte', 'theme-rose-pine-dawn', 'theme-gruvbox-light'
    );
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else if (theme === 'light' || theme === 'dark') {
      root.classList.add(theme);
    } else {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  const filteredProjects = Object.values(projects).filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!activeProject) {
      setTodos([]);
      lastSerializedRef.current = '';
      return;
    }
    if (activeProject.content !== lastSerializedRef.current) {
      const parsed = parseTodoList(activeProject.content);
      setTodos(parsed);
      lastSerializedRef.current = activeProject.content;
    }
  }, [activeProject?.id, activeProject?.content]);

  const updateTodos = (newTodos: ParsedTodo[]) => {
    setTodos(newTodos);
    if (activeProject) {
      const serialized = serializeTodoList(newTodos);
      lastSerializedRef.current = serialized;
      updateProjectContent(activeProject.id, serialized);
    }
  };

  const groupedTodos = useMemo(() => {
    const groups: Record<string, ParsedTodo[]> = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    groups[todayStr] = []; // Always include today

    todos.forEach(todo => {
      const date = todo.creationDate || todayStr;
      if (!groups[date]) groups[date] = [];
      groups[date].push(todo);
    });
    return Object.entries(groups).sort((a, b) => {
      return b[0].localeCompare(a[0]); // Sort descending
    });
  }, [todos]);

  const handleAddProject = () => {
    addProject('New Project');
    setTimeout(() => {
      const state = useTodoStore.getState();
      if (state.activeProjectId) {
        // We no longer use editingProjectId
      }
    }, 0);
  };

  const handleUpdateTodo = (todo: ParsedTodo, newDescription: string) => {
    if (!activeProject) return;
    const newTodos = [...todos];
    const index = newTodos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      // Reconstruct the raw line with the new description but keeping depth/completion/etc
      let newLine = '  '.repeat(todo.depth || 0);
      if (todo.completed) {
        newLine += 'x ';
        if (todo.completionDate) newLine += `${todo.completionDate} `;
      }
      
      const priorityMatch = newDescription.match(/^\(([A-Z])\)\s+/);
      let newPriority = null;
      let descWithoutPriority = newDescription;
      if (priorityMatch) {
        newPriority = priorityMatch[1];
        descWithoutPriority = newDescription.slice(priorityMatch[0].length);
      }

      if (newPriority) newLine += `(${newPriority}) `;
      if (todo.creationDate) newLine += `${todo.creationDate} `;
      newLine += descWithoutPriority;
      
      newTodos[index] = { ...todo, raw: newLine, description: newDescription };
      updateTodos(newTodos);
    }
  };

  const handleIndentTodo = (todo: ParsedTodo, direction: 1 | -1) => {
    if (!activeProject) return;
    const newTodos = [...todos];
    const index = newTodos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      const currentDepth = todo.depth || 0;
      const newDepth = Math.max(0, Math.min(5, currentDepth + direction));
      if (newDepth !== currentDepth) {
        newTodos[index] = { ...todo, depth: newDepth };
        updateTodos(newTodos);
        
        // Refocus the input after render
        setTimeout(() => {
          const input = document.getElementById(`todo-input-${todo.id}`) as HTMLInputElement;
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }, 0);
      }
    }
  };

  const handleInsertTaskAfter = (todoId: string, date: string) => {
    if (!activeProject) return;
    const newTodos = [...todos];
    const index = newTodos.findIndex(t => t.id === todoId);
    if (index !== -1) {
      const currentDepth = newTodos[index].depth || 0;
      const newTodoRaw = '  '.repeat(currentDepth);
      
      // Insert new parsed todo
      const newTodo = parseTodo(newTodoRaw);
      newTodos.splice(index + 1, 0, newTodo);
      updateTodos(newTodos);
      
      setTimeout(() => {
        const input = document.getElementById(`todo-input-${newTodo.id}`) as HTMLInputElement;
        if (input) input.focus();
      }, 0);
    }
  };

  const handleDeleteTodo = (todoId: string) => {
    if (!activeProject) return;
    const newTodos = todos.filter(t => t.id !== todoId);
    updateTodos(newTodos);
  };

  const handleDragEnd = (event: DragEndEvent, date: string) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && activeProject) {
      const newTodos = [...todos];
      const oldIndex = newTodos.findIndex(t => t.id === active.id);
      const newIndex = newTodos.findIndex(t => t.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Find all sub-items of the dragged item
        const draggedItem = newTodos[oldIndex];
        const draggedDepth = draggedItem.depth || 0;
        const itemsToMove = [draggedItem];
        let i = oldIndex + 1;
        while (i < newTodos.length && (newTodos[i].depth || 0) > draggedDepth) {
          itemsToMove.push(newTodos[i]);
          i++;
        }

        // Remove the items from their old position
        newTodos.splice(oldIndex, itemsToMove.length);

        // Calculate the new insertion index
        // If we are moving down, the newIndex might have shifted due to the removal
        let insertIndex = newTodos.findIndex(t => t.id === over.id);
        
        // If moving down, insert AFTER the target item and its children
        if (oldIndex < newIndex) {
            const targetItem = newTodos[insertIndex];
            const targetDepth = targetItem.depth || 0;
            let j = insertIndex + 1;
            while (j < newTodos.length && (newTodos[j].depth || 0) > targetDepth) {
                j++;
            }
            insertIndex = j;
        }

        // Insert the items at the new position
        newTodos.splice(insertIndex, 0, ...itemsToMove);

        updateTodos(newTodos);
      }
    }
  };

  const toggleGroup = (date: string) => {
    setCollapsedGroups(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const handleToggleTodo = (todo: ParsedTodo) => {
    if (!activeProject) return;
    const newTodos = [...todos];
    const index = newTodos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      const updated = { ...todo };
      updated.completed = !updated.completed;
      if (updated.completed) {
        updated.completionDate = format(new Date(), 'yyyy-MM-dd');
      } else {
        updated.completionDate = null;
      }
      newTodos[index] = updated;
      updateTodos(newTodos);
    }
  };

  const handleAddTask = (text: string, date: string) => {
    if (text.trim() && activeProject) {
      const newTodos = [...todos];
      let newText = text.trim();
      const hasDate = /^\d{4}-\d{2}-\d{2}/.test(newText) || /^\([A-Z]\)\s+\d{4}-\d{2}-\d{2}/.test(newText);
      if (!hasDate) {
        if (newText.match(/^\([A-Z]\)\s+/)) {
          newText = newText.replace(/^(\([A-Z]\)\s+)/, `$1${date} `);
        } else {
          newText = `${date} ${newText}`;
        }
      }
      
      const newTodo = parseTodo(newText);
      newTodos.push(newTodo);
      updateTodos(newTodos);
    }
  };

  const handleExport = () => {
    if (!activeProject) return;
    const blob = new Blob([activeProject.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const name = file.name.replace('.txt', '');
          importProject(name, content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold mb-4 tracking-tight">Projects</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            className="pl-8 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className={`flex items-center justify-between group px-2 py-1 text-sm rounded-sm cursor-pointer transition-colors ${
                activeProjectId === project.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              onClick={() => setActiveProject(project.id)}
            >
              <Input
                className={`h-6 px-1 py-0 text-sm bg-transparent border-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent font-medium flex-1 truncate ${
                  activeProjectId === project.id ? 'text-primary-foreground placeholder:text-primary-foreground/70' : 'text-foreground'
                }`}
                value={project.name}
                onChange={(e) => updateProjectName(project.id, e.target.value)}
              />
              {Object.keys(projects).length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0 ${
                    activeProjectId === project.id ? 'text-primary-foreground hover:bg-primary-foreground/20' : 'text-muted-foreground hover:text-destructive'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button variant="outline" className="w-full justify-center" onClick={handleAddProject}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-64 border-r bg-muted/30 flex-col shrink-0">
          <SidebarContent />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {activeProject ? (
            <>
              <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                      <SidebarContent />
                    </SheetContent>
                  </Sheet>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight truncate">{activeProject.name}</h2>
                </div>
                <div className="flex items-center space-x-1 md:space-x-2 shrink-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Help & Tutorial</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm mt-4">
                        <div>
                          <h4 className="font-semibold">How to add a project</h4>
                          <p className="text-muted-foreground">Click the "New Project" button at the bottom of the sidebar.</p>
                        </div>
                        <div>
                          <h4 className="font-semibold">How to create a new to do item</h4>
                          <p className="text-muted-foreground">Type in the "Add a task..." input at the bottom of any date group and press Enter.</p>
                        </div>
                        <div>
                          <h4 className="font-semibold">How to create a to do item by Enter</h4>
                          <p className="text-muted-foreground">While editing an existing task, press Enter to quickly create a new empty task below it.</p>
                        </div>
                        <div>
                          <h4 className="font-semibold">How Tab and Shift+Tab works</h4>
                          <p className="text-muted-foreground">While editing a task, press Tab to indent it (make it a sub-task). Press Shift+Tab to outdent it.</p>
                        </div>
                        <Separator />
                        <div className="text-center text-muted-foreground">
                          Made by <a href="https://github.com/oknoorap" target="_blank" rel="noreferrer" className="text-primary hover:underline">Ribhararnus Pracutian</a>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={handleImport}>
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import todo.txt</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={handleExport}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export todo.txt</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                      <DropdownMenuItem onClick={() => setTheme('light')}>
                        <Sun className="mr-2 h-4 w-4" /> Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>
                        <Moon className="mr-2 h-4 w-4" /> Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>
                        <Monitor className="mr-2 h-4 w-4" /> System
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('github-light')}>
                        <Sun className="mr-2 h-4 w-4" /> GitHub Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('github-dark')}>
                        <Moon className="mr-2 h-4 w-4" /> GitHub Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('solarized-light')}>
                        <Sun className="mr-2 h-4 w-4" /> Solarized Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('solarized-dark')}>
                        <Moon className="mr-2 h-4 w-4" /> Solarized Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('gruvbox-light')}>
                        <Sun className="mr-2 h-4 w-4" /> Gruvbox Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('gruvbox')}>
                        <Moon className="mr-2 h-4 w-4" /> Gruvbox Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('catppuccin-latte')}>
                        <Sun className="mr-2 h-4 w-4" /> Catppuccin Latte
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('catppuccin')}>
                        <Moon className="mr-2 h-4 w-4" /> Catppuccin Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('rose-pine-dawn')}>
                        <Sun className="mr-2 h-4 w-4" /> Rosé Pine Dawn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('rose-pine')}>
                        <Moon className="mr-2 h-4 w-4" /> Rosé Pine
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dracula')}>
                        <Moon className="mr-2 h-4 w-4" /> Dracula
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dracula-soft')}>
                        <Moon className="mr-2 h-4 w-4" /> Dracula Soft
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('nord')}>
                        <Moon className="mr-2 h-4 w-4" /> Nord
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('monokai')}>
                        <Moon className="mr-2 h-4 w-4" /> Monokai
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('tokyo-night')}>
                        <Moon className="mr-2 h-4 w-4" /> Tokyo Night
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('synthwave')}>
                        <Moon className="mr-2 h-4 w-4" /> Synthwave
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('cyberpunk')}>
                        <Moon className="mr-2 h-4 w-4" /> Cyberpunk
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('oceanic-next')}>
                        <Moon className="mr-2 h-4 w-4" /> Oceanic Next
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('one-dark')}>
                        <Moon className="mr-2 h-4 w-4" /> One Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('material-palenight')}>
                        <Moon className="mr-2 h-4 w-4" /> Material Palenight
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <ScrollArea className="flex-1 min-h-0 px-6">
                  <div className="py-6 space-y-6">
                    {groupedTodos.map(([date, dateTodos]) => {
                      const isCollapsed = collapsedGroups[date];
                      return (
                      <div key={date} className="space-y-2">
                        <h3 
                          className="font-semibold text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur py-1 z-10 flex items-center cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => toggleGroup(date)}
                        >
                          {isCollapsed ? <ChevronRight className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {formatDateGroup(date)}
                        </h3>
                        {!isCollapsed && (
                          <div className="space-y-0.5">
                            <DndContext 
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleDragEnd(e, date)}
                            >
                              <SortableContext 
                                items={dateTodos.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {dateTodos.map(todo => (
                                  <SortableTodoItem
                                    key={todo.id}
                                    todo={todo}
                                    date={date}
                                    handleToggleTodo={handleToggleTodo}
                                    handleUpdateTodo={handleUpdateTodo}
                                    handleInsertTaskAfter={handleInsertTaskAfter}
                                    handleIndentTodo={handleIndentTodo}
                                    handleDeleteTodo={handleDeleteTodo}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                            <div className="px-2 pt-1">
                              <Input
                                placeholder="Add a task..."
                                className="h-8 text-sm border-transparent hover:border-border focus-visible:border-border bg-transparent shadow-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    handleAddTask(e.currentTarget.value, date);
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </ScrollArea>
                
                {/* Status Bar */}
                <div className="h-10 border-t bg-muted/10 flex items-center justify-between px-4 md:px-6 shrink-0 text-[10px] md:text-xs text-muted-foreground overflow-x-auto">
                  <div className="flex items-center space-x-3 md:space-x-4 whitespace-nowrap">
                    <span><strong className="text-foreground font-medium">{todos.length}</strong> tasks</span>
                    <span><strong className="text-foreground font-medium">{todos.filter(t => t.completed).length}</strong> completed</span>
                    <span><strong className="text-foreground font-medium">{todos.filter(t => !t.completed).length}</strong> pending</span>
                    <span className="hidden sm:inline"><strong className="text-foreground font-medium">{new Set(todos.map(t => t.creationDate || format(new Date(), 'yyyy-MM-dd'))).size}</strong> days</span>
                  </div>
                  <div className="flex items-center space-x-2 ml-4 shrink-0">
                    <span className="font-medium text-foreground">{todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0}%</span>
                    <div className="w-16 md:w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
              <div className="md:hidden mb-4">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">
                      <Menu className="h-4 w-4 mr-2" />
                      Open Projects
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    <SidebarContent />
                  </SheetContent>
                </Sheet>
              </div>
              Select or create a project to get started
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

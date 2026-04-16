import { useState, useEffect } from "react";
import { Todo, TodoStatus } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CheckCircle2, Circle, Clock, Inbox, X, Calendar, ListTodo, FolderTree, Sparkles, Loader2, BrainCircuit, TrendingUp, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { generateKanbanTasks } from "../lib/ai";

interface KanbanBoardProps {
  todos: Todo[];
  onAdd: (todo: Todo) => void;
  onUpdate: (todo: Todo) => void;
  onDelete: (id: string) => void;
  currentLearningPlanId?: string;
  currentModuleId?: string;
  modules?: any[];
  topicAnalysis?: any[];
}

const COLUMNS: { id: TodoStatus; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'backlog', label: 'Backlog', icon: Inbox, color: 'text-zinc-500', bg: 'bg-zinc-100/50' },
  { id: 'todo', label: 'To Do', icon: Circle, color: 'text-blue-600', bg: 'bg-blue-50/30' },
  { id: 'in-progress', label: 'In Progress', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/30' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/30' }
];

export function KanbanBoard({ 
  todos: propsTodos, 
  onAdd, 
  onUpdate, 
  onDelete, 
  currentLearningPlanId, 
  currentModuleId, 
  learningPlans = [],
  modules = [],
  topicAnalysis = []
}: KanbanBoardProps & { learningPlans?: any[] }) {
  const [addingToColumn, setAddingToColumn] = useState<TodoStatus | null>(null);
  const [newTodo, setNewTodo] = useState({ title: '', description: '', dueDate: '' });
  const [localTodos, setLocalTodos] = useState<Todo[]>(propsTodos);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentPlan = learningPlans.find(lp => lp.id === currentLearningPlanId);
  const planModules = modules.filter(m => m.learningPlanId === currentLearningPlanId);
  const planAnalysis = topicAnalysis.filter(ta => ta.learningPlanId === currentLearningPlanId);

  // Sync local todos when props change, but avoid interrupting active drag
  useEffect(() => {
    setLocalTodos(propsTodos);
  }, [propsTodos]);

  const handleAIGenerate = async () => {
    if (!currentPlan) {
      toast.error("Please select a learning plan first.");
      return;
    }

    setIsGenerating(true);
    try {
      const moduleData = planModules.map(m => ({
        name: m.name,
        description: m.description,
        submodules: modules.filter(sub => sub.parentId === m.id).map(sub => ({
          name: sub.name,
          description: sub.description
        }))
      }));

      const generatedTasks = await generateKanbanTasks(currentPlan.description, moduleData, currentPlan.dueDate);
      
      let addedCount = 0;
      for (const task of generatedTasks) {
        // Avoid duplicates by title
        const exists = localTodos.some(t => t.title.toLowerCase() === task.title.toLowerCase());
        if (exists) continue;

        onAdd({
          id: crypto.randomUUID(),
          title: task.title,
          description: task.description,
          status: task.status as TodoStatus,
          dueDate: task.dueDate,
          learningPlanId: currentLearningPlanId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        addedCount++;
      }
      
      if (addedCount > 0) {
        toast.success(`Generated ${addedCount} new tasks for your learning plan!`);
      } else {
        toast.info("No new tasks to add. Your board is already up to date.");
      }
    } catch (error) {
      toast.error("Failed to generate tasks.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = (status: TodoStatus) => {
    if (!newTodo.title.trim()) return;

    const todo: Todo = {
      id: crypto.randomUUID(),
      title: newTodo.title,
      description: newTodo.description,
      status: status,
      dueDate: newTodo.dueDate || undefined,
      learningPlanId: currentLearningPlanId,
      moduleId: currentModuleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Optimistic local update
    setLocalTodos(prev => [todo, ...prev]);
    
    onAdd(todo);
    setNewTodo({ title: '', description: '', dueDate: '' });
    setAddingToColumn(null);
    toast.success(`Task added to ${status}`);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Optimistic local update to fix the "temporary back" glitch
    const updatedTodos = [...localTodos];
    const todoIndex = updatedTodos.findIndex(t => t.id === draggableId);
    
    if (todoIndex !== -1) {
      const todo = { ...updatedTodos[todoIndex] };
      const oldStatus = todo.status;
      const newStatus = destination.droppableId as TodoStatus;
      
      const now = new Date().toISOString();
      
      // Track completion duration
      if (oldStatus === 'in-progress' && newStatus === 'done') {
        todo.completedAt = now;
        const startTime = new Date(todo.updatedAt).getTime();
        const endTime = new Date(todo.completedAt).getTime();
        todo.duration = (todo.duration || 0) + (endTime - startTime);
      }
      
      todo.status = newStatus;
      todo.updatedAt = now;
      
      updatedTodos.splice(todoIndex, 1);
      updatedTodos.push(todo);
      
      setLocalTodos(updatedTodos);
      onUpdate(todo);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50/30 dark:bg-zinc-950/30">
      <div className="px-8 pt-8 pb-6 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-8 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-[1.5rem] flex items-center justify-center shadow-sm">
              <ListTodo className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Study Kanban</h2>
              <div className="flex items-center gap-3 mt-2">
                {currentPlan && (
                  <span className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest bg-indigo-50/50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">
                    <FolderTree className="w-4 h-4" />
                    {currentPlan.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="outline"
              size="lg"
              onClick={handleAIGenerate} 
              disabled={isGenerating || !currentLearningPlanId}
              className="rounded-full h-12 px-8 font-bold text-sm gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              AI Task Generator
            </Button>
          </div>
        </div>

        {/* Knowledge Insights Section */}
        {planAnalysis.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {planAnalysis.slice(0, 4).map((analysis, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mb-1">{analysis.topic}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${analysis.masteryLevel}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600">{Math.round(analysis.masteryLevel)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
            {COLUMNS.map((column) => (
              <div key={column.id} className="flex flex-col gap-3 h-full">
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm shrink-0">
                  <div className="flex items-center gap-2">
                    <column.icon className={`w-4 h-4 ${column.color}`} />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600 dark:text-zinc-400">{column.label}</h3>
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-black">
                      {localTodos.filter(t => t.status === column.id).length}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setAddingToColumn(column.id)}
                    className="h-8 w-8 rounded-full text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 flex flex-col gap-4 p-4 rounded-[2rem] transition-all duration-300 overflow-y-auto no-scrollbar ${
                        snapshot.isDraggingOver 
                          ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 shadow-inner' 
                          : `${column.bg} border-zinc-100/50 dark:border-zinc-800/30`
                      } border-2 border-dashed`}
                    >
                      <AnimatePresence>
                        {isGenerating && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-4"
                          >
                            <Card className="border-none shadow-sm animate-pulse bg-white/50 dark:bg-zinc-900/50 rounded-2xl overflow-hidden">
                              <CardContent className="p-6">
                                <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-4"></div>
                                <div className="space-y-2">
                                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-full"></div>
                                  <div className="h-3 w-5/6 bg-zinc-100 dark:bg-zinc-800/50 rounded-full"></div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-zinc-50 dark:border-zinc-800 flex justify-between">
                                  <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                                  <div className="h-4 w-4 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}

                        {addingToColumn === column.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mb-2"
                          >
                            <Card className="border-indigo-200 shadow-xl rounded-2xl overflow-hidden">
                              <CardContent className="p-6 space-y-4">
                                <Input 
                                  placeholder="What needs to be done?" 
                                  value={newTodo.title}
                                  onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                                  autoFocus
                                  className="h-12 text-base font-bold rounded-xl border-zinc-200"
                                />
                                <Textarea 
                                  placeholder="Add more details..." 
                                  value={newTodo.description}
                                  onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                                  className="text-sm min-h-[100px] p-4 leading-relaxed rounded-xl border-zinc-200"
                                />
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" /> Due Date
                                  </label>
                                  <Input 
                                    type="date"
                                    value={newTodo.dueDate}
                                    onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                                    className="h-12 text-sm rounded-xl border-zinc-200"
                                  />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => {
                                      setAddingToColumn(null);
                                      setNewTodo({ title: '', description: '', dueDate: '' });
                                    }}
                                    className="h-12 px-6 text-sm font-bold text-zinc-500 rounded-full"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => handleAdd(column.id)}
                                    className="h-12 px-8 rounded-full text-sm font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                  >
                                    Add Task
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {localTodos
                        .filter(t => t.status === column.id)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((todo, index) => {
                          const isExpired = todo.dueDate && new Date(todo.dueDate) < new Date() && todo.status !== 'done';
                          
                          return (
                            <Draggable key={todo.id} draggableId={todo.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                  className="transition-transform"
                                >
                                  <Card className={`group border-none shadow-sm hover:shadow-xl transition-all rounded-2xl overflow-hidden ${
                                    isExpired 
                                      ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 border-2' 
                                      : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800'
                                  } ${
                                    snapshot.isDragging ? 'ring-2 ring-indigo-500 shadow-2xl scale-[1.02] z-50' : ''
                                  }`}>
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <h4 className={`font-bold leading-snug text-sm ${
                                          isExpired ? 'text-red-900 dark:text-red-100' : 'text-zinc-900 dark:text-zinc-100'
                                        }`}>{todo.title}</h4>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => onDelete(todo.id)}
                                          className={`h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${
                                            isExpired ? 'text-red-400 hover:text-red-600' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'
                                          }`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                      {todo.description && (
                                        <p className={`text-xs line-clamp-2 mb-4 leading-relaxed ${
                                          isExpired ? 'text-red-700/80 dark:text-red-200/80' : 'text-zinc-500'
                                        }`}>{todo.description}</p>
                                      )}
                                      
                                      <div className={`flex items-center justify-between pt-3 border-t ${
                                        isExpired ? 'border-red-100 dark:border-red-900/30' : 'border-zinc-50 dark:border-zinc-800'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          {todo.dueDate && (
                                            <div className={`flex items-center gap-1.5 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                                              isExpired
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-zinc-100 text-zinc-600'
                                            }`}>
                                              <Calendar className="w-3 h-3" />
                                              {new Date(todo.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                          )}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                                          isExpired ? 'text-red-400' : 'text-zinc-400'
                                        }`}>
                                          {new Date(todo.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      {provided.placeholder}
                      
                      {localTodos.filter(t => t.status === column.id).length === 0 && !addingToColumn && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                          <div className="w-20 h-20 rounded-[1.5rem] bg-white/80 dark:bg-zinc-800/80 flex items-center justify-center mb-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 shadow-inner">
                            <column.icon className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                          </div>
                          <h4 className="text-lg font-bold text-zinc-400">Empty Column</h4>
                          <p className="text-sm font-medium text-zinc-400/60 mt-2 max-w-[200px]">No tasks here yet. Start by adding one!</p>
                          <Button 
                            onClick={() => setAddingToColumn(column.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold mt-8 h-12 px-8 rounded-full shadow-lg shadow-indigo-100 dark:shadow-none gap-2"
                          >
                            <Plus className="w-5 h-5" />
                            Add Task
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}

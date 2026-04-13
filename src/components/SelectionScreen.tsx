import { useState } from "react";
import { LearningPlan } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FolderTree, ArrowRight, Sparkles, GraduationCap, BookOpen, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";

interface SelectionScreenProps {
  learningPlans: LearningPlan[];
  onSelect: (id: string) => void;
  onCreate: (lp: LearningPlan) => void;
}

export function SelectionScreen({ learningPlans, onSelect, onCreate }: SelectionScreenProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", description: "" });

  const handleCreate = () => {
    if (!newPlan.name) return;
    const lp: LearningPlan = {
      id: crypto.randomUUID(),
      name: newPlan.name,
      description: newPlan.description,
      createdAt: new Date().toISOString()
    };
    onCreate(lp);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 mb-4">
            <BrainCircuit className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Welcome to CertMaster AI
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-lg mx-auto">
            Select a learning path to continue your journey or create a new one to start fresh.
          </p>
        </div>

        {!isCreating ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {learningPlans.map((lp) => (
              <Card 
                key={lp.id} 
                className="group cursor-pointer hover:border-indigo-500 hover:shadow-lg transition-all border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                onClick={() => onSelect(lp.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                      <FolderTree className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <CardTitle className="text-xl">{lp.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{lp.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Study Path
                    </span>
                    <span>•</span>
                    <span>Created {new Date(lp.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card 
              className="border-dashed border-2 border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-white dark:hover:bg-zinc-900 hover:border-indigo-500 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center"
              onClick={() => setIsCreating(true)}
            >
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50">
                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-indigo-600" />
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Create New Path</h3>
              <p className="text-sm text-zinc-500 mt-1">Start a new certification or subject</p>
            </Card>
          </div>
        ) : (
          <Card className="max-w-xl mx-auto border-indigo-100 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                New Learning Path
              </CardTitle>
              <CardDescription>Define your study goal. AI will use this to tailor your experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Path Name</label>
                <Input 
                  placeholder="e.g., AWS Solutions Architect, React Masterclass" 
                  value={newPlan.name}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea 
                  placeholder="What are you studying? Mention key topics for better AI analysis." 
                  className="h-32"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button variant="ghost" onClick={() => setIsCreating(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newPlan.name} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                Create Path
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-center gap-8 pt-8 opacity-50 grayscale">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GraduationCap className="w-5 h-5" />
            <span>Structured Learning</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <BrainCircuit className="w-5 h-5" />
            <span>AI Challenges</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-5 h-5" />
            <span>Smart Insights</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

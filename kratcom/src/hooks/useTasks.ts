import { useEffect, useState } from 'react';
import type { Task } from '@/types';
import { deleteMapping } from '@/lib/vault';

const STORAGE_KEY = 'kratcom-tasks';

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.warn('Error loading tasks from localStorage:', error);
  }
  return [];
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.warn('Error saving tasks to localStorage:', error);
    }
  }, [tasks]);

  const addTask = (task: Task): void => {
    setTasks(prev => [task, ...prev]);
  };

  const updateTask = (id: string, changes: Partial<Task>): void => {
    setTasks(prev => prev.map(task => (task.id === id ? { ...task, ...changes } : task)));
  };

  const deleteTask = (id: string): void => {
    setTasks(prev => prev.filter(task => task.id !== id));
    // Borra también el mapeo cifrado de la bóveda del dispositivo
    void deleteMapping(id);
  };

  return { tasks, addTask, updateTask, deleteTask };
}

/**
 * Todo Persistence Module
 * Handles storage and retrieval of todo items using PersistenceManager
 */

import * as vscode from 'vscode';
import { PersistenceManager } from './persistence';

export interface TodoItem {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: number;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface TodoState {
    todos: TodoItem[];
    categories?: string[];
    settings?: {
        defaultPriority: string;
        sortBy: string;
    };
}

/**
 * TodoPersistence class manages todo data storage using PersistenceManager
 * Stores in workspace storage with fallback to global storage
 */
export class TodoPersistence {
    private static readonly STORAGE_KEY = 'todos.json';
    private persistence: PersistenceManager;

    constructor(context: vscode.ExtensionContext) {
        this.persistence = new PersistenceManager(context);
    }

    /**
     * Load todos from storage
     * @param useWorkspace - Use workspace storage if true, global if false
     */
    async loadTodos(useWorkspace: boolean = true): Promise<TodoItem[]> {
        try {
            const data = useWorkspace
                ? await this.persistence.loadFromWorkspace(TodoPersistence.STORAGE_KEY)
                : await this.persistence.loadFromGlobal(TodoPersistence.STORAGE_KEY);

            if (!data || !Array.isArray(data.todos)) {
                return [];
            }

            // Validate and return todos
            return data.todos.filter(this.isValidTodoItem);
        } catch (error) {
            console.error('Failed to load todos:', error);
            return [];
        }
    }

    /**
     * Save todos to storage
     * @param todos - Array of todo items to save
     * @param useWorkspace - Use workspace storage if true, global if false
     */
    async saveTodos(todos: TodoItem[], useWorkspace: boolean = true): Promise<void> {
        try {
            const state: TodoState = {
                todos: todos.filter(this.isValidTodoItem)
            };

            if (useWorkspace) {
                await this.persistence.saveToWorkspace(TodoPersistence.STORAGE_KEY, state);
            } else {
                await this.persistence.saveToGlobal(TodoPersistence.STORAGE_KEY, state);
            }
        } catch (error) {
            console.error('Failed to save todos:', error);
            throw new Error(`Failed to save todos: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete all todos from storage
     * @param useWorkspace - Use workspace storage if true, global if false
     */
    async clearTodos(useWorkspace: boolean = true): Promise<void> {
        try {
            if (useWorkspace) {
                await this.persistence.deleteFromWorkspace(TodoPersistence.STORAGE_KEY);
            } else {
                await this.persistence.deleteFromGlobal(TodoPersistence.STORAGE_KEY);
            }
        } catch (error) {
            console.error('Failed to clear todos:', error);
            throw new Error(`Failed to clear todos: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Check if workspace storage is available
     */
    hasWorkspace(): boolean {
        return vscode.workspace.workspaceFolders !== undefined;
    }

    /**
     * Validate todo item structure
     */
    private isValidTodoItem(item: any): item is TodoItem {
        return (
            item &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            typeof item.completed === 'boolean' &&
            typeof item.createdAt === 'number' &&
            typeof item.updatedAt === 'number'
        );
    }

    /**
     * Create a new todo item with default values
     */
    static createTodoItem(title: string, options: Partial<TodoItem> = {}): TodoItem {
        const now = Date.now();
        return {
            id: options.id || this.generateId(),
            title,
            description: options.description,
            completed: options.completed ?? false,
            priority: options.priority,
            dueDate: options.dueDate,
            tags: options.tags,
            createdAt: options.createdAt || now,
            updatedAt: options.updatedAt || now
        };
    }

    /**
     * Generate a unique ID for a todo item
     */
    private static generateId(): string {
        return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// src/services/kanban.service.ts
import { KanbanDatabase } from '../database/kanban-database';
import { Task, Column, Project } from '../types/kanban.types';

export class KanbanService {
  private db: KanbanDatabase;

  constructor() {
    this.db = new KanbanDatabase();
  }

  // === 專案管理 ===
  getAllProjects(): Array<Omit<Project, 'columns'> & { columnsCount: number; tasksCount: number }> {
    const projects = this.db.getAllProjects();
    
    return projects.map(project => {
      const columns = this.db.getColumnsByProject(project.id);
      const tasksCount = columns.reduce((total, column) => {
        return total + this.db.getTasksByColumn(column.id).length;
      }, 0);
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.created_at,
        columnsCount: columns.length,
        tasksCount
      };
    });
  }

  createProjectWithDefaults(projectData: { name: string; description: string }): Project {
    const projectId = this.generateId();
    const project = {
      id: projectId,
      name: projectData.name,
      description: projectData.description,
      created_at: new Date().toISOString()
    };

    // 建立專案
    this.db.createProject(project);

    // 建立預設欄位
    const defaultColumns = [
      { title: 'To Do', color: 'bg-blue-500', order: 1 },
      { title: 'In Progress', color: 'bg-yellow-500', order: 2 },
      { title: 'Done', color: 'bg-green-500', order: 3 }
    ];

    const columns: Column[] = defaultColumns.map((col, index) => ({
      id: this.generateId(),
      title: col.title,
      color: col.color,
      order: col.order,
      tasks: []
    }));

    columns.forEach(column => {
      this.db.createColumn({
        id: column.id,
        title: column.title,
        color: column.color,
        order_index: column.order
      }, projectId);
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
      columns
    };
  }

  updateProject(projectId: string, updates: { name?: string; description?: string }): boolean {
    return this.db.updateProject(projectId, updates);
  }

  deleteProject(projectId: string): boolean {
    return this.db.deleteProject(projectId);
  }

  // === 欄位管理 ===
  createColumn(columnData: { title: string; color: string }, projectId: string): Column {
    const columnId = this.generateId();
    const columns = this.db.getColumnsByProject(projectId);
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.order_index)) : 0;

    const column = {
      id: columnId,
      title: columnData.title,
      color: columnData.color,
      order_index: maxOrder + 1
    };

    this.db.createColumn(column, projectId);

    return {
      id: column.id,
      title: column.title,
      color: column.color,
      order: column.order_index,
      tasks: []
    };
  }

  updateColumn(columnId: string, updates: { title?: string; color?: string }): boolean {
    return this.db.updateColumn(columnId, updates);
  }

  deleteColumn(columnId: string): boolean {
    return this.db.deleteColumn(columnId);
  }

  // === 任務管理 ===
  createTask(taskData: Omit<Task, 'id'>, columnId: string): Task {
    const taskId = this.generateId();
    const task = {
      id: taskId,
      ...taskData
    };

    this.db.createTask({
      id: task.id,
      column_id: columnId,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      due_date: task.dueDate,
      priority: task.priority,
      order_index: 0
    });

    if (task.tags.length > 0) {
      this.db.addTaskTags(task.id, task.tags);
    }

    return task;
  }

  updateTask(taskId: string, updates: Partial<Task>): boolean {
    try {
      // 檢查任務是否存在
      const task = this.db.getTask(taskId);
      if (!task) {
        return false;
      }

      this.db.db.exec('BEGIN TRANSACTION');
      
      // 更新任務基本資料
      if (Object.keys(updates).some(key => key !== 'tags')) {
        const taskUpdates: any = {};
        if (updates.title !== undefined) taskUpdates.title = updates.title;
        if (updates.description !== undefined) taskUpdates.description = updates.description;
        if (updates.assignee !== undefined) taskUpdates.assignee = updates.assignee;
        if (updates.dueDate !== undefined) taskUpdates.due_date = updates.dueDate;
        if (updates.priority !== undefined) taskUpdates.priority = updates.priority;
        
        this.db.updateTask(taskId, taskUpdates);
      }

      // 更新標籤
      if (updates.tags !== undefined) {
        this.db.deleteTaskTags(taskId);
        if (updates.tags.length > 0) {
          this.db.addTaskTags(taskId, updates.tags);
        }
      }

      this.db.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.db.exec('ROLLBACK');
      console.error('Update task error:', error);
      return false;
    }
  }

  deleteTask(taskId: string): boolean {
    return this.db.deleteTask(taskId);
  }

  moveTask(taskId: string, newColumnId: string, newIndex?: number): void {
    this.db.moveTask(taskId, newColumnId);
    
    // 如果指定了新位置，重新排序
    if (newIndex !== undefined) {
      const tasks = this.db.getTasksByColumn(newColumnId);
      const taskIds = tasks.map(t => t.id);
      
      // 移除當前任務 ID 並在新位置插入
      const currentIndex = taskIds.indexOf(taskId);
      if (currentIndex !== -1) {
        taskIds.splice(currentIndex, 1);
      }
      taskIds.splice(newIndex, 0, taskId);
      
      this.reorderTasks(newColumnId, taskIds);
    }
  }

  reorderTasks(columnId: string, taskIds: string[]): void {
    try {
      this.db.db.exec('BEGIN TRANSACTION');
      taskIds.forEach((taskId, index) => {
        this.db.updateTaskOrder(taskId, index);
      });
      this.db.db.exec('COMMIT');
    } catch (error) {
      this.db.db.exec('ROLLBACK');
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 保留原有方法
  getProjectWithColumns(projectId: string): Project | null {
    const project = this.db.getProject(projectId);
    if (!project) return null;

    const dbColumns = this.db.getColumnsByProject(projectId);
    
    const columns: Column[] = dbColumns.map(dbColumn => {
      const dbTasks = this.db.getTasksByColumn(dbColumn.id);
      
      const tasks: Task[] = dbTasks.map(dbTask => ({
        id: dbTask.id,
        title: dbTask.title,
        description: dbTask.description,
        assignee: dbTask.assignee,
        dueDate: dbTask.due_date,
        priority: dbTask.priority,
        tags: dbTask.tags ? dbTask.tags.split(',') : []
      }));

      return {
        id: dbColumn.id,
        title: dbColumn.title,
        color: dbColumn.color,
        order: dbColumn.order_index,
        tasks
      };
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
      columns
    };
  }
}
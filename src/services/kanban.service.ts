// src/services/kanban.service.ts
import { KanbanDatabase } from '../database/kanban-database';
import { Task, Column, Project } from '../types/kanban.types';

export class KanbanService {
  private db: KanbanDatabase;

  constructor() {
    this.db = new KanbanDatabase();
  }

  createProject(project: Omit<Project, 'columns'>): void {
    this.db.createProject({
      id: project.id,
      name: project.name,
      description: project.description,
      created_at: project.createdAt
    });
  }

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

  createTask(task: Task, columnId: string): void {
    // 新增任務
    this.db.createTask({
      id: task.id,
      column_id: columnId,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      due_date: task.dueDate,
      priority: task.priority
    });

    // 新增標籤
    if (task.tags.length > 0) {
      this.db.addTaskTags(task.id, task.tags);
    }
  }

  createColumn(column: Omit<Column, 'tasks'>, projectId: string): void {
    this.db.createColumn({
      id: column.id,
      title: column.title,
      color: column.color,
      order_index: column.order
    }, projectId);
  }

  moveTask(taskId: string, newColumnId: string): void {
    this.db.moveTask(taskId, newColumnId);
  }
}
// src/database/kanban-database.ts
import Database from 'better-sqlite3';
import { DbTask, DbColumn, DbProject } from '../types/kanban.types';

export class KanbanDatabase {
  public db: Database.Database; // 改為 public 讓 service 可以存取

  constructor(dbPath: string = 'kanban.db') {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      -- 專案表
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );
      
      -- 欄位表
      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      
      -- 任務表
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assignee TEXT,
        due_date TEXT,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
        created_at TEXT DEFAULT (datetime('now')),
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
      );
      
      -- 標籤表
      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_name),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
      
      -- 索引
      CREATE INDEX IF NOT EXISTS idx_columns_project_id ON columns(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
      CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
    `);
  }

  // === 專案操作 ===
  createProject(project: DbProject): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, created_at) 
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(project.id, project.name, project.description, project.created_at);
  }

  getAllProjects(): DbProject[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    return stmt.all() as DbProject[];
  }

  getProject(projectId: string): DbProject | undefined {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(projectId) as DbProject | undefined;
  }

  updateProject(projectId: string, updates: { name?: string; description?: string }): boolean {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    
    if (fields.length === 0) return false;
    
    values.push(projectId);
    
    const stmt = this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteProject(projectId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(projectId);
    return result.changes > 0;
  }

  // === 欄位操作 ===
  createColumn(column: Omit<DbColumn, 'project_id'>, projectId: string): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO columns (id, project_id, title, color, order_index) 
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(column.id, projectId, column.title, column.color, column.order_index);
  }

  getColumnsByProject(projectId: string): DbColumn[] {
    const stmt = this.db.prepare(`
      SELECT * FROM columns 
      WHERE project_id = ? 
      ORDER BY order_index
    `);
    return stmt.all(projectId) as DbColumn[];
  }

  updateColumn(columnId: string, updates: { title?: string; color?: string }): boolean {
    const fields = [];
    const values = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }
    
    if (fields.length === 0) return false;
    
    values.push(columnId);
    
    const stmt = this.db.prepare(`UPDATE columns SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteColumn(columnId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM columns WHERE id = ?');
    const result = stmt.run(columnId);
    return result.changes > 0;
  }

  // === 任務操作 ===
  createTask(task: Omit<DbTask, 'created_at' | 'tags'>): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, column_id, title, description, assignee, due_date, priority) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      task.id, task.column_id, task.title, 
      task.description, task.assignee, task.due_date, task.priority
    );
  }

  getTasksByColumn(columnId: string): DbTask[] {
    const stmt = this.db.prepare(`
      SELECT t.*, GROUP_CONCAT(tt.tag_name) as tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      WHERE t.column_id = ?
      GROUP BY t.id
      ORDER BY t.order_index, t.created_at
    `);
    return stmt.all(columnId) as DbTask[];
  }

  updateTask(taskId: string, updates: any): boolean {
    const fields:any[] = [];
    const values = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    
    if (fields.length === 0) return false;
    
    values.push(taskId);
    
    const stmt = this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteTask(taskId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(taskId);
    return result.changes > 0;
  }

  moveTask(taskId: string, newColumnId: string): Database.RunResult {
    const stmt = this.db.prepare('UPDATE tasks SET column_id = ? WHERE id = ?');
    return stmt.run(newColumnId, taskId);
  }

  updateTaskOrder(taskId: string, order: number): void {
    const stmt = this.db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?');
    stmt.run(order, taskId);
  }

  // === 標籤操作 ===
  addTaskTags(taskId: string, tags: string[]): void {
    const stmt = this.db.prepare('INSERT INTO task_tags (task_id, tag_name) VALUES (?, ?)');
    const transaction = this.db.transaction(() => {
      for (const tag of tags) {
        stmt.run(taskId, tag);
      }
    });
    transaction();
  }

  deleteTaskTags(taskId: string): void {
    const stmt = this.db.prepare('DELETE FROM task_tags WHERE task_id = ?');
    stmt.run(taskId);
  }

  close(): void {
    this.db.close();
  }
}
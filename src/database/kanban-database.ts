// src/database/kanban-database.ts
import { DatabaseSync } from 'node:sqlite';
import { DbTask, DbColumn, DbProject } from '../types/kanban.types';

export class KanbanDatabase {
  public db: DatabaseSync;

  constructor(dbPath: string = 'kanban.db') {
    this.db = new DatabaseSync(dbPath);
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

      -- 遷移：為現有的 tasks 表添加 order_index 欄位
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;
      
      -- 檢查 order_index 欄位是否存在
      SELECT CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM pragma_table_info('tasks') WHERE name='order_index'
        ) THEN
          'ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0;'
        ELSE
          'SELECT 1;'
      END;
      
      -- 更新現有記錄的 order_index
      UPDATE tasks 
      SET order_index = (
        SELECT COUNT(*) 
        FROM tasks t2 
        WHERE t2.column_id = tasks.column_id 
        AND t2.created_at <= tasks.created_at
      ) - 1
      WHERE order_index = 0;
      
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }

  // === 專案操作 ===
  createProject(project: DbProject): { changes: number ; lastInsertRowid: number } {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, created_at) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(project.id, project.name, project.description, project.created_at);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }

  getAllProjects(): DbProject[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const results = stmt.all();
    return results.map(row => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      created_at: row.created_at as string
    }));
  }

  getProject(projectId: string): DbProject | undefined {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const result = stmt.get(projectId);
    if (!result) return undefined;
    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      created_at: result.created_at as string
    };
  }

  updateProject(projectId: string, updates: { name?: string; description?: string }): boolean {
    const fields: string[] = [];
    const values: any[] = [];
    
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
  createColumn(column: Omit<DbColumn, 'project_id'>, projectId: string): { changes: number; lastInsertRowid: number } {
    const stmt = this.db.prepare(`
      INSERT INTO columns (id, project_id, title, color, order_index) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(column.id, projectId, column.title, column.color, column.order_index);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }

  getColumnsByProject(projectId: string): DbColumn[] {
    const stmt = this.db.prepare(`
      SELECT * FROM columns 
      WHERE project_id = ? 
      ORDER BY order_index
    `);
    const results = stmt.all(projectId);
    return results.map(row => ({
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      color: row.color as string,
      order_index: row.order_index as number
    }));
  }

  updateColumn(columnId: string, updates: { title?: string; color?: string }): boolean {
    const fields: string[] = [];
    const values: any[] = [];
    
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

  updateColumnOrder(columnId: string, order: number): void {
    const stmt = this.db.prepare('UPDATE columns SET order_index = ? WHERE id = ?');
    stmt.run(order, columnId);
  }

  /**
   * 批次更新欄位順序
   */
  updateColumnsOrder(columnOrders: { columnId: string; order: number }[]): void {
    const stmt = this.db.prepare('UPDATE columns SET order_index = ? WHERE id = ?');
    
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const { columnId, order } of columnOrders) {
        stmt.run(order, columnId);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // === 任務操作 ===
  createTask(task: Omit<DbTask, 'created_at' | 'tags'>): { changes: number; lastInsertRowid: number } {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, column_id, title, description, assignee, due_date, priority, order_index) 
      VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM tasks WHERE column_id = ?))
    `);
    const result = stmt.run(
      task.id, task.column_id, task.title, 
      task.description, task.assignee, task.due_date, task.priority,
      task.column_id
    );
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }

  getTasksByColumn(columnId: string): DbTask[] {
    const stmt = this.db.prepare(`
      SELECT t.*, GROUP_CONCAT(tt.tag_name) as tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      WHERE t.column_id = ?
      GROUP BY t.id
      ORDER BY COALESCE(t.order_index, 0), t.created_at
    `);
    const results = stmt.all(columnId);
    return results.map(row => ({
      id: row.id as string,
      column_id: row.column_id as string,
      title: row.title as string,
      description: row.description as string,
      assignee: row.assignee as string,
      due_date: row.due_date as string,
      priority: row.priority as "low" | "medium" | "high",
      order_index: row.order_index as number || 0,
      created_at: row.created_at as string,
      tags: row.tags as string
    }));
  }

  updateTask(taskId: string, updates: Record<string, any>): boolean {
    const fields: string[] = [];
    const values: any[] = [];
    
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

  moveTask(taskId: string, newColumnId: string): { changes: number; lastInsertRowid: number } {
    const stmt = this.db.prepare('UPDATE tasks SET column_id = ? WHERE id = ?');
    const result = stmt.run(newColumnId, taskId);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }

  updateTaskOrder(taskId: string, order: number): void {
    const stmt = this.db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?');
    stmt.run(order, taskId);
  }

  // === 標籤操作 ===
  addTaskTags(taskId: string, tags: string[]): void {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_name) VALUES (?, ?)');
    
    for (const tag of tags) {
      stmt.run(taskId, tag);
    }
  }

  deleteTaskTags(taskId: string): void {
    const stmt = this.db.prepare('DELETE FROM task_tags WHERE task_id = ?');
    stmt.run(taskId);
  }

  // === 進階功能 ===
  
  /**
   * 取得專案的完整資料，包含所有欄位和任務
   */
  getProjectWithDetails(projectId: string): DbProject & { 
    columns: (DbColumn & { tasks: DbTask[] })[] 
  } | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const columns = this.getColumnsByProject(projectId);
    const columnsWithTasks = columns.map(column => ({
      ...column,
      tasks: this.getTasksByColumn(column.id)
    }));

    return {
      ...project,
      columns: columnsWithTasks
    };
  }

  /**
   * 批次更新任務順序
   */
  updateTasksOrder(taskOrders: { taskId: string; order: number }[]): void {
    const stmt = this.db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?');
    
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const { taskId, order } of taskOrders) {
        stmt.run(order, taskId);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * 搜尋任務
   */
  searchTasks(projectId: string, searchTerm: string): DbTask[] {
    const stmt = this.db.prepare(`
      SELECT t.*, GROUP_CONCAT(tt.tag_name) as tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN columns c ON t.column_id = c.id
      WHERE c.project_id = ? 
        AND (t.title LIKE ? OR t.description LIKE ? OR t.assignee LIKE ?)
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    
    const searchPattern = `%${searchTerm}%`;
    const results = stmt.all(projectId, searchPattern, searchPattern, searchPattern);
    return results.map(row => ({
      id: row.id as string,
      column_id: row.column_id as string,
      title: row.title as string,
      description: row.description as string,
      assignee: row.assignee as string,
      due_date: row.due_date as string,
      priority: row.priority as "low" | "medium" | "high",
      order_index: row.order_index as number,
      created_at: row.created_at as string,
      tags: row.tags as string
    }));
  }

  getTask(taskId: string): DbTask | undefined {
    const stmt = this.db.prepare(`
      SELECT t.*, GROUP_CONCAT(tt.tag_name) as tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      WHERE t.id = ?
      GROUP BY t.id
    `);
    const result = stmt.get(taskId);
    if (!result) return undefined;
    return {
      id: result.id as string,
      column_id: result.column_id as string,
      title: result.title as string,
      description: result.description as string,
      assignee: result.assignee as string,
      due_date: result.due_date as string,
      priority: result.priority as "low" | "medium" | "high",
      order_index: result.order_index as number || 0,
      created_at: result.created_at as string,
      tags: result.tags as string
    };
  }

  close(): void {
    this.db.close();
  }
}
// src/types/kanban.types.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  columnId?: string; // 資料庫關聯用
  createdAt?: string;
}

export interface Column {
  id: string;
  title: string;
  color: string;
  order: number;
  tasks: Task[];
  projectId?: string; // 資料庫關聯用
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  columns: Column[];
}

// 資料庫原始資料介面
export interface DbTask {
  id: string;
  column_id: string;
  title: string;
  description: string;
  assignee: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  tags?: string; // GROUP_CONCAT 結果
  order_index: number;
}

export interface DbColumn {
  id: string;
  project_id: string;
  title: string;
  color: string;
  order_index: number;
}

export interface DbProject {
  id: string;
  name: string;
  description: string;
  created_at: string;
}
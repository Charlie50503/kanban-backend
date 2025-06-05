// src/app.ts
import express from 'express';
import cors from 'cors';
import { KanbanService } from './services/kanban.service';
import { Task, Column, Project } from './types/kanban.types';

const app = express();
const kanbanService = new KanbanService();

app.use(cors());
app.use(express.json());

// 取得專案
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = kanbanService.getProjectWithColumns(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 新增專案
app.post('/api/projects', (req, res) => {
  try {
    const project: Omit<Project, 'columns'> = {
      ...req.body,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    
    kanbanService.createProject(project);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// 新增任務
app.post('/api/projects/:projectId/columns/:columnId/tasks', (req, res) => {
  try {
    const task: Task = {
      ...req.body,
      id: generateId()
    };
    
    kanbanService.createTask(task, req.params.columnId);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// 移動任務
app.patch('/api/tasks/:id/move', (req, res) => {
  try {
    const { columnId } = req.body;
    kanbanService.moveTask(req.params.id, columnId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to move task' });
  }
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
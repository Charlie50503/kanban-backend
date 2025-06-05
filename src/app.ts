// src/app.ts
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { KanbanService } from './services/kanban.service';
import { Task, Column, Project } from './types/kanban.types';

const app = express();
const kanbanService = new KanbanService();

app.use(cors());
app.use(express.json());

// Swagger 文件
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kanban API 文件'
}));

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: 取得所有專案列表
 *     description: 取得所有專案的基本資訊（不包含詳細的欄位和任務資料）
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: 成功取得專案列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                   columnsCount:
 *                     type: integer
 *                   tasksCount:
 *                     type: integer
 */
app.get('/api/projects', (req, res) => {
  try {
    const projects = kanbanService.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: '取得專案列表失敗' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: 取得專案詳細資料
 *     description: 根據專案 ID 取得專案的完整資料，包含所有欄位和任務
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功取得專案資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: 找不到專案
 */
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = kanbanService.getProjectWithColumns(req.params.id);
    if (!project) {
      return res.status(404).json({ error: '找不到專案' });
    }
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: 建立新專案
 *     description: 建立一個新的 Kanban 專案，會自動建立預設的三個欄位
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectRequest'
 *     responses:
 *       201:
 *         description: 專案建立成功
 */
app.post('/api/projects', (req, res) => {
  try {
    const project = kanbanService.createProjectWithDefaults(req.body);
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: '建立專案失敗' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: 更新專案資訊
 *     description: 更新專案的名稱和描述
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 專案更新成功
 *       404:
 *         description: 找不到專案
 */
app.put('/api/projects/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    const updated = kanbanService.updateProject(req.params.id, { name, description });
    
    if (!updated) {
      return res.status(404).json({ error: '找不到專案' });
    }
    
    res.json({ success: true, message: '專案更新成功' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: '更新專案失敗' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: 刪除專案
 *     description: 刪除指定的專案及其所有欄位和任務
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 專案刪除成功
 *       404:
 *         description: 找不到專案
 */
app.delete('/api/projects/:id', (req, res) => {
  try {
    const deleted = kanbanService.deleteProject(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: '找不到專案' });
    }
    
    res.json({ success: true, message: '專案刪除成功' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: '刪除專案失敗' });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/columns:
 *   post:
 *     summary: 在專案中建立新欄位
 *     description: 為指定專案建立新的看板欄位
 *     tags: [Columns]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateColumnRequest'
 *     responses:
 *       201:
 *         description: 欄位建立成功
 */
app.post('/api/projects/:projectId/columns', (req, res) => {
  try {
    const column = kanbanService.createColumn(req.body, req.params.projectId);
    res.status(201).json(column);
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: '建立欄位失敗' });
  }
});

/**
 * @swagger
 * /api/columns/{id}:
 *   put:
 *     summary: 更新欄位資訊
 *     description: 更新欄位的標題和顏色
 *     tags: [Columns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: 欄位更新成功
 */
app.put('/api/columns/:id', (req, res) => {
  try {
    const { title, color } = req.body;
    const updated = kanbanService.updateColumn(req.params.id, { title, color });
    
    if (!updated) {
      return res.status(404).json({ error: '找不到欄位' });
    }
    
    res.json({ success: true, message: '欄位更新成功' });
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: '更新欄位失敗' });
  }
});

/**
 * @swagger
 * /api/columns/{id}:
 *   delete:
 *     summary: 刪除欄位
 *     description: 刪除指定欄位及其所有任務
 *     tags: [Columns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 欄位刪除成功
 *       404:
 *         description: 找不到欄位
 */
app.delete('/api/columns/:id', (req, res) => {
  try {
    const deleted = kanbanService.deleteColumn(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: '找不到欄位' });
    }
    
    res.json({ success: true, message: '欄位刪除成功' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: '刪除欄位失敗' });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/columns/{columnId}/tasks:
 *   post:
 *     summary: 在欄位中建立新任務
 *     description: 為指定欄位建立新任務
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       201:
 *         description: 任務建立成功
 */
app.post('/api/projects/:projectId/columns/:columnId/tasks', (req, res) => {
  try {
    const task = kanbanService.createTask(req.body, req.params.columnId);
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: '建立任務失敗' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: 更新任務資訊
 *     description: 更新任務的所有欄位資訊
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       200:
 *         description: 任務更新成功
 *       404:
 *         description: 找不到任務
 */
app.put('/api/tasks/:id', (req, res) => {
  try {
    const updated = kanbanService.updateTask(req.params.id, req.body);
    
    if (!updated) {
      return res.status(404).json({ error: '找不到任務' });
    }
    
    res.json({ success: true, message: '任務更新成功' });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: '更新任務失敗' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}/move:
 *   patch:
 *     summary: 移動任務到不同欄位
 *     description: 將任務從一個欄位移動到另一個欄位
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               columnId:
 *                 type: string
 *                 description: 目標欄位 ID
 *               newIndex:
 *                 type: integer
 *                 description: 在目標欄位中的新位置（可選）
 *     responses:
 *       200:
 *         description: 任務移動成功
 */
app.patch('/api/tasks/:id/move', (req, res) => {
  try {
    const { columnId, newIndex } = req.body;
    kanbanService.moveTask(req.params.id, columnId, newIndex);
    res.json({ success: true, message: '任務移動成功' });
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ error: '移動任務失敗' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: 刪除任務
 *     description: 刪除指定的任務
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 任務刪除成功
 *       404:
 *         description: 找不到任務
 */
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const deleted = kanbanService.deleteTask(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: '找不到任務' });
    }
    
    res.json({ success: true, message: '任務刪除成功' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: '刪除任務失敗' });
  }
});

/**
 * @swagger
 * /api/columns/{columnId}/tasks/reorder:
 *   patch:
 *     summary: 重新排序欄位內的任務
 *     description: 調整同一欄位內任務的順序
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 重新排序後的任務 ID 陣列
 *     responses:
 *       200:
 *         description: 任務排序更新成功
 */
app.patch('/api/columns/:columnId/tasks/reorder', (req, res) => {
  try {
    const { taskIds } = req.body;
    kanbanService.reorderTasks(req.params.columnId, taskIds);
    res.json({ success: true, message: '任務排序更新成功' });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: '更新任務排序失敗' });
  }
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: API 健康檢查
 *     description: 檢查 API 服務是否正常運作
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API 服務正常
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Kanban API 服務正常運作',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    docs: 'http://localhost:3000/api-docs'
  });
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API 文件: http://localhost:${PORT}/api-docs`);
  console.log(`📄 API 規格: http://localhost:${PORT}/api-docs.json`);
});

export default app;
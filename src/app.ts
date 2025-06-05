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

// Swagger 文件路由
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kanban API 文件',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));

// JSON 格式的 API 規格
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
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
 *         description: 專案唯一識別碼
 *         schema:
 *           type: string
 *           example: proj_123456
 *     responses:
 *       200:
 *         description: 成功取得專案資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: 找不到專案
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 伺服器內部錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     description: 建立一個新的 Kanban 專案
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
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/CreateProjectRequest'
 *                 - type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: 建立專案失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
    console.error('Create project error:', error);
    res.status(500).json({ error: '建立專案失敗' });
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
 *         description: 專案 ID
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
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/CreateColumnRequest'
 *                 - type: object
 *                   properties:
 *                     id:
 *                       type: string
 *       500:
 *         description: 建立欄位失敗
 */
app.post('/api/projects/:projectId/columns', (req, res) => {
  try {
    const column: Omit<Column, 'tasks'> = {
      ...req.body,
      id: generateId()
    };
    
    kanbanService.createColumn(column, req.params.projectId);
    res.status(201).json(column);
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: '建立欄位失敗' });
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
 *         description: 專案 ID
 *         schema:
 *           type: string
 *       - in: path
 *         name: columnId
 *         required: true
 *         description: 欄位 ID
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       500:
 *         description: 建立任務失敗
 */
app.post('/api/projects/:projectId/columns/:columnId/tasks', (req, res) => {
  try {
    const task: Task = {
      ...req.body,
      id: generateId()
    };
    
    kanbanService.createTask(task, req.params.columnId);
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: '建立任務失敗' });
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
 *         description: 任務 ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MoveTaskRequest'
 *     responses:
 *       200:
 *         description: 任務移動成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: 移動任務失敗
 */
app.patch('/api/tasks/:id/move', (req, res) => {
  try {
    const { columnId } = req.body;
    kanbanService.moveTask(req.params.id, columnId);
    res.json({ success: true });
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ error: '移動任務失敗' });
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kanban API 服務正常運作
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
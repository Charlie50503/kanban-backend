// src/config/swagger.config.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Kanban Board API',
    version: '1.0.0',
    description: '簡易 Kanban 專案管理系統 API 文件',
    contact: {
      name: 'API Support',
      email: 'support@kanban.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: '開發環境'
    },
    {
      url: 'https://your-domain.com',
      description: '正式環境'
    }
  ],
  components: {
    schemas: {
      Task: {
        type: 'object',
        required: ['title', 'description', 'assignee', 'dueDate', 'priority'],
        properties: {
          id: {
            type: 'string',
            description: '任務唯一識別碼',
            example: 'task_123456'
          },
          title: {
            type: 'string',
            description: '任務標題',
            example: '實作登入功能'
          },
          description: {
            type: 'string',
            description: '任務描述',
            example: '使用 JWT 實作使用者登入驗證'
          },
          assignee: {
            type: 'string',
            description: '負責人',
            example: 'John Doe'
          },
          dueDate: {
            type: 'string',
            format: 'date',
            description: '截止日期',
            example: '2025-06-15'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: '優先順序',
            example: 'high'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: '標籤列表',
            example: ['frontend', 'auth', 'urgent']
          }
        }
      },
      Column: {
        type: 'object',
        required: ['title', 'color', 'order'],
        properties: {
          id: {
            type: 'string',
            description: '欄位唯一識別碼',
            example: 'col_123456'
          },
          title: {
            type: 'string',
            description: '欄位標題',
            example: '進行中'
          },
          color: {
            type: 'string',
            description: '欄位顏色',
            example: '#FF6B6B'
          },
          order: {
            type: 'integer',
            description: '欄位順序',
            example: 1
          },
          tasks: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Task'
            },
            description: '欄位內的任務列表'
          }
        }
      },
      Project: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          id: {
            type: 'string',
            description: '專案唯一識別碼',
            example: 'proj_123456'
          },
          name: {
            type: 'string',
            description: '專案名稱',
            example: '電商網站開發'
          },
          description: {
            type: 'string',
            description: '專案描述',
            example: '使用 Angular + .NET Core 開發的電商平台'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: '建立時間',
            example: '2025-06-05T10:30:00Z'
          },
          columns: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Column'
            },
            description: '專案欄位列表'
          }
        }
      },
      CreateProjectRequest: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            example: '新專案'
          },
          description: {
            type: 'string',
            example: '專案描述'
          }
        }
      },
      CreateTaskRequest: {
        type: 'object',
        required: ['title', 'description', 'assignee', 'dueDate', 'priority'],
        properties: {
          title: {
            type: 'string',
            example: '新任務'
          },
          description: {
            type: 'string',
            example: '任務描述'
          },
          assignee: {
            type: 'string',
            example: 'John Doe'
          },
          dueDate: {
            type: 'string',
            format: 'date',
            example: '2025-06-15'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            example: 'medium'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['frontend', 'feature']
          }
        }
      },
      CreateColumnRequest: {
        type: 'object',
        required: ['title', 'color', 'order'],
        properties: {
          title: {
            type: 'string',
            example: '待辦事項'
          },
          color: {
            type: 'string',
            example: '#4ECDC4'
          },
          order: {
            type: 'integer',
            example: 0
          }
        }
      },
      MoveTaskRequest: {
        type: 'object',
        required: ['columnId'],
        properties: {
          columnId: {
            type: 'string',
            description: '目標欄位 ID',
            example: 'col_654321'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: '錯誤訊息'
          }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          }
        }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/app.ts'], // 指定要掃描的檔案路徑
};

export const swaggerSpec = swaggerJsdoc(options);
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Compliant4 API Documentation',
      version: '1.0.0',
      description: 'Full-stack insurance tracking application for General Contractors and their subcontractors',
      contact: {
        name: 'API Support',
        url: 'https://compliant.team',
      },
      license: {
        name: 'Private',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: '{protocol}://{host}',
        description: 'Dynamic server',
        variables: {
          protocol: {
            default: 'https',
            enum: ['http', 'https'],
          },
          host: {
            default: 'api.compliant.team',
            description: 'API hostname',
          },
        },
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'degraded', 'error'],
              description: 'Overall health status',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Current server timestamp',
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user identifier',
            },
            username: {
              type: 'string',
              description: 'Username for login',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'admin', 'user', 'contractor', 'subcontractor'],
              description: 'User role',
            },
          },
        },
        Contractor: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            company_name: {
              type: 'string',
              description: 'Company name',
            },
            contractor_type: {
              type: 'string',
              enum: ['general_contractor', 'subcontractor'],
            },
            email: {
              type: 'string',
              format: 'email',
            },
            phone: {
              type: 'string',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            name: {
              type: 'string',
              description: 'Project name',
            },
            contractor_id: {
              type: 'string',
              description: 'General contractor ID',
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'on_hold', 'cancelled'],
            },
            budget: {
              type: 'number',
              description: 'Project budget',
            },
            start_date: {
              type: 'string',
              format: 'date',
            },
            end_date: {
              type: 'string',
              format: 'date',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints',
      },
      {
        name: 'Health',
        description: 'System health and monitoring',
      },
      {
        name: 'Users',
        description: 'User management',
      },
      {
        name: 'Contractors',
        description: 'Contractor management',
      },
      {
        name: 'Projects',
        description: 'Project management',
      },
      {
        name: 'Entities',
        description: 'Generic entity CRUD operations',
      },
    ],
  },
  apis: [
    './routes/*.js',
    './server.js',
    './middleware/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

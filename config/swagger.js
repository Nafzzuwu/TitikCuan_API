const swaggerJsdoc =
  require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',

    info: {
      title: 'TitikCuan API',
      version: '1.0.0',
      description:
        'REST API for TitikCuan'
    },

    servers: [
      {
        url:
          'http://localhost:5000',
        description:
          'Local Server'
      }
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },

    security: [
      {
        bearerAuth: []
      }
    ]
  },

  apis: [
    './routes/*.js'
  ]
};

const swaggerSpec =
  swaggerJsdoc(options);

module.exports = swaggerSpec;
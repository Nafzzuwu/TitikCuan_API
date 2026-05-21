require('dotenv').config();
const express = require('express');
const cors = require('cors');

const productRoutes =
  require('./routes/products');

const authRoutes =
  require('./routes/auth');

const swaggerUi =
  require('swagger-ui-express');

const swaggerSpec =
  require('./config/swagger');

const transactionRoutes =
  require('./routes/transactions');

const dashboardRoutes =
  require('./routes/dashboard');

const heatmapRoutes =
  require('./routes/heatmap');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const pool = require('./config/db');


// Root endpoint
app.get('/', (req, res) => {
  res.send(
    'TitikCuan API Running'
  );
});

// Test database connection
app.get(
  '/test-db',
  async (req, res) => {
    try {
      const result =
        await pool.query(
          'SELECT NOW()'
        );

      res.json(
        result.rows
      );
    } catch (err) {
      res.status(500).json({
        error:
          err.message
      });
    }
  }
);

// Routes
app.use(
  '/products',
  productRoutes
);

app.use(
  '/transactions',
  transactionRoutes
);

app.use(
  '/dashboard',
  dashboardRoutes
);

app.use(
  '/heatmap',
  heatmapRoutes
);

app.use(
  '/auth',
  authRoutes
);

// SWAGGER
const swaggerOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js'
  ]
};

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerOptions)
);

app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

// Server listen
const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});

module.exports = app;
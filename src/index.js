
import express from 'express';
import cors from 'cors';
import { httpServerHandler } from 'cloudflare:node';

import productsRouter from './routes/products.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'royal-spares'
  });
});

// Product routes
app.use('/products', productsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

// Cloudflare Workers HTTP server
app.listen(3000);

export default httpServerHandler({ port: 3000 });

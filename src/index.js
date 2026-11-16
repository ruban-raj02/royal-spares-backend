import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import productsRouter from './routes/products.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/products', productsRouter);

app.use((_, res) => res.status(404).json({ error: 'Not found' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 API on http://localhost:${port}`));

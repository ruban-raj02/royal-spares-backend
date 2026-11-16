import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ total: count, limit, offset, data });
});

router.get('/search/:q', async (req, res) => {
  const q = String(req.params.q || '').trim();
  if (!q) return res.json({ data: [] });

  const { data, error } = await supabase
    .from('products')
    .select('id, name, oem_ref, pricing, images')
    .or(`name.ilike.%${q}%,oem_ref.ilike.%${q}%`)
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

export default router;

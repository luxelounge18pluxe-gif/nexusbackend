const express = require('express');
const router = express.Router();
const { readJson, writeJson, TOOLS_FILE } = require('../config/database');

function getTools() {
  return readJson(TOOLS_FILE);
}

function saveTools(tools) {
  writeJson(TOOLS_FILE, tools);
}

router.get('/', (req, res) => {
  res.json(getTools());
});

router.get('/:id', (req, res) => {
  const tools = getTools();
  const tool = tools.find((item) => String(item.id) === String(req.params.id));
  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }
  res.json(tool);
});

router.post('/', (req, res) => {
  const body = req.body || {};
  if (!body.name) {
    return res.status(400).json({ error: 'Tool name is required' });
  }

  const tools = getTools();
  const tool = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: body.name,
    description: body.description || '',
    price: body.price || 0,
    tags: Array.isArray(body.tags) ? body.tags : [],
    createdAt: new Date().toISOString(),
  };

  tools.push(tool);
  saveTools(tools);
  res.status(201).json(tool);
});

router.put('/:id', (req, res) => {
  const tools = getTools();
  const index = tools.findIndex((item) => String(item.id) === String(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  tools[index] = { ...tools[index], ...req.body };
  saveTools(tools);
  res.json(tools[index]);
});

router.delete('/:id', (req, res) => {
  const tools = getTools();
  const index = tools.findIndex((item) => String(item.id) === String(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  const [removed] = tools.splice(index, 1);
  saveTools(tools);
  res.json(removed);
});

module.exports = router;

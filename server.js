require('dotenv').config()
const express = require('express')
const cors = require('cors')
const db = require('./db')

const app = express()

const allowedOrigins = [
  'https://tagonlink-frontend.vercel.app', // 🔹 substitua após deploy do front
  'http://localhost:3000',
]

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
)

app.use(express.json())

function isValidUrl(str) {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

app.get('/', (req, res) =>
  res.send('✅ Backend TAGONLINK rodando com sucesso!')
)

app.get('/api/links', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM links ORDER BY created_at DESC'
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar links.' })
  }
})

app.post('/api/links', async (req, res) => {
  const { title, url, description = '', tags = '' } = req.body
  if (!title || !url)
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })
  if (!isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' })

  try {
    const result = await db.query(
      'INSERT INTO links (title, url, description, tags) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, url, description, tags]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar link.' })
  }
})

app.put('/api/links/:id', async (req, res) => {
  const { id } = req.params
  const { title, url, description = '', tags = '' } = req.body

  if (!title || !url)
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })

  try {
    const result = await db.query(
      'UPDATE links SET title=$1, url=$2, description=$3, tags=$4 WHERE id=$5 RETURNING *',
      [title, url, description, tags, id]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Link não encontrado.' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar link.' })
  }
})

app.delete('/api/links/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await db.query('DELETE FROM links WHERE id=$1', [id])
    if (result.rowCount === 0)
      return res.status(404).json({ error: 'Link não encontrado.' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao deletar link.' })
  }
})

// Configuração para Vercel
if (process.env.VERCEL) {
  module.exports = app
} else {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () =>
    console.log(`Servidor rodando em http://localhost:${PORT}`)
  )
}

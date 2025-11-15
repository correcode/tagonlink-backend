require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const db = require('./db')
const { generateToken, authenticateToken } = require('./auth')

const app = express()

const isAllowedOrigin = (origin) => {
  if (!origin) return true

  const allowedPatterns = [
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.vercel\.app\/.*$/,
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ]

  return allowedPatterns.some((pattern) => pattern.test(origin))
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
      } else {
        callback(null, true)
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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

app.get('/', (req, res) => {
  res.json({
    message: '✅ Backend TAGONLINK rodando com sucesso!',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1')

    const tablesCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'links')
    `)

    const tables = tablesCheck.rows.map((r) => r.table_name)
    const missingTables = ['users', 'links'].filter((t) => !tables.includes(t))

    res.json({
      status: 'ok',
      database: 'connected',
      tables: {
        users: tables.includes('users'),
        links: tables.includes('links'),
        missing: missingTables,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: 'Não foi possível conectar ao banco de dados',
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ error: 'Email, senha e nome são obrigatórios.' })
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: 'Senha deve ter no mínimo 6 caracteres.' })
  }

  try {
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await db.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    )

    const user = result.rows[0]
    const token = generateToken(user.id)

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar usuário.' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' })
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [
      email,
    ])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' })
    }

    const token = generateToken(user.id)
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao fazer login.' })
  }
})

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório.' })
  }

  try {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [
      email,
    ])
    if (result.rows.length === 0) {
      return res.json({
        message: 'Se o email existir, um link de recuperação será enviado.',
      })
    }

    const resetToken = generateToken(result.rows[0].id)

    res.json({ message: 'Link de recuperação enviado para seu email.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao processar solicitação.' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: 'Token e nova senha são obrigatórios.' })
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: 'Senha deve ter no mínimo 6 caracteres.' })
  }

  try {
    const { verifyToken } = require('./auth')
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [
      hashedPassword,
      decoded.userId,
    ])

    res.json({ message: 'Senha alterada com sucesso.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao resetar senha.' })
  }
})

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' })
    }
    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao verificar token.' })
  }
})

app.get('/api/links', authenticateToken, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' })
  }

  try {
    const result = await db.query(
      'SELECT * FROM links WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Erro ao buscar links:', err)
    console.error('Detalhes:', {
      message: err.message,
      code: err.code,
      userId: req.userId,
    })
    res.status(500).json({
      error: 'Erro ao buscar links.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

app.post('/api/links', authenticateToken, async (req, res) => {
  const { title, url, description = '', tags = '' } = req.body

  if (!title || !url) {
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida.' })
  }

  if (!req.userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' })
  }

  try {
    const result = await db.query(
      'INSERT INTO links (title, url, description, tags, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, url, description || null, tags || null, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Link não foi criado.' })
    }

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Erro ao salvar link:', err)
    console.error('Detalhes:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      userId: req.userId,
      data: { title, url, description, tags },
    })

    if (err.code === '23503') {
      return res
        .status(400)
        .json({ error: 'Usuário não encontrado. Faça login novamente.' })
    }

    const errorResponse = {
      error: 'Erro ao salvar link.',
    }

    if (err.code === '42P01') {
      errorResponse.error =
        'Tabela não encontrada. Execute o script schema.sql no banco de dados.'
      errorResponse.code = 'TABLE_NOT_FOUND'
    } else if (err.code === '23503') {
      errorResponse.error = 'Usuário não encontrado. Faça login novamente.'
      errorResponse.code = 'FOREIGN_KEY_VIOLATION'
    } else if (err.code === '23505') {
      errorResponse.error = 'Link duplicado.'
      errorResponse.code = 'UNIQUE_VIOLATION'
    } else if (err.message) {
      errorResponse.details = err.message
      errorResponse.code = err.code || 'UNKNOWN_ERROR'
    }

    res.status(500).json(errorResponse)
  }
})

app.put('/api/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  const { title, url, description = '', tags = '' } = req.body

  if (!title || !url)
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })

  try {
    const checkResult = await db.query(
      'SELECT user_id FROM links WHERE id = $1',
      [id]
    )
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link não encontrado.' })
    }
    if (checkResult.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado.' })
    }

    const result = await db.query(
      'UPDATE links SET title=$1, url=$2, description=$3, tags=$4 WHERE id=$5 AND user_id=$6 RETURNING *',
      [title, url, description, tags, id, req.userId]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Link não encontrado.' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar link.' })
  }
})

app.delete('/api/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  try {
    const result = await db.query(
      'DELETE FROM links WHERE id=$1 AND user_id=$2',
      [id, req.userId]
    )
    if (result.rowCount === 0)
      return res.status(404).json({ error: 'Link não encontrado.' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao deletar link.' })
  }
})

if (process.env.VERCEL) {
  module.exports = app
} else {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () =>
    console.log(`Servidor rodando em http://localhost:${PORT}`)
  )
}

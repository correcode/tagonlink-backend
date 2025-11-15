require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const db = require('./db')
const { generateToken, authenticateToken } = require('./auth')

const app = express()

// Função para verificar origem permitida
const isAllowedOrigin = (origin) => {
  if (!origin) return true // Permitir requisições sem origin (Postman, etc)

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
        callback(null, true) // Permitir todas as origens em desenvolvimento
        // Em produção, você pode querer ser mais restritivo:
        // callback(new Error('Not allowed by CORS'))
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

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await db.query('SELECT 1')
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: 'Não foi possível conectar ao banco de dados',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// ========== AUTENTICAÇÃO ==========

// Registro de usuário
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
    // Verificar se usuário já existe
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado.' })
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar usuário
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

// Login
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

// Reset de senha - solicitar
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
      // Por segurança, não revelar se o email existe ou não
      return res.json({
        message: 'Se o email existir, um link de recuperação será enviado.',
      })
    }

    // Gerar token de reset (simplificado - em produção usar token único e expiração)
    const resetToken = generateToken(result.rows[0].id)

    // Em produção, enviar email com link de reset
    // Por enquanto, retornamos o token (em produção, não fazer isso)
    res.json({ message: 'Link de recuperação enviado para seu email.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao processar solicitação.' })
  }
})

// Reset de senha - confirmar
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

// Verificar token
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

// ========== LINKS (protegidos) ==========

app.get('/api/links', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM links WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar links.' })
  }
})

app.post('/api/links', authenticateToken, async (req, res) => {
  const { title, url, description = '', tags = '' } = req.body
  if (!title || !url)
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })
  if (!isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' })

  try {
    const result = await db.query(
      'INSERT INTO links (title, url, description, tags, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, url, description, tags, req.userId]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar link.' })
  }
})

app.put('/api/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  const { title, url, description = '', tags = '' } = req.body

  if (!title || !url)
    return res.status(400).json({ error: 'Título e URL são obrigatórios.' })

  try {
    // Verificar se o link pertence ao usuário
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

// Configuração para Vercel
if (process.env.VERCEL) {
  module.exports = app
} else {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () =>
    console.log(`Servidor rodando em http://localhost:${PORT}`)
  )
}

const jwt = require('jsonwebtoken')

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' })
  }

  req.userId = decoded.userId
  next()
}

module.exports = { generateToken, verifyToken, authenticateToken }

require('dotenv').config()
const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  console.error(
    '❌ ERRO: DATABASE_URL não está definida nas variáveis de ambiente!'
  )
  console.error(
    'Configure a variável DATABASE_URL no Vercel ou no arquivo .env'
  )
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err)
})

pool.on('connect', () => {
  console.log('✅ Conectado ao banco de dados PostgreSQL')
})

async function query(text, params) {
  try {
    const result = await pool.query(text, params)
    return result
  } catch (error) {
    console.error('❌ Erro na query:', error.message)
    console.error('Query:', text)
    throw error
  }
}

module.exports = { query, pool }

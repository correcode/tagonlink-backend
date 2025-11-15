require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada!')
  console.error(
    'Configure a variável DATABASE_URL no arquivo .env ou nas variáveis de ambiente'
  )
  process.exit(1)
}

const urlParts = new URL(connectionString)
console.log('🔍 Testando conexão com o banco de dados...')
console.log('📍 Host:', urlParts.hostname)
console.log('📊 Database:', urlParts.pathname.replace('/', ''))
console.log()

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
})

async function testConnection() {
  try {
    console.log('1️⃣ Testando conexão básica...')
    const result = await pool.query(
      'SELECT NOW() as current_time, version() as pg_version'
    )
    console.log('✅ Conexão estabelecida com sucesso!')
    console.log('   Hora do servidor:', result.rows[0].current_time)
    console.log(
      '   PostgreSQL:',
      result.rows[0].pg_version.split(' ')[0] +
        ' ' +
        result.rows[0].pg_version.split(' ')[1]
    )
    console.log()

    console.log('2️⃣ Verificando tabelas...')
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r) => r.table_name)
    console.log(
      '   Tabelas encontradas:',
      tables.length > 0 ? tables.join(', ') : 'Nenhuma'
    )

    const requiredTables = ['users', 'links']
    const missingTables = requiredTables.filter((t) => !tables.includes(t))

    if (missingTables.length > 0) {
      console.log('⚠️  Tabelas faltando:', missingTables.join(', '))
      console.log('   Execute o script schema.sql para criar as tabelas')
    } else {
      console.log('✅ Todas as tabelas necessárias existem!')
    }
    console.log()

    if (tables.includes('users')) {
      console.log('3️⃣ Verificando estrutura da tabela users...')
      const usersColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `)
      console.log(
        '   Colunas:',
        usersColumns.rows
          .map((c) => `${c.column_name} (${c.data_type})`)
          .join(', ')
      )

      const userCount = await pool.query('SELECT COUNT(*) as count FROM users')
      console.log('   Registros:', userCount.rows[0].count)
      console.log()
    }

    if (tables.includes('links')) {
      console.log('4️⃣ Verificando estrutura da tabela links...')
      const linksColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'links'
        ORDER BY ordinal_position
      `)
      console.log(
        '   Colunas:',
        linksColumns.rows
          .map((c) => `${c.column_name} (${c.data_type})`)
          .join(', ')
      )

      const linkCount = await pool.query('SELECT COUNT(*) as count FROM links')
      console.log('   Registros:', linkCount.rows[0].count)
      console.log()
    }

    console.log('5️⃣ Verificando índices...')
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'links')
    `)
    console.log(
      '   Índices encontrados:',
      indexes.rows.length > 0
        ? indexes.rows.map((i) => i.indexname).join(', ')
        : 'Nenhum'
    )
    console.log()

    console.log('✅ Todos os testes passaram!')
    console.log('🎉 Banco de dados está pronto para uso!')

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro ao testar conexão:')
    console.error('   Mensagem:', error.message)
    console.error('   Código:', error.code)
    if (error.detail) {
      console.error('   Detalhes:', error.detail)
    }
    await pool.end()
    process.exit(1)
  }
}

testConnection()

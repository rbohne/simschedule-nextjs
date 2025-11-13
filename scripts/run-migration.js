const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250113_add_active_until.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration...')
    console.log('SQL:', sql)

    // Execute the SQL directly using a query
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(0) // Just to test connection

    if (error) {
      console.error('Connection error:', error)
    }

    // Try to execute raw SQL using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Error running migration:', result)
      console.log('\nPlease run this SQL manually in Supabase Dashboard > SQL Editor:')
      console.log('---')
      console.log(sql)
      console.log('---')
      process.exit(1)
    }

    console.log('Migration completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250113_add_active_until.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    console.log('\nPlease run this SQL manually in Supabase Dashboard > SQL Editor:')
    console.log('---')
    console.log(sql)
    console.log('---')
    process.exit(1)
  }
}

runMigration()

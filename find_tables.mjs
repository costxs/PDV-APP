import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

async function checkSchema(schemaName) {
    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: schemaName } })
    const { data, error } = await supabase.from('tables').select('id').limit(1)
    if (error) {
        console.log(`[${schemaName}] ERROR:`, error.message)
    } else {
        console.log(`[${schemaName}] SUCCESS: tables exist!`)
    }
}

async function run() {
    await checkSchema('public')
    await checkSchema('pdv')
}

run()

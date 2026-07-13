import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
    const { data: roles } = await supabase.from('roles').select('*')
    const { data: classes } = await supabase.from('classes').select('*')
    fs.writeFileSync('check_data.json', JSON.stringify({ roles, classes }, null, 2))
    process.exit(0)
}
run()

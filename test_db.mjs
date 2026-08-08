import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const schema = process.env.EXPO_PUBLIC_SUPABASE_SCHEMA || 'pdv'

console.log('URL:', supabaseUrl)
console.log('Schema:', schema)

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema }
})

async function test() {
    console.log('\n--- 1. TABLES ---')
    const { data: tables, error: tErr } = await supabase.from('tables').select('*').limit(3)
    console.log('tables:', tErr ? `ERROR: ${tErr.message} (${tErr.code})` : tables)

    console.log('\n--- 2. CATEGORIES ---')
    const { data: cats, error: cErr } = await supabase.from('categories').select('*').limit(3)
    console.log('categories:', cErr ? `ERROR: ${cErr.message} (${cErr.code})` : cats)

    console.log('\n--- 3. PRODUCTS ---')
    const { data: prods, error: pErr } = await supabase.from('products').select('*').limit(3)
    console.log('products:', pErr ? `ERROR: ${pErr.message} (${pErr.code})` : prods)

    console.log('\n--- 4. ORDERS ---')
    const { data: orders, error: oErr } = await supabase.from('orders').select('*').limit(3)
    console.log('orders:', oErr ? `ERROR: ${oErr.message} (${oErr.code})` : orders)

    console.log('\n--- 5. ORDER_ITEMS ---')
    const { data: items, error: iErr } = await supabase.from('order_items').select('*').limit(3)
    console.log('order_items:', iErr ? `ERROR: ${iErr.message} (${iErr.code})` : items)

    // Test INSERT into orders if tables exist
    if (tables && tables.length > 0) {
        console.log('\n--- 6. TEST INSERT ORDER ---')
        const { data: newOrder, error: insertErr } = await supabase
            .from('orders')
            .insert({ table_id: tables[0].id, status: 'pending', total: 0 })
            .select()
            .single()
        console.log('insert order:', insertErr ? `ERROR: ${insertErr.message} (${insertErr.code})` : newOrder)

        // cleanup
        if (newOrder) {
            await supabase.from('orders').delete().eq('id', newOrder.id)
            console.log('cleanup: deleted test order')
        }
    }
}

test()

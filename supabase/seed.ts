import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log('Seeding MishiMenu test data…')

  // ── Restaurant ────────────────────────────────────────────
  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .upsert({
      slug: 'la-esquina-cuencana',
      name: 'La Esquina Cuencana',
      address: 'Calle Larga 123, Cuenca',
      phone: '+593 7 123 4567',
      ruc: '0190123456001',
      deuna_account_name: 'La Esquina Cuencana',
      deuna_qr_url: null, // upload a real QR via Supabase Storage
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (rErr) { console.error('Restaurant error:', rErr); process.exit(1) }
  console.log('✓ Restaurant:', restaurant!.id)

  // ── Categories ────────────────────────────────────────────
  const categoryData = [
    { name: 'Platos fuertes', sort_order: 1 },
    { name: 'Sopas',          sort_order: 2 },
    { name: 'Bebidas',        sort_order: 3 },
    { name: 'Postres',        sort_order: 4 },
  ]

  const { data: categories, error: cErr } = await supabase
    .from('categories')
    .upsert(
      categoryData.map(c => ({ ...c, restaurant_id: restaurant!.id })),
      { onConflict: 'restaurant_id,name' }
    )
    .select()

  if (cErr) { console.error('Categories error:', cErr); process.exit(1) }

  const catId = (name: string) => categories!.find(c => c.name === name)!.id
  console.log('✓ Categories:', categories!.length)

  // ── Menu items ────────────────────────────────────────────
  const items = [
    { name: 'Seco de pollo',       description: 'Pollo guisado con arroz y ensalada', price: 5.50, emoji: '🍗', category: 'Platos fuertes', sort_order: 1 },
    { name: 'Lomo saltado',        description: 'Tiras de lomo con papas y arroz',    price: 7.00, emoji: '🥩', category: 'Platos fuertes', sort_order: 2 },
    { name: 'Tilapia frita',       description: 'Con menestra y patacones',           price: 6.50, emoji: '🐟', category: 'Platos fuertes', sort_order: 3 },
    { name: 'Caldo de gallina',    description: 'Tradicional caldo cuencano',        price: 3.50, emoji: '🍲', category: 'Sopas',          sort_order: 1 },
    { name: 'Locro de papa',       description: 'Con aguacate y queso',              price: 3.00, emoji: '🥣', category: 'Sopas',          sort_order: 2 },
    { name: 'Jugo natural',        description: 'Naranja, mora o maracuyá',          price: 1.25, emoji: '🧃', category: 'Bebidas',        sort_order: 1 },
    { name: 'Agua',                description: 'Botella 500ml',                     price: 0.75, emoji: '💧', category: 'Bebidas',        sort_order: 2 },
    { name: 'Gaseosa',             description: 'Lata 350ml',                        price: 1.00, emoji: '🥤', category: 'Bebidas',        sort_order: 3 },
    { name: 'Dulce de higos',      description: 'Tradicional postre cuencano',       price: 2.00, emoji: '🍮', category: 'Postres',        sort_order: 1 },
  ]

  const { error: iErr } = await supabase
    .from('menu_items')
    .upsert(
      items.map(({ category, ...item }) => ({
        ...item,
        restaurant_id: restaurant!.id,
        category_id: catId(category),
      })),
      { onConflict: 'restaurant_id,name' }
    )

  if (iErr) { console.error('Menu items error:', iErr); process.exit(1) }
  console.log('✓ Menu items:', items.length)

  // ── Second restaurant (for multi-tenant isolation test) ───
  const { data: r2, error: r2Err } = await supabase
    .from('restaurants')
    .upsert({
      slug: 'el-rincon-guayaquil',
      name: 'El Rincón Guayaquileño',
      address: 'Av. 9 de Octubre 456, Guayaquil',
      ruc: '0901234567001',
      deuna_account_name: 'El Rincón Guayaquileño',
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (r2Err) { console.error('Restaurant 2 error:', r2Err); process.exit(1) }

  const { data: cat2 } = await supabase
    .from('categories')
    .upsert([{ name: 'Platos', sort_order: 1, restaurant_id: r2!.id }], { onConflict: 'restaurant_id,name' })
    .select()
    .single()

  await supabase.from('menu_items').upsert([
    { name: 'Arroz con menestra', price: 4.50, emoji: '🍛', restaurant_id: r2!.id, category_id: cat2!.id, sort_order: 1 },
    { name: 'Ceviche',           price: 5.00, emoji: '🦐', restaurant_id: r2!.id, category_id: cat2!.id, sort_order: 2 },
  ], { onConflict: 'restaurant_id,name' })

  console.log('✓ Restaurant 2:', r2!.slug)
  console.log('\nSeed complete. Visit /r/la-esquina-cuencana to test.')
}

seed().catch(err => { console.error(err); process.exit(1) })

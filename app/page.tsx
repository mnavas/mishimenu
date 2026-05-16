import { createServiceClient } from '@/lib/supabase/server'
import { getRestaurant } from '@/lib/restaurant'
import MenuScreen from '@/components/menu/MenuScreen'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const restaurant = await getRestaurant()
  const supabase = createServiceClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('available', true)
    .order('sort_order')

  return (
    <MenuScreen
      restaurant={restaurant}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
    />
  )
}

import {
  Utensils, GlassWater, Cookie, Sparkles, Wheat, Package, IceCreamCone, Popcorn, Soup, Cigarette, Milk, Egg,
  Scroll, SoapDispenserDroplet, Droplets, WashingMachine, SprayCan, Brush, Droplet, Candy, Snowflake,
  Coffee, CupSoda, BottleWine, CookingPot, Beef, Drumstick, Fish, Leaf, Apple, Croissant, Cake,
  Smartphone, Battery, Lightbulb, Pencil, Book, Gamepad2, Pill, Baby, ShoppingBag, Gift, Archive,
  Shapes, Tag, Heart, Star, Shirt, Footprints, Flame, Fuel,
} from 'lucide-react'

export type CategoryVisual = {
  icon: React.ElementType
  label: string
  headerBg: string
  badgeBg: string
  badgeColor: string
  badgeBorder: string
  iconBg: string
  iconColor: string
  iconBorder: string
  cardBorder: string
}

const warmVisuals: Record<string, CategoryVisual> = {
  makanan: {
    icon: Utensils,
    label: 'Makanan',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,107,53,0.18), transparent 60%), linear-gradient(180deg, rgba(255,107,53,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,107,53,0.14)',
    badgeColor: '#ff8c42',
    badgeBorder: 'rgba(255,107,53,0.22)',
    iconBg: 'rgba(255,107,53,0.14)',
    iconColor: '#ff6b35',
    iconBorder: 'rgba(255,107,53,0.22)',
    cardBorder: 'rgba(255,107,53,0.10)',
  },
  minuman: {
    icon: GlassWater,
    label: 'Minuman',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,140,66,0.16), transparent 60%), linear-gradient(180deg, rgba(255,140,66,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,140,66,0.14)',
    badgeColor: '#ffb86a',
    badgeBorder: 'rgba(255,140,66,0.22)',
    iconBg: 'rgba(255,140,66,0.14)',
    iconColor: '#ff8c42',
    iconBorder: 'rgba(255,140,66,0.22)',
    cardBorder: 'rgba(255,140,66,0.10)',
  },
  snack: {
    icon: Cookie,
    label: 'Snack',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(232,93,39,0.16), transparent 60%), linear-gradient(180deg, rgba(232,93,39,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(232,93,39,0.14)',
    badgeColor: '#ff9f6e',
    badgeBorder: 'rgba(232,93,39,0.22)',
    iconBg: 'rgba(232,93,39,0.14)',
    iconColor: '#e85d27',
    iconBorder: 'rgba(232,93,39,0.22)',
    cardBorder: 'rgba(232,93,39,0.10)',
  },
  beras: {
    icon: Wheat,
    label: 'Beras',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(217,175,125,0.18), transparent 60%), linear-gradient(180deg, rgba(217,175,125,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(217,175,125,0.14)',
    badgeColor: '#d9af7d',
    badgeBorder: 'rgba(217,175,125,0.22)',
    iconBg: 'rgba(217,175,125,0.14)',
    iconColor: '#d9af7d',
    iconBorder: 'rgba(217,175,125,0.22)',
    cardBorder: 'rgba(217,175,125,0.10)',
  },
  dus: {
    icon: Package,
    label: 'Dus',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(168,139,116,0.18), transparent 60%), linear-gradient(180deg, rgba(168,139,116,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(168,139,116,0.14)',
    badgeColor: '#a88b74',
    badgeBorder: 'rgba(168,139,116,0.22)',
    iconBg: 'rgba(168,139,116,0.14)',
    iconColor: '#a88b74',
    iconBorder: 'rgba(168,139,116,0.22)',
    cardBorder: 'rgba(168,139,116,0.10)',
  },
  'ice cream': {
    icon: IceCreamCone,
    label: 'Ice Cream',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,183,197,0.16), transparent 60%), linear-gradient(180deg, rgba(255,183,197,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,183,197,0.14)',
    badgeColor: '#ffb7c5',
    badgeBorder: 'rgba(255,183,197,0.22)',
    iconBg: 'rgba(255,183,197,0.14)',
    iconColor: '#ffb7c5',
    iconBorder: 'rgba(255,183,197,0.22)',
    cardBorder: 'rgba(255,183,197,0.10)',
  },
  jajanan: {
    icon: Popcorn,
    label: 'Jajanan',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,200,100,0.16), transparent 60%), linear-gradient(180deg, rgba(255,200,100,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,200,100,0.14)',
    badgeColor: '#ffc864',
    badgeBorder: 'rgba(255,200,100,0.22)',
    iconBg: 'rgba(255,200,100,0.14)',
    iconColor: '#ffc864',
    iconBorder: 'rgba(255,200,100,0.22)',
    cardBorder: 'rgba(255,200,100,0.10)',
  },
  mie: {
    icon: Soup,
    label: 'Mie',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,160,80,0.18), transparent 60%), linear-gradient(180deg, rgba(255,160,80,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,160,80,0.14)',
    badgeColor: '#ffa050',
    badgeBorder: 'rgba(255,160,80,0.22)',
    iconBg: 'rgba(255,160,80,0.14)',
    iconColor: '#ffa050',
    iconBorder: 'rgba(255,160,80,0.22)',
    cardBorder: 'rgba(255,160,80,0.10)',
  },
  rokok: {
    icon: Cigarette,
    label: 'Rokok',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(180,160,140,0.16), transparent 60%), linear-gradient(180deg, rgba(180,160,140,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(180,160,140,0.14)',
    badgeColor: '#b4a08c',
    badgeBorder: 'rgba(180,160,140,0.22)',
    iconBg: 'rgba(180,160,140,0.14)',
    iconColor: '#b4a08c',
    iconBorder: 'rgba(180,160,140,0.22)',
    cardBorder: 'rgba(180,160,140,0.10)',
  },
  susu: {
    icon: Milk,
    label: 'Susu',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(245,235,220,0.16), transparent 60%), linear-gradient(180deg, rgba(245,235,220,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(245,235,220,0.14)',
    badgeColor: '#f5ebdc',
    badgeBorder: 'rgba(245,235,220,0.22)',
    iconBg: 'rgba(245,235,220,0.14)',
    iconColor: '#f5ebdc',
    iconBorder: 'rgba(245,235,220,0.22)',
    cardBorder: 'rgba(245,235,220,0.10)',
  },
  telur: {
    icon: Egg,
    label: 'Telur',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,220,150,0.18), transparent 60%), linear-gradient(180deg, rgba(255,220,150,0.10), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,220,150,0.14)',
    badgeColor: '#ffdc96',
    badgeBorder: 'rgba(255,220,150,0.22)',
    iconBg: 'rgba(255,220,150,0.14)',
    iconColor: '#ffdc96',
    iconBorder: 'rgba(255,220,150,0.22)',
    cardBorder: 'rgba(255,220,150,0.10)',
  },
  lainnya: {
    icon: Sparkles,
    label: 'Lainnya',
    headerBg: 'radial-gradient(520px 220px at 30% 0%, rgba(255,184,106,0.14), transparent 60%), linear-gradient(180deg, rgba(255,184,106,0.08), rgba(36,26,19,0))',
    badgeBg: 'rgba(255,184,106,0.14)',
    badgeColor: '#ffd6a8',
    badgeBorder: 'rgba(255,184,106,0.20)',
    iconBg: 'rgba(255,184,106,0.14)',
    iconColor: '#ffb86a',
    iconBorder: 'rgba(255,184,106,0.20)',
    cardBorder: 'rgba(255,184,106,0.10)',
  },
}

// Warm palette for auto-generated categories (stays in warm espresso theme)
const warmPalette = [
  '#ff6b35', '#ff8c42', '#e85d27', '#ffb86a', '#ff9f6e', '#ffa050',
  '#d9af7d', '#ffc864', '#ffdc96', '#b4a08c', '#c9ab9a', '#f5ebdc',
  '#ffb7c5', '#ffd6a8', '#ff7e67', '#a88b74',
]

const fallbackIcons: React.ElementType[] = [
  Tag, Gift, Archive, Shapes, Heart, Star, Shirt, Footprints, Baby, Gamepad2, Lightbulb, Battery,
]

// Keyword -> icon map. Order matters: more specific first. Covers auto icon for new categories like "tisu".
const keywordIconMap: { keywords: string[]; icon: React.ElementType }[] = [
  // explicit original (keep priority)
  { keywords: ['ice cream', 'es krim', 'eskrim'], icon: IceCreamCone },
  { keywords: ['makanan'], icon: Utensils },
  { keywords: ['minuman'], icon: GlassWater },
  { keywords: ['snack', 'camilan'], icon: Cookie },
  { keywords: ['beras', 'padi'], icon: Wheat },
  { keywords: ['dus', 'kardus', 'box', 'karton'], icon: Package },
  { keywords: ['jajanan'], icon: Popcorn },
  { keywords: ['mie', 'noodle', 'indomie', 'bakmi'], icon: Soup },
  { keywords: ['rokok', 'cigarette', 'vape'], icon: Cigarette },
  { keywords: ['susu', 'milk'], icon: Milk },
  { keywords: ['telur', 'telor', 'egg'], icon: Egg },
  // new auto — tisu and common minimarket categories
  { keywords: ['tisu', 'tissue', 'toilet'], icon: Scroll },
  { keywords: ['sabun', 'soap'], icon: SoapDispenserDroplet },
  { keywords: ['sampo', 'shampoo', 'conditioner', 'dove', 'clear'], icon: Droplets },
  { keywords: ['deterjen', 'detergen', 'rinso', 'daia', 'soklin', 'attack'], icon: WashingMachine },
  { keywords: ['pembersih', 'cleaner', 'karbol', 'wipol', 'pewangi', 'superpell'], icon: SprayCan },
  { keywords: ['odol', 'pasta gigi', 'pepsodent', 'sikat gigi'], icon: Brush },
  { keywords: ['sikat', 'brush'], icon: Brush },
  { keywords: ['minyak', 'oil', 'bimoli', 'filma', 'tropical'], icon: Droplet },
  { keywords: ['gula', 'sugar', 'gulaku'], icon: Candy },
  { keywords: ['garam', 'salt'], icon: Snowflake },
  { keywords: ['tepung', 'flour', 'segitiga'], icon: Wheat },
  { keywords: ['kopi', 'coffee', 'kapal api', 'abc kopi', 'nescafe'], icon: Coffee },
  { keywords: ['teh', 'tea', 'sosro', 'pucuk'], icon: CupSoda },
  { keywords: ['sirup', 'syrup', 'marjan', 'sirup'], icon: BottleWine },
  { keywords: ['kecap', 'saus', 'saos', 'sambal', 'saori'], icon: BottleWine },
  { keywords: ['bumbu', 'rempah', 'masako', 'royco', 'racik', 'bawang'], icon: CookingPot },
  { keywords: ['daging', 'rendang', 'beef', 'kornet'], icon: Beef },
  { keywords: ['ayam', 'chicken', 'bebek', 'duck', 'ayam'], icon: Drumstick },
  { keywords: ['ikan', 'fish', 'udang', 'cumi', 'seafood', 'sarden', 'tuna'], icon: Fish },
  { keywords: ['sayur', 'sayuran', 'kangkung', 'bayam', 'vegetable', 'sop'], icon: Leaf },
  { keywords: ['buah', 'fruit', 'apel', 'jeruk', 'mangga', 'pisang', 'anggur'], icon: Apple },
  { keywords: ['roti', 'bread', 'bakery', 'tortilla'], icon: Croissant },
  { keywords: ['biskuit', 'biscuit', 'wafer', 'oreo', 'roma'], icon: Cookie },
  { keywords: ['coklat', 'cokelat', 'chocolate', 'silverqueen', 'beng beng'], icon: Candy },
  { keywords: ['permen', 'candy', 'yupi', 'kopiko'], icon: Candy },
  { keywords: ['kerupuk', 'keripik', 'kripik', 'chips', 'potato'], icon: Cookie },
  { keywords: ['kue', 'bolu', 'cake', 'brownies', 'donat'], icon: Cake },
  { keywords: ['es ', 'ice ', 'snow'], icon: Snowflake },
  { keywords: ['air', 'aqua', 'galon', 'mineral', 'le minerale'], icon: Droplets },
  { keywords: ['gas', 'lpg', 'elpiji'], icon: Flame },
  { keywords: ['pulsa', 'token', 'voucher', 'kuota', 'paket data'], icon: Smartphone },
  { keywords: ['baterai', 'battery', 'batu'], icon: Battery },
  { keywords: ['lampu', 'lamp', 'led', 'sentar', 'senter'], icon: Lightbulb },
  { keywords: ['pensil', 'pulpen', 'spidol', 'alat tulis', 'stationery', 'penggaris'], icon: Pencil },
  { keywords: ['buku', 'book', 'novel'], icon: Book },
  { keywords: ['mainan', 'toys', 'lego', 'boneka'], icon: Gamepad2 },
  { keywords: ['obat', 'vitamin', 'paracetamol', 'bodrex', 'tolak angin', 'medicine'], icon: Pill },
  { keywords: ['kosmetik', 'makeup', 'lipstik', 'bedak', 'skincare', 'wardah'], icon: Sparkles },
  { keywords: ['pampers', 'popok', 'diaper', 'baby', 'mamy poko'], icon: Baby },
  { keywords: ['tas', 'bag', 'ransel'], icon: ShoppingBag },
  { keywords: ['pakaian', 'baju', 'celana', 'kaos', 'kemeja', 'shirt', 'jaket'], icon: Shirt },
  { keywords: ['sepatu', 'sandal', 'shoe'], icon: Footprints },
  { keywords: ['hadiah', 'kado', 'hampers', 'gift'], icon: Gift },
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function createVisual(label: string, icon: React.ElementType, hex: string): CategoryVisual {
  const { r, g, b } = hexToRgb(hex)
  return {
    icon,
    label,
    headerBg: `radial-gradient(520px 220px at 30% 0%, rgba(${r},${g},${b},0.18), transparent 60%), linear-gradient(180deg, rgba(${r},${g},${b},0.10), rgba(36,26,19,0))`,
    badgeBg: `rgba(${r},${g},${b},0.14)`,
    badgeColor: hex,
    badgeBorder: `rgba(${r},${g},${b},0.22)`,
    iconBg: `rgba(${r},${g},${b},0.14)`,
    iconColor: hex,
    iconBorder: `rgba(${r},${g},${b},0.22)`,
    cardBorder: `rgba(${r},${g},${b},0.10)`,
  }
}

const visualCache = new Map<string, CategoryVisual>()

export function getCategoryVisual(categoryName?: string | null): CategoryVisual {
  const raw = (categoryName || '').trim()
  const n = raw.toLowerCase()
  if (!n || n === '—' || n === '-') return warmVisuals['lainnya']

  // cache hit (use lower as key to keep stable)
  const cached = visualCache.get(n)
  if (cached) return cached

  // 1. exact warmVisuals key match (keeps tuned original colors)
  if (warmVisuals[n]) {
    visualCache.set(n, warmVisuals[n])
    return warmVisuals[n]
  }

  // 2. keyword map — semantic icon for new categories like "tisu"
  for (const entry of keywordIconMap) {
    if (entry.keywords.some(kw => n.includes(kw))) {
      // if this keyword maps to a tuned warmVisual, reuse it (label preserved as raw for display)
      // check if any keyword equals a warmVisual key
      for (const kw of entry.keywords) {
        if (warmVisuals[kw]) {
          const base = warmVisuals[kw]
          const cloned: CategoryVisual = { ...base, label: raw || base.label }
          visualCache.set(n, cloned)
          return cloned
        }
      }
      // otherwise create dynamic visual with this icon + deterministic warm color
      const color = warmPalette[hashString(n) % warmPalette.length]
      const v = createVisual(raw || entry.keywords[0], entry.icon, color)
      visualCache.set(n, v)
      return v
    }
  }

  // 3. fallback — deterministic icon+color from hash (any new category like "foo123" still gets nice visual)
  const color = warmPalette[hashString(n + '_c') % warmPalette.length]
  const icon = fallbackIcons[hashString(n) % fallbackIcons.length]
  const v = createVisual(raw, icon, color)
  visualCache.set(n, v)
  return v
}

export function getCategoryIcon(categoryName?: string | null) {
  const v = getCategoryVisual(categoryName)
  return v.icon
}

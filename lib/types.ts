export type OrderStatus =
  | 'pending_payment'
  | 'receipt_received'
  | 'ocr_processing'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'completed'

export type OrderType = 'mesa' | 'llevar'

export type PaymentMethod = 'deuna' | 'sipi' | 'transfer' | 'cash' | 'card'

export type PaymentPolicy = 'upfront' | 'at_end'

export type OcrStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Restaurant {
  id: string
  name: string
  address: string | null
  phone: string | null
  ruc: string | null
  // DeUna
  deuna_qr_url: string | null
  deuna_account_name: string | null
  // Sipi
  sipi_qr_url: string | null
  sipi_account_name: string | null
  // Bank transfer
  transfer_bank: string | null
  transfer_account_number: string | null
  transfer_account_name: string | null
  // Payment config
  payment_policy: PaymentPolicy
  accepted_payment_methods: PaymentMethod[]
  logo_url: string | null
  // Currency
  currency_symbol: string
  // Tax and service fee
  tax_rate: number
  tax_included: boolean
  service_fee_rate: number
  service_fee_fixed: number
  // Display flags
  show_price_breakdown: boolean
  kitchen_enabled: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface MenuItem {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  emoji: string | null
  image_url: string | null
  available: boolean
  sort_order: number
}

export interface CartItem extends MenuItem {
  quantity: number
}

export interface Order {
  id: string
  order_number: number
  session_id: string
  order_type: OrderType
  table_number: string | null
  payment_method: PaymentMethod | null
  status: OrderStatus
  subtotal: number
  tax_amount: number
  service_fee_amount: number
  total: number
  notes: string | null
  verified_by: string | null
  expires_at: string
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
  receipt?: Receipt
}

export interface StaffProfile {
  id: string
  user_id: string
  name: string
  can_menu: boolean
  can_payment: boolean
  can_kitchen: boolean
  is_admin: boolean
  created_at: string
  // joined from GoTrue admin API
  email?: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
  subtotal: number
}

export interface Receipt {
  id: string
  order_id: string
  storage_path: string
  image_hash: string | null
  extracted_tx_id: string | null
  extracted_amount: number | null
  extracted_sender: string | null
  ocr_status: OcrStatus
  is_duplicate: boolean
  duplicate_of_order_id: string | null
  submitted_via: 'upload' | 'share_target' | null
  created_at: string
}

export interface ParsedReceipt {
  txId: string | null
  amount: number | null
  sender: string | null
  rawText: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: 'image_hash' | 'transaction_id'
  duplicateOrderId?: string
  duplicateOrderNumber?: number
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  deuna:    'DeUna',
  sipi:     'Sipi',
  transfer: 'Transferencia',
  cash:     'Efectivo',
  card:     'Tarjeta',
}

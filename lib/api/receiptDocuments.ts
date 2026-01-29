export interface ReceiptDocument {
  id: string
  receipt_id?: string | null
  receipt_no?: string | null
  file_name: string
  storage_bucket: string
  storage_path: string
  public_url?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at: string
}

export async function getReceiptDocuments(): Promise<ReceiptDocument[]> {
  const res = await fetch('/api/admin/receipt-documents')
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Failed to load receipt documents')
  return json.data || []
}

export async function createReceiptDocument(payload: {
  receiptId: string
  receiptNo: string
  fileName: string
  fileBase64: string
  mimeType?: string
}) {
  const res = await fetch('/api/admin/receipt-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Failed to save receipt document')
  return json.data
}

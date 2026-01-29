import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('receipt_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load documents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      receiptId,
      receiptNo,
      fileName,
      fileBase64,
      mimeType = 'application/pdf',
    } = body || {}

    if (!fileBase64 || !fileName) {
      return NextResponse.json({ error: 'Missing file data' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const base64Data = fileBase64.replace(/^data:.*;base64,/, '')
    const fileBuffer = Buffer.from(base64Data, 'base64')
    const safeReceiptNo = (receiptNo || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '')
    const storagePath = `receipts/${safeReceiptNo}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('inbound')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from('inbound').getPublicUrl(storagePath)

    const { data, error: insertError } = await supabase
      .from('receipt_documents')
      .insert({
        receipt_id: receiptId || null,
        receipt_no: receiptNo || null,
        file_name: fileName,
        storage_bucket: 'inbound',
        storage_path: storagePath,
        public_url: publicUrlData?.publicUrl || null,
        mime_type: mimeType,
        file_size: fileBuffer.length,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save document' }, { status: 500 })
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requirePermission } from '@/utils/rbac'

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request)
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

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request)
    const body = await request.json()
    const {
      receiptId,
      receiptNo,
      fileName,
      fileBase64,
      mimeType = 'application/pdf',
      storagePath,
      publicUrl,
      fileSize,
    } = body || {}

    const supabase = createAdminClient()
    const safeReceiptNo = (receiptNo || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '')
    let finalStoragePath = storagePath
    let finalPublicUrl = publicUrl
    let finalFileSize = fileSize

    if (fileBase64) {
      if (!fileName) {
        return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
      }
      const base64Data = fileBase64.replace(/^data:.*;base64,/, '')
      const fileBuffer = Buffer.from(base64Data, 'base64')
      finalStoragePath = `receipts/${safeReceiptNo}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('inbound')
        .upload(finalStoragePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      const { data: publicUrlData } = supabase.storage.from('inbound').getPublicUrl(finalStoragePath)
      finalPublicUrl = publicUrlData?.publicUrl || null
      finalFileSize = fileBuffer.length
    } else {
      if (!finalStoragePath || !fileName) {
        return NextResponse.json({ error: 'Missing storage metadata' }, { status: 400 })
      }
    }

    const { data, error: insertError } = await supabase
      .from('receipt_documents')
      .insert({
        receipt_id: receiptId || null,
        receipt_no: receiptNo || null,
        file_name: fileName,
        storage_bucket: 'inbound',
        storage_path: finalStoragePath,
        public_url: finalPublicUrl || null,
        mime_type: mimeType,
        file_size: finalFileSize ?? null,
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

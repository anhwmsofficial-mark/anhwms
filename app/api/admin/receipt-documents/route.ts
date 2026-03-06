 
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requirePermission } from '@/utils/rbac'
import { fail, ok } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errorHandler'

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request)
    const supabase = createAdminClient()
    const supabaseUntyped = supabase as unknown as {
      from: (table: string) => any
      storage: any
    }
    const { data, error } = await supabaseUntyped
      .from('receipt_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return fail('INTERNAL_ERROR', error.message, { status: 500 })
    }

    return ok(data)
  } catch (err: unknown) {
    return fail('INTERNAL_ERROR', getErrorMessage(err) || 'Failed to load documents', { status: 500 })
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
    const supabaseUntyped = supabase as unknown as {
      from: (table: string) => any
      storage: any
    }
    const safeReceiptNo = (receiptNo || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '')
    let finalStoragePath = storagePath
    let finalPublicUrl = publicUrl
    let finalFileSize = fileSize

    if (fileBase64) {
      if (!fileName) {
        return fail('BAD_REQUEST', 'Missing file name', { status: 400 })
      }
      const base64Data = fileBase64.replace(/^data:.*;base64,/, '')
      const fileBuffer = Buffer.from(base64Data, 'base64')
      finalStoragePath = `receipts/${safeReceiptNo}/${fileName}`

      const { error: uploadError } = await supabaseUntyped.storage
        .from('inbound')
        .upload(finalStoragePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadError) {
        return fail('INTERNAL_ERROR', uploadError.message, { status: 500 })
      }

      const { data: publicUrlData } = supabaseUntyped.storage.from('inbound').getPublicUrl(finalStoragePath)
      finalPublicUrl = publicUrlData?.publicUrl || null
      finalFileSize = fileBuffer.length
    } else {
      if (!finalStoragePath || !fileName) {
        return fail('BAD_REQUEST', 'Missing storage metadata', { status: 400 })
      }
    }

    const { data, error: insertError } = await supabaseUntyped
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
      return fail('INTERNAL_ERROR', insertError.message, { status: 500 })
    }

    return ok(data)
  } catch (err: unknown) {
    return fail('INTERNAL_ERROR', getErrorMessage(err) || 'Failed to save document', { status: 500 })
  }
}

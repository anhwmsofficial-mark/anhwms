// 입고 수량 저장 (Line별 업데이트)
export async function saveReceiptLines(receiptId: string, lines: any[]) {
    const supabase = await createClient();
    
    const { data: receipt } = await supabase.from('inbound_receipts').select('org_id').eq('id', receiptId).single();
    if (!receipt) throw new Error('Receipt not found');

    for (const line of lines) {
        const lineData = {
            id: line.receipt_line_id || undefined,
            org_id: receipt.org_id,
            receipt_id: receiptId,
            plan_line_id: line.plan_line_id,
            product_id: line.product_id,
            expected_qty: line.expected_qty,
            received_qty: line.received_qty,
            damaged_qty: line.damaged_qty || 0, // 파손 수량
            missing_qty: line.missing_qty || 0, // 분실 수량
            updated_at: new Date().toISOString()
        };

        if (lineData.id) {
            await supabase.from('inbound_receipt_lines').update(lineData).eq('id', lineData.id);
        } else {
             await supabase.from('inbound_receipt_lines').insert(lineData);
        }
    }
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    return { success: true };
}

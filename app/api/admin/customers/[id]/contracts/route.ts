/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { CustomerContract, CreateCustomerContractInput } from '@/types';
import { requirePermission } from '@/utils/rbac';

// 거래처 계약 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { id: customerId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .select('*')
      .eq('customer_master_id', customerId)
      .order('contract_start', { ascending: false });

    if (error) throw error;

    const contracts: CustomerContract[] = (data || []).map((row: any) => {
      const contractStart = new Date(row.contract_start);
      const contractEnd = row.contract_end ? new Date(row.contract_end) : null;
      
      let daysUntilExpiry = null;
      let isExpiringSoon = false;
      if (contractEnd) {
        const diffTime = contractEnd.getTime() - new Date().getTime();
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 90;
      }

      return {
        id: row.id,
        customerMasterId: row.customer_master_id,
        contractNo: row.contract_no,
        contractName: row.contract_name,
        contractType: row.contract_type,
        contractStart,
        contractEnd,
        autoRenewal: row.auto_renewal,
        renewalNoticeDays: row.renewal_notice_days,
        renewalCount: row.renewal_count,
        contractAmount: row.contract_amount,
        currency: row.currency,
        paymentTerms: row.payment_terms,
        paymentMethod: row.payment_method,
        billingCycle: row.billing_cycle,
        slaInboundProcessing: row.sla_inbound_processing,
        slaOutboundCutoff: row.sla_outbound_cutoff,
        slaAccuracyRate: row.sla_accuracy_rate,
        slaOntimeShipRate: row.sla_ontime_ship_rate,
        contractFileUrl: row.contract_file_url,
        contractFileName: row.contract_file_name,
        signedDate: row.signed_date ? new Date(row.signed_date) : null,
        signedByCustomer: row.signed_by_customer,
        signedByCompany: row.signed_by_company,
        status: row.status,
        parentContractId: row.parent_contract_id,
        replacedByContractId: row.replaced_by_contract_id,
        terminationReason: row.termination_reason,
        terminationDate: row.termination_date ? new Date(row.termination_date) : null,
        terminationNoticeDate: row.termination_notice_date ? new Date(row.termination_notice_date) : null,
        reminderSent: row.reminder_sent,
        reminderSentAt: row.reminder_sent_at ? new Date(row.reminder_sent_at) : null,
        note: row.note,
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        daysUntilExpiry,
        isExpiringSoon,
      };
    });

    return NextResponse.json({ success: true, data: contracts });
  } catch (error: any) {
    console.error('Error fetching customer contracts:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 거래처 계약 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { id: customerId } = await params;
    const body: CreateCustomerContractInput = await req.json();

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .insert({
        customer_master_id: customerId,
        contract_no: body.contractNo,
        contract_name: body.contractName,
        contract_type: body.contractType,
        contract_start: body.contractStart,
        contract_end: body.contractEnd,
        auto_renewal: body.autoRenewal || false,
        contract_amount: body.contractAmount,
        currency: body.currency || 'KRW',
        payment_terms: body.paymentTerms || 30,
        billing_cycle: body.billingCycle || 'MONTHLY',
        status: 'ACTIVE',
        note: body.note,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error creating customer contract:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


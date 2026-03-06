'use client';

import { useState } from 'react';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInbounds, createInbound, updateInbound, deleteInbound } from '@/lib/api/inbounds';
import { getOutbounds, createOutbound, updateOutbound, deleteOutbound } from '@/lib/api/outbounds';
import { getReceiptDocuments, ReceiptDocument } from '@/lib/api/receiptDocuments';
import { showSuccess, showError } from '@/lib/toast';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { Inbound, Outbound } from '@/types';
import { formatInteger } from '@/utils/number-format';
import NumberInput from '@/components/inputs/NumberInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type DocumentType = 'asn' | 'order';
type DocumentStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

interface DocumentItem {
  id: string;
  type: DocumentType;
  documentNo: string; // ID 또는 별도 번호
  partner: string;
  product: string;
  quantity: number;
  unit: string;
  status: DocumentStatus;
  date: Date;
  raw: Inbound | Outbound;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'asn' | 'order'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<DocumentType>('asn');
  const [formData, setFormData] = useState({
    partner: '',
    product: '',
    quantity: 0,
    unit: '개',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
  });

  // 데이터 로딩
  const { data: inbounds = [], isLoading: inboundLoading } = useQuery({
    queryKey: queryKeys.documents.inbounds,
    queryFn: getInbounds,
  });

  const { data: outbounds = [], isLoading: outboundLoading } = useQuery({
    queryKey: queryKeys.documents.outbounds,
    queryFn: getOutbounds,
  });

  const { data: receiptDocs = [], isLoading: receiptLoading } = useQuery({
    queryKey: queryKeys.documents.receiptDocuments,
    queryFn: getReceiptDocuments,
  });

  const isLoading = inboundLoading || outboundLoading;

  // 데이터 통합 및 변환
  const documents: DocumentItem[] = [
    ...inbounds.map(item => ({
      id: item.id,
      type: 'asn' as const,
      documentNo: `ASN-${item.id.substring(0, 8).toUpperCase()}`,
      partner: item.supplierName,
      product: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status as DocumentStatus,
      date: item.inboundDate,
      raw: item,
    })),
    ...outbounds.map(item => ({
      id: item.id,
      type: 'order' as const,
      documentNo: `ORD-${item.id.substring(0, 8).toUpperCase()}`,
      partner: item.customerName,
      product: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status as DocumentStatus,
      date: item.outboundDate,
      raw: item,
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // 필터링
  const filteredDocuments = documents.filter((doc) => {
    const matchSearch =
      searchTerm === '' ||
      doc.documentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.product.toLowerCase().includes(searchTerm.toLowerCase());

    const matchType = filterType === 'all' || doc.type === filterType;
    const matchStatus = filterStatus === 'all' || doc.status === filterStatus;

    return matchSearch && matchType && matchStatus;
  });

  // 통계 계산
  const stats = {
    asn: {
      total: documents.filter((d) => d.type === 'asn').length,
      pending: documents.filter((d) => d.type === 'asn' && d.status === 'pending').length,
      processing: documents.filter((d) => d.type === 'asn' && d.status === 'processing').length,
      completed: documents.filter((d) => d.type === 'asn' && d.status === 'completed').length,
    },
    order: {
      total: documents.filter((d) => d.type === 'order').length,
      pending: documents.filter((d) => d.type === 'order' && d.status === 'pending').length,
      processing: documents.filter((d) => d.type === 'order' && d.status === 'processing').length,
      completed: documents.filter((d) => d.type === 'order' && d.status === 'completed').length,
    },
  };

  // Mutations
  const createInboundMutation = useMutation({
    mutationFn: createInbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.inbounds });
      showSuccess('입고 문서가 생성되었습니다.');
      handleCloseModal();
    },
    onError: (error) => {
      showError('입고 문서 생성 실패');
      console.error(error);
    }
  });

  const createOutboundMutation = useMutation({
    mutationFn: createOutbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.outbounds });
      showSuccess('출고 주문서가 생성되었습니다.');
      handleCloseModal();
    },
    onError: (error) => {
      showError('출고 주문서 생성 실패');
      console.error(error);
    }
  });

  const deleteInboundMutation = useMutation({
    mutationFn: deleteInbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.inbounds });
      showSuccess('삭제되었습니다.');
    },
    onError: () => showError('삭제 실패')
  });

  const deleteOutboundMutation = useMutation({
    mutationFn: deleteOutbound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.outbounds });
      showSuccess('삭제되었습니다.');
    },
    onError: () => showError('삭제 실패')
  });

  const updateInboundStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateInbound(id, { status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.inbounds });
      showSuccess('상태가 변경되었습니다.');
    },
    onError: () => showError('상태 변경 실패')
  });

  const updateOutboundStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOutbound(id, { status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.outbounds });
      showSuccess('상태가 변경되었습니다.');
    },
    onError: () => showError('상태 변경 실패')
  });

  const handleOpenModal = (type: DocumentType) => {
    setModalType(type);
    setFormData({
      partner: '',
      product: '',
      quantity: 0,
      unit: '개',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partner || !formData.product) {
      showError('필수 항목을 입력해주세요.');
      return;
    }

    const payload = {
      productName: formData.product,
      quantity: Number(formData.quantity),
      unit: formData.unit,
      status: formData.status as any,
    };

    if (modalType === 'asn') {
      createInboundMutation.mutate({
        ...payload,
        supplierName: formData.partner,
        inboundDate: new Date(formData.date),
      });
    } else {
      createOutboundMutation.mutate({
        ...payload,
        customerName: formData.partner,
        outboundDate: new Date(formData.date),
      });
    }
  };

  const handleDelete = (id: string, type: DocumentType) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      if (type === 'asn') {
        deleteInboundMutation.mutate(id);
      } else {
        deleteOutboundMutation.mutate(id);
      }
    }
  };

  const handleStatusChange = (id: string, type: DocumentType, newStatus: string) => {
    if (type === 'asn') {
      updateInboundStatusMutation.mutate({ id, status: newStatus });
    } else {
      updateOutboundStatusMutation.mutate({ id, status: newStatus });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📄 문서 관리</h1>
              <p className="text-sm text-gray-600 mt-1">ASN (입고예정서) 및 출고 주문서 통합 관리</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleOpenModal('asn')}
              >
                <PlusIcon className="h-5 w-5" />
                ASN 등록
              </Button>
              <Button
                onClick={() => handleOpenModal('order')}
                variant="secondary"
              >
                <PlusIcon className="h-5 w-5" />
                주문서 등록
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold text-blue-600 mb-4 flex items-center gap-2">
              <ArrowDownTrayIcon className="h-5 w-5" />
              ASN (입고예정서)
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center divide-x divide-gray-100">
              <div>
                <div className="text-xs text-gray-500 mb-1">전체</div>
                <div className="text-xl font-bold text-gray-900">{stats.asn.total}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">대기</div>
                <div className="text-xl font-bold text-amber-500">{stats.asn.pending}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">처리중</div>
                <div className="text-xl font-bold text-blue-500">{stats.asn.processing}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">완료</div>
                <div className="text-xl font-bold text-green-500">{stats.asn.completed}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
              <ArrowUpTrayIcon className="h-5 w-5" />
              출고 주문서
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center divide-x divide-gray-100">
              <div>
                <div className="text-xs text-gray-500 mb-1">전체</div>
                <div className="text-xl font-bold text-gray-900">{stats.order.total}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">대기</div>
                <div className="text-xl font-bold text-amber-500">{stats.order.pending}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">처리중</div>
                <div className="text-xl font-bold text-blue-500">{stats.order.processing}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">완료</div>
                <div className="text-xl font-bold text-green-500">{stats.order.completed}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 인수증 PDF 문서 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">📁 인수증 PDF 문서</h2>
              <p className="text-sm text-gray-500">인수증 PDF 저장 이력을 관리합니다.</p>
            </div>
          </div>
          {receiptLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : receiptDocs.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">저장된 인수증 문서가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">인수번호</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">파일명</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">등록일</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">다운로드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(receiptDocs as ReceiptDocument[]).map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700">{doc.receipt_no || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{doc.file_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {doc.public_url ? (
                          <a
                            href={doc.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            다운로드
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">URL 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="문서번호, 거래처, 품목 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-2.5"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">전체 문서</option>
                <option value="asn">ASN (입고)</option>
                <option value="order">주문서 (출고)</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="pending">대기</option>
                <option value="processing">처리중</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          </div>
        </div>

        {/* 문서 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <DocumentTextIcon className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900">검색 결과가 없습니다</p>
              <p className="text-sm">검색어나 필터를 변경해보세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">구분</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">문서번호</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">거래처</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">품목</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">수량</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">일자</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={`${doc.type}-${doc.id}`} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TypeBadge type={doc.type} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 font-mono text-xs">
                        {doc.documentNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {doc.partner}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {doc.product}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-gray-900">
                          {formatInteger(doc.quantity)}
                        </span>
                        <span className="text-gray-500 ml-1">{doc.unit}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={doc.status}
                          onChange={(e) => handleStatusChange(doc.id, doc.type, e.target.value)}
                          className={cn(
                            "text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 bg-no-repeat bg-right",
                            doc.status === 'pending' && "bg-amber-100 text-amber-700",
                            doc.status === 'processing' && "bg-blue-100 text-blue-700",
                            doc.status === 'completed' && "bg-green-100 text-green-700",
                            doc.status === 'cancelled' && "bg-gray-100 text-gray-700",
                          )}
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundSize: '1.25rem',
                            backgroundPosition: 'right 0.2rem center'
                          }}
                        >
                          <option value="pending">⏳ 대기</option>
                          <option value="processing">🔄 처리중</option>
                          <option value="completed">✅ 완료</option>
                          <option value="cancelled">❌ 취소</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.date.toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button 
                          onClick={() => handleDelete(doc.id, doc.type)}
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-red-600"
                          title="삭제"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 모달 */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                {modalType === 'asn' ? (
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <ArrowDownTrayIcon className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="p-2 bg-green-100 rounded-lg text-green-600">
                    <ArrowUpTrayIcon className="w-6 h-6" />
                  </div>
                )}
                {modalType === 'asn' ? 'ASN (입고) 등록' : '출고 주문서 등록'}
            </DialogTitle>
            <DialogDescription>문서 생성에 필요한 기본 정보를 입력합니다.</DialogDescription>
          </DialogHeader>
              
          <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalType === 'asn' ? '공급업체' : '거래처'} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.partner}
                    onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                    placeholder={modalType === 'asn' ? '공급업체명 입력' : '거래처명 입력'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    품목명 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    placeholder="품목명 입력"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수량 <span className="text-red-500">*</span>
                    </label>
                    <NumberInput
                      mode="integer"
                      min={1}
                      value={formData.quantity}
                      onValueChange={(next) => setFormData({ ...formData, quantity: next })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      단위
                    </label>
                    <Input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    일자
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    onClick={handleCloseModal}
                    variant="outline"
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    variant={modalType === 'asn' ? 'default' : 'secondary'}
                    className="flex-1"
                  >
                    등록하기
                  </Button>
                </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeBadge({ type }: { type: 'asn' | 'order' }) {
  const styles = {
    asn: 'bg-blue-50 text-blue-700 border-blue-200',
    order: 'bg-green-50 text-green-700 border-green-200',
  };

  const labels = {
    asn: '📥 ASN',
    order: '📤 주문서',
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

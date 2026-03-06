'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Outbound } from '@/types';
import { mockOutbounds, mockProducts, mockPartners } from '@/lib/mockData';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatInteger } from '@/utils/number-format';
import NumberInput from '@/components/inputs/NumberInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OutboundPage() {
  const [outbounds, setOutbounds] = useState<Outbound[]>(mockOutbounds);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    customerId: '',
    quantity: 0,
    unitPrice: 0,
    outboundDate: new Date().toISOString().split('T')[0],
    status: 'pending' as const,
    note: '',
  });

  const customers = mockPartners.filter(p => p.type === 'customer' || p.type === 'both');
  const products = mockProducts;

  const statuses = ['전체', 'pending', 'completed', 'cancelled'];
  const statusLabels: Record<string, string> = {
    '전체': '전체',
    'pending': '대기중',
    'completed': '완료',
    'cancelled': '취소',
  };

  const filteredOutbounds = outbounds.filter(outbound => {
    const matchesSearch = outbound.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         outbound.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '전체' || outbound.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const handleOpenModal = () => {
    setFormData({
      productId: '',
      customerId: '',
      quantity: 0,
      unitPrice: 0,
      outboundDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const product = products.find(p => p.id === formData.productId);
    const customer = customers.find(c => c.id === formData.customerId);
    
    if (!product || !customer) return;

    const newOutbound: Outbound = {
      id: String(outbounds.length + 1),
      productId: formData.productId,
      productName: product.name,
      customerId: formData.customerId,
      customerName: customer.name,
      quantity: formData.quantity,
      unit: product.unit,
      unitPrice: formData.unitPrice,
      totalPrice: formData.quantity * formData.unitPrice,
      outboundDate: new Date(formData.outboundDate),
      status: formData.status,
      note: formData.note,
      createdAt: new Date(),
    };
    
    setOutbounds([newOutbound, ...outbounds]);
    handleCloseModal();
  };

  const handleStatusChange = (id: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    setOutbounds(outbounds.map(outbound => 
      outbound.id === id ? { ...outbound, status: newStatus } : outbound
    ));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">완료</span>;
      case 'pending':
        return <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">대기중</span>;
      case 'cancelled':
        return <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">취소</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="출고 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="제품명 또는 고객사로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>

            <Button
              onClick={handleOpenModal}
            >
              <PlusIcon className="h-5 w-5" />
              출고 등록
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-3">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">대기중</p>
                <p className="text-2xl font-bold text-gray-900">
                  {outbounds.filter(o => o.status === 'pending').length}건
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">완료</p>
                <p className="text-2xl font-bold text-gray-900">
                  {outbounds.filter(o => o.status === 'completed').length}건
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <PlusIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 출고량 (오늘)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {outbounds
                    .filter(o => new Date(o.outboundDate).toDateString() === new Date().toDateString())
                    .reduce((sum, o) => sum + o.quantity, 0)}개
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 출고 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출고일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객사
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOutbounds.map((outbound) => (
                  <tr key={outbound.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(outbound.outboundDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{outbound.productName}</div>
                      {outbound.note && <div className="text-sm text-gray-500">{outbound.note}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {outbound.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      -{formatInteger(outbound.quantity)} {outbound.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(outbound.unitPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(outbound.totalPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(outbound.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {outbound.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleStatusChange(outbound.id, 'completed')}
                            variant="ghost"
                            size="icon"
                            className="text-green-600"
                            title="완료"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </Button>
                          <Button
                            onClick={() => handleStatusChange(outbound.id, 'cancelled')}
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            title="취소"
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 모달 */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle>출고 등록</DialogTitle>
            <DialogDescription>제품/고객사를 선택하고 출고 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      제품 *
                    </label>
                    <select
                      required
                      value={formData.productId}
                      onChange={(e) => {
                        const product = products.find(p => p.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          productId: e.target.value,
                          unitPrice: product?.price || 0
                        });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">제품 선택</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku}) - 재고: {formatInteger(product.quantity)}{product.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      고객사 *
                    </label>
                    <select
                      required
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">고객사 선택</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수량 *
                    </label>
                    <NumberInput
                      mode="integer"
                      min={1}
                      value={formData.quantity}
                      onValueChange={(next) => setFormData({ ...formData, quantity: next })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      단가 *
                    </label>
                    <NumberInput
                      mode="amount"
                      min={0}
                      value={formData.unitPrice}
                      onValueChange={(next) => setFormData({ ...formData, unitPrice: next })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      출고일 *
                    </label>
                    <Input
                      type="date"
                      required
                      value={formData.outboundDate}
                      onChange={(e) => setFormData({ ...formData, outboundDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      총액
                    </label>
                    <Input
                      type="text"
                      disabled
                      value={formatCurrency(formData.quantity * formData.unitPrice)}
                      className="bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      비고
                    </label>
                    <Textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>
                    취소
                  </Button>
                  <Button type="submit">
                    등록
                  </Button>
                </div>
              </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


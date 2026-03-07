'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  ArrowPathIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import {
  ExternalQuoteInquiry,
  InternationalQuoteInquiry,
  InquiryActionLog,
  QuoteInquirySalesStage,
  QuoteInquiryStatus,
  InquiryNote,
} from '@/types';
import { showError, showSuccess } from '@/lib/toast';
import { toastHttpError } from '@/lib/httpToast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  jobTitle?: string | null;
  department?: string | null;
}

type QuoteInquiry =
  | (ExternalQuoteInquiry & { type: 'domestic' })
  | (InternationalQuoteInquiry & { type: 'international' });

const STATUS_LABELS: Record<QuoteInquiryStatus, string> = {
  new: '신규',
  checked: '확인됨',
  processing: '상담중',
  quoted: '견적 발송',
  pending: '고객 검토중',
  won: '수주',
  lost: '미수주',
  on_hold: '보류',
};

const STATUS_COLORS: Record<QuoteInquiryStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-300',
  checked: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  quoted: 'bg-purple-100 text-purple-800 border-purple-300',
  pending: 'bg-orange-100 text-orange-800 border-orange-300',
  won: 'bg-green-100 text-green-800 border-green-300',
  lost: 'bg-gray-100 text-gray-800 border-gray-300',
  on_hold: 'bg-slate-100 text-slate-800 border-slate-300',
};

const MONTHLY_RANGE_LABELS: Record<string, string> = {
  '0_1000': '1,000건 미만',
  '1000_2000': '1,000 ~ 2,000건',
  '2000_3000': '2,000 ~ 3,000건',
  '3000_5000': '3,000 ~ 5,000건',
  '5000_10000': '5,000 ~ 10,000건',
  '10000_30000': '10,000 ~ 30,000건',
  '30000_plus': '30,000건 이상',
};

const MONTHLY_SHIPMENT_LABELS: Record<string, string> = {
  '0_100': '100건 미만',
  '100_500': '100 ~ 500건',
  '500_1000': '500 ~ 1,000건',
  '1000_3000': '1,000 ~ 3,000건',
  '3000_plus': '3,000건 이상',
};

const SALES_STAGE_LABELS: Record<QuoteInquirySalesStage, string> = {
  LEAD: '리드',
  QUALIFIED: '유효 리드',
  PROPOSAL: '제안',
  NEGOTIATION: '협상',
  WON: '수주',
  LOST: '실주',
};

const PREFERRED_CS_NAMES = ['곽혜', '박주희'];
const PREFERRED_SALES_NAMES = ['최보금'];

export default function QuoteInquiriesPage() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<QuoteInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QuoteInquiryStatus | 'ALL'>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<QuoteInquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 메모 관련 상태
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // 파일 업로드 관련
  const [uploadingFile, setUploadingFile] = useState(false);

  // 담당자 관련
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL');
  const [selectedOwner, setSelectedOwner] = useState<string>('ALL');
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>('');

  // 고급 필터
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // 일괄 선택 관련
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [activityLogs, setActivityLogs] = useState<InquiryActionLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailForm, setDetailForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    source: '',
    memo: '',
    skuCount: '',
    ownerUserId: '',
    assignedTo: '',
    salesStage: 'LEAD' as QuoteInquirySalesStage,
    expectedRevenue: '',
    winProbability: '',
    lostReason: '',
  });

  const getInquiryNoteType = (inquiry: QuoteInquiry) =>
    inquiry.type === 'international' ? 'international' : 'external';

  const syncQueryString = useCallback(
    (inquiry?: QuoteInquiry | null) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || '');

      if (inquiry) {
        nextParams.set('id', inquiry.id);
        nextParams.set('type', getInquiryNoteType(inquiry));
      } else {
        nextParams.delete('id');
        nextParams.delete('type');
      }

      const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const applyDetailForm = useCallback((inquiry: QuoteInquiry) => {
    setDetailForm({
      companyName: inquiry.companyName || '',
      contactName: inquiry.contactName || '',
      email: inquiry.email || '',
      phone: inquiry.phone || '',
      source: inquiry.source || '',
      memo: inquiry.memo || '',
      skuCount: inquiry.skuCount === null || inquiry.skuCount === undefined ? '' : String(inquiry.skuCount),
      ownerUserId: inquiry.ownerUserId || '',
      assignedTo: inquiry.assignedTo || '',
      salesStage: inquiry.salesStage || 'LEAD',
      expectedRevenue:
        inquiry.expectedRevenue === null || inquiry.expectedRevenue === undefined
          ? ''
          : String(inquiry.expectedRevenue),
      winProbability:
        inquiry.winProbability === null || inquiry.winProbability === undefined
          ? ''
          : String(inquiry.winProbability),
      lostReason: inquiry.lostReason || '',
    });
  }, []);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/admin-users');
      if (!response.ok) {
        await toastHttpError(response, '관리자 목록 조회에 실패했습니다.');
        return;
      }
      const result = await response.json();
      setAdminUsers(result.data?.users || []);
      setCurrentUserId(result.data?.currentUserId || '');
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  }, []);

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/admin/quote-inquiries?${params}`);
      if (!response.ok) {
        await toastHttpError(response, '견적 문의 목록 조회에 실패했습니다.');
        return;
      }
      const result = await response.json();
      setInquiries(result.data || []);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  const fetchInquiryDetail = useCallback(async (id: string, inquiryType: 'external' | 'international') => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/admin/quote-inquiries/${id}?type=${inquiryType}`);
      if (!response.ok) {
        await toastHttpError(response, '견적 문의 상세 조회에 실패했습니다.');
        return null;
      }

      const result = await response.json();
      return result.data as QuoteInquiry;
    } catch (error) {
      console.error('Error fetching inquiry detail:', error);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async (inquiry: QuoteInquiry) => {
    try {
      setLoadingActivity(true);
      const response = await fetch(
        `/api/admin/quote-inquiries/${inquiry.id}/activity?type=${getInquiryNoteType(inquiry)}`,
      );

      if (!response.ok) {
        await toastHttpError(response, '활동 이력 조회에 실패했습니다.');
        return;
      }

      const result = await response.json();
      setActivityLogs(result.data || []);
    } catch (error) {
      console.error('Error fetching inquiry activity:', error);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const openInquiryDetail = useCallback(
    async (inquiry: QuoteInquiry) => {
      setIsDetailOpen(true);
      syncQueryString(inquiry);

      const detailedInquiry =
        (await fetchInquiryDetail(inquiry.id, getInquiryNoteType(inquiry))) || inquiry;

      setSelectedInquiry(detailedInquiry);
      applyDetailForm(detailedInquiry);
    },
    [applyDetailForm, fetchInquiryDetail, syncQueryString],
  );

  const closeInquiryDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedInquiry(null);
    setNotes([]);
    setActivityLogs([]);
    setEditingNoteId(null);
    setEditingNoteText('');
    syncQueryString(null);
  }, [syncQueryString]);

  const fetchNotes = useCallback(async (inquiry?: QuoteInquiry | null) => {
    const targetInquiry = inquiry || selectedInquiry;
    if (!targetInquiry) return;

    try {
      setLoadingNotes(true);
      const response = await fetch(
        `/api/admin/quote-inquiries/${targetInquiry.id}/notes?type=${getInquiryNoteType(targetInquiry)}`,
      );
      if (!response.ok) {
        await toastHttpError(response, '메모 조회에 실패했습니다.');
        return;
      }
      const result = await response.json();
      setNotes(result.data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, [selectedInquiry]);

  const refreshSelectedInquiry = useCallback(async () => {
    if (!selectedInquiry) return;
    const detailedInquiry = await fetchInquiryDetail(
      selectedInquiry.id,
      getInquiryNoteType(selectedInquiry),
    );

    if (!detailedInquiry) return;

    setSelectedInquiry(detailedInquiry);
    applyDetailForm(detailedInquiry);
  }, [applyDetailForm, fetchInquiryDetail, selectedInquiry]);

  useEffect(() => {
    fetchInquiries();
    fetchAdminUsers();
  }, [fetchInquiries, fetchAdminUsers]);

  useEffect(() => {
    if (selectedInquiry && isDetailOpen) {
      fetchNotes(selectedInquiry);
      fetchActivity(selectedInquiry);
    }
  }, [selectedInquiry, isDetailOpen, fetchActivity, fetchNotes]);

  useEffect(() => {
    const targetId = searchParams?.get('id');
    const targetType = searchParams?.get('type');

    if (!targetId || inquiries.length === 0 || isDetailOpen) return;

    const matchedInquiry = inquiries.find(
      (item) =>
        item.id === targetId &&
        (!targetType ||
          targetType === getInquiryNoteType(item) ||
          (targetType === 'domestic' && item.type === 'domestic')),
    );

    if (matchedInquiry) {
      void openInquiryDetail(matchedInquiry);
    }
  }, [inquiries, isDetailOpen, openInquiryDetail, searchParams]);

  const updateInquiryStatus = async (inquiry: QuoteInquiry, status: QuoteInquiryStatus) => {
    try {
      const response = await fetch(`/api/admin/quote-inquiries/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, inquiryType: getInquiryNoteType(inquiry) }),
      });

      if (!response.ok) {
        await toastHttpError(response, '상태 변경에 실패했습니다.');
        return;
      }

      await fetchInquiries();
      if (selectedInquiry?.id === inquiry.id) {
        const updatedInquiry = { ...selectedInquiry, status };
        setSelectedInquiry(updatedInquiry);
        applyDetailForm(updatedInquiry);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const saveInquiryDetail = async () => {
    if (!selectedInquiry) return;

    try {
      setSavingDetail(true);
      const response = await fetch(`/api/admin/quote-inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryType: getInquiryNoteType(selectedInquiry),
          companyName: detailForm.companyName,
          contactName: detailForm.contactName,
          email: detailForm.email,
          phone: detailForm.phone || null,
          source: detailForm.source || null,
          memo: detailForm.memo || null,
          skuCount: detailForm.skuCount === '' ? null : Number(detailForm.skuCount),
          ownerUserId: detailForm.ownerUserId || null,
          assignedTo: detailForm.assignedTo || null,
          salesStage: detailForm.salesStage,
          expectedRevenue:
            detailForm.expectedRevenue === '' ? null : Number(detailForm.expectedRevenue),
          winProbability:
            detailForm.winProbability === '' ? null : Number(detailForm.winProbability),
          lostReason: detailForm.lostReason || null,
        }),
      });

      if (!response.ok) {
        await toastHttpError(response, '견적 문의 수정에 실패했습니다.');
        return;
      }

      showSuccess('견적 문의 정보가 저장되었습니다.');
      await fetchInquiries();
      await refreshSelectedInquiry();
    } catch (error) {
      console.error('Error saving inquiry detail:', error);
      showError('수정 중 오류가 발생했습니다.');
    } finally {
      setSavingDetail(false);
    }
  };

  const addNote = async () => {
    if (!selectedInquiry || !newNote.trim()) return;

    try {
      setSavingNote(true);
      const response = await fetch(
        `/api/admin/quote-inquiries/${selectedInquiry.id}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note: newNote.trim(),
            inquiryType: getInquiryNoteType(selectedInquiry),
          }),
        },
      );

      if (!response.ok) {
        await toastHttpError(response, '메모 저장에 실패했습니다.');
        return;
      }
      setNewNote('');
      await fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(
        `/api/admin/quote-inquiries/notes/${noteId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        await toastHttpError(response, '메모 삭제에 실패했습니다.');
        return;
      }
      await fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const startEditNote = (note: InquiryNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const saveEditedNote = async (noteId: string) => {
    if (!editingNoteText.trim()) {
      showError('메모 내용을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/quote-inquiries/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editingNoteText.trim() }),
      });

      if (!response.ok) {
        await toastHttpError(response, '메모 수정에 실패했습니다.');
        return;
      }

      showSuccess('메모가 수정되었습니다.');
      cancelEditNote();
      await fetchNotes(selectedInquiry);
    } catch (error) {
      console.error('Error editing note:', error);
      showError('메모 수정 중 오류가 발생했습니다.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedInquiry || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    
    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    try {
      setUploadingFile(true);

      // Supabase Storage 업로드 로직 (임시로 주석 처리)
      // const { data, error } = await supabase.storage
      //   .from('quote-files')
      //   .upload(`${selectedInquiry.id}/${file.name}`, file);

      // 여기서는 간단히 파일 URL만 업데이트
      const mockFileUrl = `https://example.com/quotes/${selectedInquiry.id}/${file.name}`;

      const response = await fetch(`/api/admin/quote-inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteFileUrl: mockFileUrl,
          quoteSentAt: new Date().toISOString(),
          status: 'quoted', // 파일 업로드 시 자동으로 '견적 발송' 상태로 변경
          inquiryType: getInquiryNoteType(selectedInquiry),
        }),
      });

      if (!response.ok) {
        await toastHttpError(response, '견적서 업로드에 실패했습니다.');
        return;
      }
      showSuccess('견적서가 업로드되었습니다.');
      await fetchInquiries();
      await refreshSelectedInquiry();
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('파일 업로드에 실패했습니다.');
    } finally {
      setUploadingFile(false);
    }
  };

  const updateAssignee = async (inquiry: QuoteInquiry, assignedTo: string | null) => {
    try {
      const response = await fetch(`/api/admin/quote-inquiries/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo, inquiryType: getInquiryNoteType(inquiry) }),
      });

      if (!response.ok) {
        await toastHttpError(response, '담당자 배정에 실패했습니다.');
        return;
      }
      await fetchInquiries();
      if (selectedInquiry?.id === inquiry.id) {
        const updatedInquiry = {
          ...selectedInquiry,
          assignedTo,
          assignedToName: adminUsers.find((admin) => admin.id === assignedTo)?.name || null,
        };
        setSelectedInquiry(updatedInquiry);
        applyDetailForm(updatedInquiry);
      }
    } catch (error) {
      console.error('Error updating assignee:', error);
    }
  };

  // 일괄 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInquiries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInquiries.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      showError('삭제할 견적서를 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedIds.size}개의 견적 문의를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      setIsDeleting(true);

      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/quote-inquiries/${id}?type=${getInquiryTypeById(id)}`, {
          method: 'DELETE',
        }),
      );

      const results = await Promise.all(deletePromises);
      const failedCount = results.filter(r => !r.ok).length;

      if (failedCount > 0) {
        showError(`${selectedIds.size - failedCount}개 삭제 완료, ${failedCount}개 실패`);
      } else {
        showSuccess(`${selectedIds.size}개의 견적 문의가 삭제되었습니다.`);
      }

      setSelectedIds(new Set());
      await fetchInquiries();
    } catch (error) {
      console.error('Error deleting inquiries:', error);
      showError('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 일괄 담당자 배정
  const handleBulkAssign = async () => {
    if (selectedIds.size === 0) {
      showError('담당자를 배정할 견적서를 선택해주세요.');
      return;
    }

    if (!bulkAssigneeId) {
      showError('배정할 담당자를 선택해주세요.');
      return;
    }

    try {
      const assignPromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/quote-inquiries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignedTo: bulkAssigneeId,
            inquiryType: getInquiryTypeById(id),
          }),
        }),
      );

      const results = await Promise.all(assignPromises);
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        showError(`${selectedIds.size - failedCount}건 배정 완료, ${failedCount}건 실패`);
      } else {
        showSuccess(`${selectedIds.size}개의 견적 문의에 담당자가 배정되었습니다.`);
      }
      setSelectedIds(new Set());
      setBulkAssigneeId('');
      await fetchInquiries();
    } catch (error) {
      console.error('Error assigning inquiries:', error);
      showError('담당자 배정 중 오류가 발생했습니다.');
    }
  };

  const filteredInquiries = inquiries.filter((inquiry) => {
    // 검색어 필터
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      inquiry.companyName.toLowerCase().includes(searchLower) ||
      inquiry.contactName.toLowerCase().includes(searchLower) ||
      inquiry.email.toLowerCase().includes(searchLower) ||
      inquiry.phone?.toLowerCase().includes(searchLower) ||
      inquiry.ownerName?.toLowerCase().includes(searchLower) ||
      inquiry.assignedToName?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // 담당자 필터
    if (selectedAssignee !== 'ALL') {
      if (selectedAssignee === 'UNASSIGNED') {
        if (inquiry.assignedTo) return false;
      } else {
        if (inquiry.assignedTo !== selectedAssignee) return false;
      }
    }

    if (selectedOwner !== 'ALL') {
      if (selectedOwner === 'UNASSIGNED') {
        if (inquiry.ownerUserId) return false;
      } else {
        if (inquiry.ownerUserId !== selectedOwner) return false;
      }
    }

    // 날짜 필터
    if (dateRange.start) {
      const inquiryDate = new Date(inquiry.createdAt);
      const startDate = new Date(dateRange.start);
      if (inquiryDate < startDate) return false;
    }

    if (dateRange.end) {
      const inquiryDate = new Date(inquiry.createdAt);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      if (inquiryDate > endDate) return false;
    }

    return true;
  });

  const getMonthlyLabel = (inquiry: QuoteInquiry) => {
    if (inquiry.type === 'international') {
      return (
        MONTHLY_SHIPMENT_LABELS[inquiry.monthlyShipmentVolume] ??
        inquiry.monthlyShipmentVolume ??
        '-'
      );
    }

    return MONTHLY_RANGE_LABELS[inquiry.monthlyOutboundRange] ?? '-';
  };

  const getInquiryTypeById = (id: string) => {
    const inquiry = inquiries.find((item) => item.id === id);
    return inquiry?.type === 'international' ? 'international' : 'external';
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatRelativeTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return '방금 전';
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return formatDate(date);
  };

  const csManagers = adminUsers.filter((user) => {
    const department = (user.department || '').toLowerCase();
    return (
      PREFERRED_CS_NAMES.includes(user.name) ||
      department.includes('cs') ||
      department.includes('고객지원')
    );
  });

  const salesManagers = adminUsers.filter((user) => {
    const department = (user.department || '').toLowerCase();
    return (
      PREFERRED_SALES_NAMES.includes(user.name) ||
      department.includes('sales') ||
      department.includes('영업')
    );
  });

  const csManagerOptions = csManagers.length > 0 ? csManagers : adminUsers;
  const salesManagerOptions = salesManagers.length > 0 ? salesManagers : adminUsers;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                견적 문의 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                웹 폼으로 접수된 풀필먼트 견적 문의 현황
              </p>
            </div>
            <button
              onClick={fetchInquiries}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
              {(Object.keys(STATUS_LABELS) as QuoteInquiryStatus[]).map((status) => {
                const count = inquiries.filter((i) => i.status === status).length;
                return (
                  <div
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all hover:shadow-md ${
                      selectedStatus === status ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">{STATUS_LABELS[status]}</p>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 필터 & 검색 */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 검색 */}
                <div className="relative md:col-span-2">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="회사명, 담당자, 이메일, 연락처 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 상태 필터 */}
                <div className="relative">
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as QuoteInquiryStatus | 'ALL')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">전체 상태</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 담당자 필터 */}
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">전체 운영담당</option>
                    <option value="UNASSIGNED">미배정</option>
                    {csManagerOptions.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={selectedOwner}
                    onChange={(e) => setSelectedOwner(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">전체 영업담당</option>
                    <option value="UNASSIGNED">미배정</option>
                    {salesManagerOptions.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 날짜 필터 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    placeholder="시작일"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    placeholder="종료일"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 필터 초기화 버튼 */}
              {(searchTerm || selectedStatus !== 'ALL' || selectedAssignee !== 'ALL' || selectedOwner !== 'ALL' || dateRange.start || dateRange.end) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedStatus('ALL');
                      setSelectedAssignee('ALL');
                      setSelectedOwner('ALL');
                      setDateRange({ start: '', end: '' });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    필터 초기화
                  </button>
                </div>
              )}
            </div>

            {/* 일괄 작업 버튼 */}
            {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <span className="text-sm font-semibold text-blue-900">
                    {selectedIds.size}개의 견적 문의 선택됨
                  </span>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <select
                      value={bulkAssigneeId}
                      onChange={(e) => setBulkAssigneeId(e.target.value)}
                      className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm"
                    >
                      <option value="">일괄 배정할 운영담당 선택</option>
                      {csManagerOptions.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkAssign}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <UserIcon className="h-5 w-5" />
                      일괄 배정
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          삭제 중...
                        </>
                      ) : (
                        <>
                          <TrashIcon className="h-5 w-5" />
                          일괄 삭제
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 테이블 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          checked={filteredInquiries.length > 0 && selectedIds.size === filteredInquiries.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        회사명
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        담당자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        연락처
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        월 출고량
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        영업담당
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        운영담당
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        요청일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInquiries.length > 0 ? (
                      filteredInquiries.map((inquiry) => {
                        return (
                          <tr
                            key={inquiry.id}
                            className={`hover:bg-gray-50 ${selectedIds.has(inquiry.id) ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(inquiry.id)}
                                onChange={() => toggleSelect(inquiry.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                  STATUS_COLORS[inquiry.status]
                                }`}
                              >
                                {STATUS_LABELS[inquiry.status]}
                              </span>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => {
                                void openInquiryDetail(inquiry);
                              }}
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {inquiry.companyName}
                              </div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => {
                                void openInquiryDetail(inquiry);
                              }}
                            >
                              <div className="text-sm text-gray-900">{inquiry.contactName}</div>
                              <div className="text-sm text-gray-500">{inquiry.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {inquiry.phone || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {getMonthlyLabel(inquiry)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              <div className="font-medium">{inquiry.ownerName || '-'}</div>
                              {inquiry.salesStage && (
                                <div className="text-xs text-gray-500">
                                  {SALES_STAGE_LABELS[inquiry.salesStage]}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={inquiry.assignedTo || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateAssignee(inquiry, e.target.value || null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  inquiry.assignedTo 
                                    ? 'bg-purple-50 border-purple-300 text-purple-700' 
                                    : 'bg-gray-50 border-gray-300 text-gray-500'
                                }`}
                              >
                                <option value="">미배정</option>
                                {csManagerOptions.map((admin) => (
                                  <option key={admin.id} value={admin.id}>
                                    {admin.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatRelativeTime(inquiry.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openInquiryDetail(inquiry);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-semibold"
                                >
                                  상세보기
                                </button>
                                {inquiry.quoteFileUrl && (
                                  <PaperClipIcon className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                          검색 결과가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 상세 Side Drawer */}
      {isDetailOpen && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            onClick={closeInquiryDetail}
          ></div>
          <div className="relative w-full max-w-2xl bg-white shadow-xl flex flex-col animate-slide-in-right">
            {/* Drawer 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">견적 문의 상세</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(selectedInquiry.createdAt)} 접수
                </p>
              </div>
              <button
                onClick={closeInquiryDetail}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  최신 상세 정보를 불러오는 중입니다...
                </div>
              )}

              {/* 빠른 액션 버튼 */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={async () => {
                    if (!selectedInquiry.assignedTo) {
                      showError('먼저 담당자를 지정해주세요');
                      return;
                    }
                    // TODO: 이메일 발송 기능
                    showSuccess('담당자에게 알림이 발송되었습니다');
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <EnvelopeIcon className="h-5 w-5" />
                  <span className="font-semibold text-sm">이메일 발송</span>
                </button>
                
                <button
                  onClick={async () => {
                    if (selectedInquiry.type === 'international') {
                      showError('해외배송 견적은 자동 견적 계산을 지원하지 않습니다.');
                      return;
                    }

                    const monthlyVolumeMap: Record<string, number> = {
                      '0_1000': 500,
                      '1000_2000': 1500,
                      '2000_3000': 2500,
                      '3000_5000': 4000,
                      '5000_10000': 7500,
                      '10000_30000': 20000,
                      '30000_plus': 50000,
                    };

                    const estimatedVolume =
                      monthlyVolumeMap[selectedInquiry.monthlyOutboundRange] || 1000;

                    try {
                      const response = await fetch('/api/quote/calculate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          inquiryId: selectedInquiry.id,
                          inquiryType: getInquiryNoteType(selectedInquiry),
                          monthlyVolume: estimatedVolume,
                          skuCount: selectedInquiry.skuCount || 10,
                          productCategories: selectedInquiry.productCategories,
                          extraServices: selectedInquiry.extraServices,
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        const total = result.data.total.toLocaleString();
                        showSuccess(`자동 견적 계산 완료: 예상 금액 ${total}원`);
                      } else {
                        await toastHttpError(response, '견적 계산에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('Quote calculation error:', error);
                      showError('견적 계산 중 오류가 발생했습니다');
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CalendarIcon className="h-5 w-5" />
                  <span className="font-semibold text-sm">자동 견적</span>
                </button>

                <button
                  onClick={async () => {
                    if (!confirm('이 견적 문의를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                      return;
                    }

                    try {
                      const response = await fetch(
                        `/api/admin/quote-inquiries/${selectedInquiry.id}?type=${getInquiryNoteType(selectedInquiry)}`,
                        {
                          method: 'DELETE',
                        },
                      );

                      if (response.ok) {
                        showSuccess('견적 문의가 삭제되었습니다.');
                        closeInquiryDetail();
                        await fetchInquiries();
                      } else {
                        await toastHttpError(response, '삭제에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('Delete error:', error);
                      showError('삭제 중 오류가 발생했습니다.');
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <TrashIcon className="h-5 w-5" />
                  <span className="font-semibold text-sm">삭제</span>
                </button>
              </div>

              {/* 현재 상태 및 워크플로우 */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-blue-600" />
                    현재 상태
                  </h4>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${
                      STATUS_COLORS[selectedInquiry.status]
                    }`}
                  >
                    {STATUS_LABELS[selectedInquiry.status]}
                  </span>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-2">상태 변경 워크플로우</p>
                  <div className="space-y-2">
                    {/* 1단계: 신규 -> 확인 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'new')}
                        disabled={selectedInquiry.status === 'new'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'new'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'new' && '✓ '}신규
                      </button>
                      <span className="text-gray-400 self-center">→</span>
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'checked')}
                        disabled={selectedInquiry.status === 'checked'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'checked'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'checked' && '✓ '}확인됨
                      </button>
                    </div>

                    {/* 2단계: 상담중 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'processing')}
                        disabled={selectedInquiry.status === 'processing'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'processing'
                            ? 'bg-yellow-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-yellow-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'processing' && '✓ '}상담중
                      </button>
                    </div>

                    {/* 3단계: 견적 발송 -> 검토중 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'quoted')}
                        disabled={selectedInquiry.status === 'quoted'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'quoted'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'quoted' && '✓ '}견적 발송
                      </button>
                      <span className="text-gray-400 self-center">→</span>
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'pending')}
                        disabled={selectedInquiry.status === 'pending'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'pending'
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-orange-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'pending' && '✓ '}고객 검토중
                      </button>
                    </div>

                    {/* 4단계: 수주 / 미수주 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'won')}
                        disabled={selectedInquiry.status === 'won'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'won'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'won' && '✓ '}수주 확정
                      </button>
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'lost')}
                        disabled={selectedInquiry.status === 'lost'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'lost'
                            ? 'bg-gray-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'lost' && '✓ '}미수주
                      </button>
                    </div>

                    {/* 보류 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateInquiryStatus(selectedInquiry, 'on_hold')}
                        disabled={selectedInquiry.status === 'on_hold'}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedInquiry.status === 'on_hold'
                            ? 'bg-slate-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-slate-50 border border-gray-300'
                        }`}
                      >
                        {selectedInquiry.status === 'on_hold' && '✓ '}보류
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  💡 현재 상태에서 다음 단계로 진행하거나 원하는 상태로 변경할 수 있습니다
                </p>
              </div>

              {/* 영업/운영 담당자 */}
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-purple-600" />
                    영업/운영 담당자 설정
                  </h4>
                  <div className="text-xs text-gray-500">
                    영업담당: {selectedInquiry.ownerName || '미배정'} / 운영담당: {selectedInquiry.assignedToName || '미배정'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">영업담당</label>
                    <select
                      value={detailForm.ownerUserId}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, ownerUserId: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">영업담당 미배정</option>
                      {salesManagerOptions.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name}{admin.jobTitle ? ` / ${admin.jobTitle}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">운영담당</label>
                    <select
                      value={detailForm.assignedTo}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">운영담당 미배정</option>
                      {csManagerOptions.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name}{admin.jobTitle ? ` / ${admin.jobTitle}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 상세 편집 */}
              <div className="bg-gray-50 p-5 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <PencilSquareIcon className="h-5 w-5 text-blue-600" />
                    견적 문의 편집
                  </h4>
                  <button
                    onClick={saveInquiryDetail}
                    disabled={savingDetail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingDetail ? '저장 중...' : '변경사항 저장'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                    <input
                      value={detailForm.companyName}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, companyName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">담당자명</label>
                    <input
                      value={detailForm.contactName}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                    <input
                      type="email"
                      value={detailForm.email}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                    <input
                      value={detailForm.phone}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">영업 단계</label>
                    <select
                      value={detailForm.salesStage}
                      onChange={(e) =>
                        setDetailForm((prev) => ({
                          ...prev,
                          salesStage: e.target.value as QuoteInquirySalesStage,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      {Object.entries(SALES_STAGE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">유입 경로</label>
                    <input
                      value={detailForm.source}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, source: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">예상 매출</label>
                    <input
                      type="number"
                      min="0"
                      value={detailForm.expectedRevenue}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, expectedRevenue: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">성사 확률 (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={detailForm.winProbability}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, winProbability: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU 수량</label>
                    <input
                      type="number"
                      min="0"
                      value={detailForm.skuCount}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, skuCount: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">실주 사유</label>
                    <input
                      value={detailForm.lostReason}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, lostReason: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">고객 요청 메모</label>
                    <textarea
                      value={detailForm.memo}
                      onChange={(e) => setDetailForm((prev) => ({ ...prev, memo: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* 물량 정보 */}
              <div className="bg-gray-50 p-5 rounded-xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
                  물량 및 상품 정보
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">월 출고량</p>
                      <p className="text-base font-semibold text-gray-900">
                        {getMonthlyLabel(selectedInquiry)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">SKU 수량</p>
                      <p className="text-base font-semibold text-gray-900">
                        {selectedInquiry.skuCount || '-'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">상품군</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedInquiry.productCategories.length > 0 ? (
                        selectedInquiry.productCategories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">없음</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">추가 작업</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedInquiry.type === 'international'
                        ? []
                        : selectedInquiry.extraServices
                      ).length > 0 ? (
                        (selectedInquiry.type === 'international'
                          ? []
                          : selectedInquiry.extraServices
                        ).map((svc, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                          >
                            {svc}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">없음</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 고객 메모 */}
              {selectedInquiry.memo && (
                <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-3">고객 요청사항</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedInquiry.memo}</p>
                </div>
              )}

              {/* 견적서 파일 */}
              <div className="bg-gray-50 p-5 rounded-xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DocumentArrowUpIcon className="h-5 w-5 text-blue-600" />
                  견적서 관리
                </h4>
                {selectedInquiry.quoteFileUrl ? (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <PaperClipIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">견적서.pdf</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(selectedInquiry.quoteSentAt)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={selectedInquiry.quoteFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                      다운로드
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <input
                      type="file"
                      id="quote-file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="quote-file"
                      className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${
                        uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingFile ? (
                        <>
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          업로드 중...
                        </>
                      ) : (
                        <>
                          <DocumentArrowUpIcon className="h-5 w-5" />
                          견적서 업로드
                        </>
                      )}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      PDF, DOC, DOCX 파일 (최대 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* 운영자 메모 */}
              <div className="bg-gray-50 p-5 rounded-xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
                  운영자 메모
                </h4>

                {/* 메모 입력 */}
                <div className="mb-4">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="내부 메모를 작성하세요..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim() || savingNote}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingNote ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-4 w-4" />
                          메모 추가
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 메모 목록 */}
                <div className="space-y-3">
                  {loadingNotes ? (
                    <div className="text-center py-4">
                      <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : notes.length > 0 ? (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white p-4 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-900">
                              {note.adminName || '관리자'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(note.createdAt)}
                            </span>
                            {note.adminId === currentUserId && (
                              <button
                                onClick={() => startEditNote(note)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                            )}
                            {note.adminId === currentUserId && (
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelEditNote}
                                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => saveEditedNote(note.id)}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg"
                              >
                                메모 저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {note.note}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      아직 작성된 메모가 없습니다
                    </p>
                  )}
                </div>
              </div>

              {/* 활동 이력 */}
              <div className="bg-gray-50 p-5 rounded-xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-blue-600" />
                  활동 이력
                </h4>
                <div className="space-y-3">
                  {loadingActivity ? (
                    <div className="text-center py-4">
                      <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : activityLogs.length > 0 ? (
                    activityLogs.map((log) => (
                      <div key={log.id} className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                            <p className="text-xs text-gray-500">
                              {log.actorName || 'system'} · {formatRelativeTime(log.createdAt)}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            {log.oldValue && <div>이전: {log.oldValue}</div>}
                            {log.newValue && <div>현재: {log.newValue}</div>}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">기록된 활동 이력이 없습니다</p>
                  )}
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">요청 일시</p>
                    <p className="text-gray-900 font-medium">
                      {formatDate(selectedInquiry.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">최종 수정</p>
                    <p className="text-gray-900 font-medium">
                      {formatDate(selectedInquiry.updatedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">유입 경로</p>
                    <p className="text-gray-900 font-medium">
                      {selectedInquiry.source || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">문의 ID</p>
                    <p className="text-gray-900 font-mono text-xs">
                      {selectedInquiry.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

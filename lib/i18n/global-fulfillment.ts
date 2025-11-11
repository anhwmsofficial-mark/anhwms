// 다국어 지원 - Global Fulfillment
// 한글(ko), 중문(zh), 영문(en)

export const translations = {
  ko: {
    // 메뉴
    'menu.dashboard': '대시보드',
    'menu.drop_shipping': '드롭시핑',
    'menu.preparation': '상품 준비 및 환적',
    'menu.wave_management': '파도 관리',
    'menu.second_sorting': '2차 정렬',
    'menu.inspection': '검증 / 검사',
    'menu.package_check': '패키지 검증',
    'menu.weight_check': '무게 측정',
    'menu.returns': '교환 / 반품',
    'menu.exceptions': '비정상적인 부분',
    'menu.cutoff': '마감 시간',

    // 상태
    'status.pending': '대기',
    'status.in_progress': '진행중',
    'status.completed': '완료',
    'status.delayed': '지연',
    'status.error': '오류',
    'status.returned': '반품',

    // 프로세스 단계
    'step.drop_shipping': '드롭시핑',
    'step.preparation': '상품 준비',
    'step.wave_management': '파도 관리',
    'step.second_sorting': '2차 정렬',
    'step.inspection': '검증/검사',
    'step.package_check': '패키지 검증',
    'step.weight_check': '무게 측정',
    'step.completed': '완료',
    'step.exception': '이상',

    // 버튼
    'button.upload': '업로드',
    'button.download': '다운로드',
    'button.save': '저장',
    'button.cancel': '취소',
    'button.approve': '승인',
    'button.reject': '반려',
    'button.resolve': '해결',
    'button.notify': '알림',

    // 통관
    'customs.pending': '대기',
    'customs.in_progress': '진행중',
    'customs.cleared': '통관완료',
    'customs.delayed': '지연',
    'customs.rejected': '거부',

    // 배송 방법
    'shipping.air': '항공',
    'shipping.sea': '해운',
    'shipping.express': '특송',

    // 심각도
    'severity.low': '낮음',
    'severity.medium': '중간',
    'severity.high': '높음',
    'severity.critical': '긴급',

    // 이상 유형
    'exception.missing_item': '상품 누락',
    'exception.duplicate': '중복 주문',
    'exception.damaged': '상품 파손',
    'exception.customs_delay': '통관 지연',
    'exception.wrong_address': '주소 오류',
    'exception.weight_mismatch': '중량 불일치',
    'exception.system_error': '시스템 오류',

    // 메시지
    'message.upload_success': '업로드 완료',
    'message.upload_error': '업로드 실패',
    'message.processing': '처리 중...',
    'message.no_data': '데이터가 없습니다',
  },

  zh: {
    // 菜单
    'menu.dashboard': '仪表板',
    'menu.drop_shipping': '代发货',
    'menu.preparation': '商品准备与转运',
    'menu.wave_management': '波次管理',
    'menu.second_sorting': '二次分拣',
    'menu.inspection': '检验 / 检查',
    'menu.package_check': '包裹验证',
    'menu.weight_check': '称重',
    'menu.returns': '换货 / 退货',
    'menu.exceptions': '异常处理',
    'menu.cutoff': '截止时间',

    // 状态
    'status.pending': '待处理',
    'status.in_progress': '进行中',
    'status.completed': '已完成',
    'status.delayed': '延迟',
    'status.error': '错误',
    'status.returned': '已退货',

    // 流程步骤
    'step.drop_shipping': '代发货',
    'step.preparation': '商品准备',
    'step.wave_management': '波次管理',
    'step.second_sorting': '二次分拣',
    'step.inspection': '检验/检查',
    'step.package_check': '包裹验证',
    'step.weight_check': '称重',
    'step.completed': '已完成',
    'step.exception': '异常',

    // 按钮
    'button.upload': '上传',
    'button.download': '下载',
    'button.save': '保存',
    'button.cancel': '取消',
    'button.approve': '批准',
    'button.reject': '拒绝',
    'button.resolve': '解决',
    'button.notify': '通知',

    // 清关
    'customs.pending': '待处理',
    'customs.in_progress': '进行中',
    'customs.cleared': '已清关',
    'customs.delayed': '延迟',
    'customs.rejected': '拒绝',

    // 运输方式
    'shipping.air': '航空',
    'shipping.sea': '海运',
    'shipping.express': '快递',

    // 严重程度
    'severity.low': '低',
    'severity.medium': '中',
    'severity.high': '高',
    'severity.critical': '紧急',

    // 异常类型
    'exception.missing_item': '商品缺失',
    'exception.duplicate': '重复订单',
    'exception.damaged': '商品损坏',
    'exception.customs_delay': '清关延迟',
    'exception.wrong_address': '地址错误',
    'exception.weight_mismatch': '重量不符',
    'exception.system_error': '系统错误',

    // 消息
    'message.upload_success': '上传成功',
    'message.upload_error': '上传失败',
    'message.processing': '处理中...',
    'message.no_data': '无数据',
  },

  en: {
    // Menu
    'menu.dashboard': 'Dashboard',
    'menu.drop_shipping': 'Drop Shipping',
    'menu.preparation': 'Preparation & Transshipment',
    'menu.wave_management': 'Wave Management',
    'menu.second_sorting': 'Second Sorting',
    'menu.inspection': 'Inspection',
    'menu.package_check': 'Package Check',
    'menu.weight_check': 'Weight Check',
    'menu.returns': 'Exchange / Return',
    'menu.exceptions': 'Exception Handling',
    'menu.cutoff': 'Cut-off',

    // Status
    'status.pending': 'Pending',
    'status.in_progress': 'In Progress',
    'status.completed': 'Completed',
    'status.delayed': 'Delayed',
    'status.error': 'Error',
    'status.returned': 'Returned',

    // Process Steps
    'step.drop_shipping': 'Drop Shipping',
    'step.preparation': 'Preparation',
    'step.wave_management': 'Wave Management',
    'step.second_sorting': 'Second Sorting',
    'step.inspection': 'Inspection',
    'step.package_check': 'Package Check',
    'step.weight_check': 'Weight Check',
    'step.completed': 'Completed',
    'step.exception': 'Exception',

    // Buttons
    'button.upload': 'Upload',
    'button.download': 'Download',
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.approve': 'Approve',
    'button.reject': 'Reject',
    'button.resolve': 'Resolve',
    'button.notify': 'Notify',

    // Customs
    'customs.pending': 'Pending',
    'customs.in_progress': 'In Progress',
    'customs.cleared': 'Cleared',
    'customs.delayed': 'Delayed',
    'customs.rejected': 'Rejected',

    // Shipping Method
    'shipping.air': 'Air',
    'shipping.sea': 'Sea',
    'shipping.express': 'Express',

    // Severity
    'severity.low': 'Low',
    'severity.medium': 'Medium',
    'severity.high': 'High',
    'severity.critical': 'Critical',

    // Exception Types
    'exception.missing_item': 'Missing Item',
    'exception.duplicate': 'Duplicate',
    'exception.damaged': 'Damaged',
    'exception.customs_delay': 'Customs Delay',
    'exception.wrong_address': 'Wrong Address',
    'exception.weight_mismatch': 'Weight Mismatch',
    'exception.system_error': 'System Error',

    // Messages
    'message.upload_success': 'Upload Successful',
    'message.upload_error': 'Upload Failed',
    'message.processing': 'Processing...',
    'message.no_data': 'No Data',
  }
};

export type Language = 'ko' | 'zh' | 'en';

export function translate(key: string, lang: Language = 'ko'): string {
  return translations[lang][key as keyof typeof translations.ko] || key;
}

export function useTranslation(lang: Language = 'ko') {
  return {
    t: (key: string) => translate(key, lang),
    lang
  };
}


'use client';

export default function ReportsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">CS/물류 KPI 보고서</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">평균 응답 시간</div>
            <div className="text-2xl font-bold text-blue-600">30초</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">자동응답률</div>
            <div className="text-2xl font-bold text-green-600">72%</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">정확도</div>
            <div className="text-2xl font-bold text-purple-600">96%</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">지연 건수</div>
            <div className="text-2xl font-bold text-orange-600">5건</div>
          </div>
        </div>

        <div className="text-center text-gray-500 py-8">
          상세 차트 및 리포트는 구현 예정입니다
        </div>
      </div>
    </div>
  );
}


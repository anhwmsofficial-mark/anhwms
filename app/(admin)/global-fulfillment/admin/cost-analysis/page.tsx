'use client';

import { useState } from 'react';
import {
  CurrencyDollarIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface CostData {
  carrier: string;
  icon: string;
  weeklyOrders: number;
  totalCost: number;
  avgCostPerOrder: number;
  trend: 'up' | 'down';
  trendPercent: number;
  deliveryDays: number;
  monthlyData: {
    month: string;
    orders: number;
    cost: number;
  }[];
}

const SAMPLE_COST_DATA: CostData[] = [
  {
    carrier: '한진택배',
    icon: '🚚',
    weeklyOrders: 542,
    totalCost: 9850000,
    avgCostPerOrder: 18170,
    trend: 'up',
    trendPercent: 5.2,
    deliveryDays: 2.3,
    monthlyData: [
      { month: '9월', orders: 2150, cost: 38500000 },
      { month: '10월', orders: 2280, cost: 41200000 },
      { month: '11월', orders: 2420, cost: 44100000 },
      { month: '12월', orders: 2580, cost: 47800000 }
    ]
  },
  {
    carrier: 'CJ대한통운',
    icon: '📦',
    weeklyOrders: 487,
    totalCost: 9120000,
    avgCostPerOrder: 18724,
    trend: 'up',
    trendPercent: 3.8,
    deliveryDays: 2.1,
    monthlyData: [
      { month: '9월', orders: 1890, cost: 34800000 },
      { month: '10월', orders: 1950, cost: 36200000 },
      { month: '11월', orders: 2080, cost: 39100000 },
      { month: '12월', orders: 2180, cost: 41500000 }
    ]
  },
  {
    carrier: '顺丰速运',
    icon: '⚡',
    weeklyOrders: 312,
    totalCost: 7450000,
    avgCostPerOrder: 23878,
    trend: 'down',
    trendPercent: 2.1,
    deliveryDays: 3.5,
    monthlyData: [
      { month: '9월', orders: 1280, cost: 31200000 },
      { month: '10월', orders: 1320, cost: 32100000 },
      { month: '11월', orders: 1250, cost: 29800000 },
      { month: '12월', orders: 1180, cost: 28200000 }
    ]
  },
  {
    carrier: 'EMS',
    icon: '✈️',
    weeklyOrders: 148,
    totalCost: 2530000,
    avgCostPerOrder: 17095,
    trend: 'down',
    trendPercent: 7.3,
    deliveryDays: 4.2,
    monthlyData: [
      { month: '9월', orders: 680, cost: 11850000 },
      { month: '10월', orders: 620, cost: 10720000 },
      { month: '11월', orders: 580, cost: 9980000 },
      { month: '12월', orders: 560, cost: 9420000 }
    ]
  }
];

export default function CostAnalysisPage() {
  const [data] = useState<CostData[]>(SAMPLE_COST_DATA);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');

  // 전체 통계
  const totalStats = {
    totalOrders: data.reduce((sum, d) => sum + d.weeklyOrders, 0),
    totalCost: data.reduce((sum, d) => sum + d.totalCost, 0),
    avgCostPerOrder: data.reduce((sum, d) => sum + d.avgCostPerOrder, 0) / data.length,
    mostExpensive: data.reduce((prev, current) => 
      prev.avgCostPerOrder > current.avgCostPerOrder ? prev : current
    ),
    cheapest: data.reduce((prev, current) => 
      prev.avgCostPerOrder < current.avgCostPerOrder ? prev : current
    ),
    fastest: data.reduce((prev, current) => 
      prev.deliveryDays < current.deliveryDays ? prev : current
    )
  };

  // 월별 전체 데이터
  const monthlyTotals = ['9월', '10월', '11월', '12월'].map(month => ({
    month,
    totalCost: data.reduce((sum, carrier) => {
      const monthData = carrier.monthlyData.find(m => m.month === month);
      return sum + (monthData?.cost || 0);
    }, 0),
    totalOrders: data.reduce((sum, carrier) => {
      const monthData = carrier.monthlyData.find(m => m.month === month);
      return sum + (monthData?.orders || 0);
    }, 0)
  }));

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💰 비용 분석</h1>
          <p className="text-sm text-gray-600 mt-1">
            물류사별 비용 분석 및 최적화 제안
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'week'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            주간
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'month'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            월간
          </button>
          <button
            onClick={() => setSelectedPeriod('quarter')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'quarter'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            분기
          </button>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <CurrencyDollarIcon className="h-8 w-8 text-purple-600" />
          </div>
          <div className="text-sm text-purple-700 font-medium">총 운임</div>
          <div className="text-3xl font-bold text-purple-900 mt-1">
            ₩{(totalStats.totalCost / 1000000).toFixed(1)}M
          </div>
          <p className="text-xs text-purple-600 mt-2">이번 주</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TruckIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="text-sm text-blue-700 font-medium">배송 건수</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">
            {totalStats.totalOrders.toLocaleString()}
          </div>
          <p className="text-xs text-blue-600 mt-2">전체 물류사</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-sm text-green-700 font-medium">평균 운임</div>
          <div className="text-3xl font-bold text-green-900 mt-1">
            ₩{totalStats.avgCostPerOrder.toLocaleString()}
          </div>
          <p className="text-xs text-green-600 mt-2">건당</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <ChartBarIcon className="h-8 w-8 text-orange-600" />
          </div>
          <div className="text-sm text-orange-700 font-medium">최저가 물류사</div>
          <div className="text-2xl font-bold text-orange-900 mt-1">
            {totalStats.cheapest.carrier}
          </div>
          <p className="text-xs text-orange-600 mt-2">
            ₩{totalStats.cheapest.avgCostPerOrder.toLocaleString()}/건
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 물류사별 비용 상세 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              물류사별 비용 상세
            </h2>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {data.map((carrier, idx) => (
              <div key={idx} className="border-2 border-gray-200 rounded-lg p-4 hover:border-purple-300 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{carrier.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{carrier.carrier}</h3>
                      <p className="text-sm text-gray-600">{carrier.weeklyOrders}건 배송</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      ₩{(carrier.totalCost / 1000).toLocaleString()}K
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {carrier.trend === 'up' ? (
                        <ArrowTrendingUpIcon className="h-4 w-4 text-red-600" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />
                      )}
                      <span className={`text-sm font-semibold ${
                        carrier.trend === 'up' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {carrier.trendPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-xs text-gray-600">건당 평균</div>
                    <div className="text-lg font-semibold text-blue-600">
                      ₩{carrier.avgCostPerOrder.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-xs text-gray-600">배송일</div>
                    <div className="text-lg font-semibold text-green-600">
                      {carrier.deliveryDays}일
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-xs text-gray-600">주간 건수</div>
                    <div className="text-lg font-semibold text-purple-600">
                      {carrier.weeklyOrders}
                    </div>
                  </div>
                </div>

                {/* 월별 추이 차트 */}
                <div>
                  <div className="text-xs text-gray-600 mb-2">월별 비용 추이</div>
                  <div className="flex items-end gap-2 h-24">
                    {carrier.monthlyData.map((month, monthIdx) => {
                      const maxCost = Math.max(...carrier.monthlyData.map(m => m.cost));
                      const height = (month.cost / maxCost) * 100;
                      return (
                        <div key={monthIdx} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-700 hover:to-purple-500 transition-all cursor-pointer"
                            style={{ height: `${height}%`, minHeight: '20px' }}
                            title={`₩${(month.cost / 1000000).toFixed(1)}M`}
                          />
                          <span className="text-xs text-gray-500">{month.month}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-600">
                    <span>
                      최저: ₩{(Math.min(...carrier.monthlyData.map(m => m.cost)) / 1000000).toFixed(1)}M
                    </span>
                    <span>
                      최고: ₩{(Math.max(...carrier.monthlyData.map(m => m.cost)) / 1000000).toFixed(1)}M
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 비용 비교 및 인사이트 */}
        <div className="space-y-6">
          {/* 월별 전체 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                월별 전체 비용 추이
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-4 h-48">
                {monthlyTotals.map((month, idx) => {
                  const maxCost = Math.max(...monthlyTotals.map(m => m.totalCost));
                  const height = (month.totalCost / maxCost) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="text-sm font-semibold text-purple-600 mb-2">
                        ₩{(month.totalCost / 1000000).toFixed(1)}M
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer"
                        style={{ height: `${height}%`, minHeight: '40px' }}
                      />
                      <div className="mt-2 text-center">
                        <div className="font-semibold text-gray-900">{month.month}</div>
                        <div className="text-xs text-gray-600">{month.totalOrders}건</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 물류사 비교 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">물류사 비교 분석</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* 가격 비교 */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-700">💰 건당 평균 비용</h3>
                {data.sort((a, b) => a.avgCostPerOrder - b.avgCostPerOrder).map((carrier, idx) => (
                  <div key={idx} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{carrier.icon} {carrier.carrier}</span>
                      <span className="font-semibold">₩{carrier.avgCostPerOrder.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          idx === 0 ? 'bg-green-500' :
                          idx === 1 ? 'bg-blue-500' :
                          idx === 2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${(carrier.avgCostPerOrder / data[data.length - 1].avgCostPerOrder) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 배송 속도 */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-700">⚡ 평균 배송일</h3>
                {data.sort((a, b) => a.deliveryDays - b.deliveryDays).map((carrier, idx) => (
                  <div key={idx} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{carrier.icon} {carrier.carrier}</span>
                      <span className="font-semibold">{carrier.deliveryDays}일</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          idx === 0 ? 'bg-green-500' :
                          idx === 1 ? 'bg-blue-500' :
                          idx === 2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${(carrier.deliveryDays / 5) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 절감 기회 */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5" />
              💡 비용 절감 기회
            </h3>
            <div className="space-y-3 text-sm">
              <div className="bg-white rounded-lg p-3">
                <div className="text-green-600 font-semibold mb-1">✅ EMS 활용 증대</div>
                <p className="text-gray-700">
                  EMS가 건당 평균 <strong>₩{totalStats.cheapest.avgCostPerOrder.toLocaleString()}</strong>로 
                  가장 저렴합니다. 긴급하지 않은 배송은 EMS 활용을 권장합니다.
                </p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-blue-600 font-semibold mb-1">📊 顺丰速运 하락 추세</div>
                <p className="text-gray-700">
                  顺丰速运 사용량이 <strong>{SAMPLE_COST_DATA[2].trendPercent}% 감소</strong> 중입니다. 
                  국제특송 필요 시에만 선택적으로 사용하는 것이 효율적입니다.
                </p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-yellow-600 font-semibold mb-1">⚠️ 한진/CJ 운임 상승</div>
                <p className="text-gray-700">
                  한진택배와 CJ대한통운의 운임이 각각 <strong>{SAMPLE_COST_DATA[0].trendPercent}%</strong>, 
                  <strong>{SAMPLE_COST_DATA[1].trendPercent}% 상승</strong>했습니다. 
                  물류사와 재협상이 필요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

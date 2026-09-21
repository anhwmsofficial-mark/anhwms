import { formatInteger } from '@/utils/number-format';

type InboundQtyCellProps = {
  totalExpected: number;
  totalNormal: number;
  issueCounts?: {
    damaged?: number;
    missing?: number;
    other?: number;
  };
  hasReceipt?: boolean;
};

export function InboundQtyCell({
  totalExpected,
  totalNormal,
  issueCounts,
  hasReceipt = true,
}: InboundQtyCellProps) {
  const qtyDiff = totalNormal - totalExpected;
  const hasIssues = (issueCounts?.damaged || 0) + (issueCounts?.missing || 0) + (issueCounts?.other || 0) > 0;

  return (
    <>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="text-sm text-gray-500 w-12 text-right">{formatInteger(totalExpected)}</div>
        <div className="text-gray-300">→</div>
        <div
          className={`text-sm font-bold w-12 text-right ${
            hasIssues && totalNormal > 0 ? 'text-red-600' : 'text-gray-900'
          }`}
        >
          {hasReceipt ? formatInteger(totalNormal) : '-'}
        </div>
        {hasIssues && totalNormal > 0 && (
          <span className="text-xs text-red-500 font-bold">
            ({qtyDiff > 0 ? '+' : ''}
            {formatInteger(qtyDiff)})
          </span>
        )}
      </div>
      {((issueCounts?.damaged || 0) > 0 || (issueCounts?.missing || 0) > 0 || (issueCounts?.other || 0) > 0) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
          {(issueCounts?.damaged || 0) > 0 && (
            <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
              파손 {formatInteger(issueCounts?.damaged || 0)}
            </span>
          )}
          {(issueCounts?.missing || 0) > 0 && (
            <span className="text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
              분실 {formatInteger(issueCounts?.missing || 0)}
            </span>
          )}
          {(issueCounts?.other || 0) > 0 && (
            <span className="text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
              기타 {formatInteger(issueCounts?.other || 0)}
            </span>
          )}
        </div>
      )}
    </>
  );
}

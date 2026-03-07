import { getAuditLogsAction } from '@/app/actions/admin/audit';
import { format } from 'date-fns';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const action = resolvedParams.action as string;
  const entityType = resolvedParams.entityType as string;

  const { data: result, error } = await getAuditLogsAction({
    page,
    limit: 20,
    action,
    entityType,
  });

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  const logs = result?.data || [];
  const pagination = result?.pagination;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">감사 로그 (Audit Logs)</h1>
      </div>

      {/* Simple Filter UI (Can be enhanced) */}
      <div className="flex gap-2">
        <form className="flex gap-2 items-center">
            <select name="action" defaultValue={action} className="border p-2 rounded">
                <option value="">All Actions</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="INSPECT">INSPECT</option>
                <option value="LOGIN">LOGIN</option>
            </select>
            <input 
                name="entityType" 
                placeholder="Entity Type (e.g. INBOUND)" 
                defaultValue={entityType} 
                className="border p-2 rounded"
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Filter</button>
        </form>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.user?.email || log.user?.display_name || 'System'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${log.action === 'DELETE' ? 'bg-red-100 text-red-800' : 
                      log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-green-100 text-green-800'}`}>
                    {log.action_name || log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.entity_type || log.table_name} <br/>
                  <span className="text-xs text-gray-400">{log.record_id}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                  {log.request_id?.slice(0, 8)}...
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {JSON.stringify(log.metadata || log.new_value || log.old_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
            Page {pagination?.page} of {pagination?.totalPages} (Total {pagination?.total})
        </div>
        <div className="flex gap-2">
            {pagination && pagination.page > 1 && (
                <a href={`?page=${pagination.page - 1}&action=${action || ''}&entityType=${entityType || ''}`} className="border px-3 py-1 rounded">Prev</a>
            )}
            {pagination && pagination.page < pagination.totalPages && (
                <a href={`?page=${pagination.page + 1}&action=${action || ''}&entityType=${entityType || ''}`} className="border px-3 py-1 rounded">Next</a>
            )}
        </div>
      </div>
    </div>
  );
}

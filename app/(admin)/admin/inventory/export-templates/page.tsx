import { listExportTemplatesAction } from '@/app/actions/admin/export-templates';
import ExportTemplateManagerClient from './ExportTemplateManagerClient';

export default async function AdminInventoryExportTemplatesPage() {
  const result = await listExportTemplatesAction();

  return (
    <ExportTemplateManagerClient
      initialData={result.ok ? result.data : { templates: [], customers: [] }}
      initialError={result.ok ? null : result.error}
    />
  );
}

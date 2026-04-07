import { listExportTemplatesAction } from '@/app/actions/admin/export-templates';
import ExportTemplateManagerClient from './ExportTemplateManagerClient';

export default async function InventoryManagementTemplatesPage() {
  const result = await listExportTemplatesAction();

  return (
    <ExportTemplateManagerClient
      initialData={result.ok ? result.data : { templates: [], customers: [], setupRequired: false }}
      initialError={result.ok ? null : result.error}
    />
  );
}

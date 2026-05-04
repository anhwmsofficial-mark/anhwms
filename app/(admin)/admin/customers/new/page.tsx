import CustomerPartnerForm from '@/components/admin/customers/CustomerPartnerForm';

export default function NewCustomerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerPartnerForm mode="create" />
    </div>
  );
}

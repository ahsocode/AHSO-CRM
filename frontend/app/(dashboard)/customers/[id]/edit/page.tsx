import { CustomerFormScreen } from "../../_components/customer-form-screen";

export default function EditCustomerPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <CustomerFormScreen customerId={params.id} mode="edit" />;
}

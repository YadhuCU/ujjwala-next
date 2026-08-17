import { customerTxnOptions } from "@/lib/query-options";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertCircle,
  CircleDollarSign,
  Cylinder,
  Loader2,
} from "lucide-react";

type CustomerTxnInfoProps = {
  customerId: number;
};

export const CustomerTxnInfo = ({ customerId }: CustomerTxnInfoProps) => {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...customerTxnOptions(String(customerId)),
    enabled: !!customerId,
    select: (res) => res.data,
  });

  if (!customerId) return null;

  if (isLoading) {
    return (
      <Alert>
        <Loader2 className="animate-spin" />
        <AlertTitle>Loading</AlertTitle>
        <AlertDescription>
          Loading customer transaction information...
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Failed to load</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "Unable to load customer transaction information."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const pendingAmount = Number(data.pendingAmount ?? 0);
  const pendingCylinders = data.pendingCylinders ?? [];

  if (pendingAmount <= 0 && pendingCylinders.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pendingAmount > 0 && (
        <Alert className="min-w-[320px] flex-1" variant="info">
          <CircleDollarSign />
          <AlertTitle>Pending Amount</AlertTitle>
          <AlertDescription>
            Customer has an outstanding balance of{" "}
            <span className="font-semibold">
              ₹{pendingAmount.toLocaleString()}
            </span>
            .
          </AlertDescription>
        </Alert>
      )}

      {pendingCylinders.length > 0 && (
        <Alert className="min-w-[320px] flex-1" variant="warning">
          <Cylinder />
          <AlertTitle>Pending Cylinders</AlertTitle>
          <AlertDescription>
            <ul className="space-y-1">
              {pendingCylinders.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">
                    {item.product.name}
                  </span>
                  {" • "}
                  {item.pendingCylinder} cylinder
                  {item.pendingCylinder > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
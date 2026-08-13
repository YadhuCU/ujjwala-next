"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { PaymentType } from "@/generated/enums";
import {
  RecordPaymentFormSchema,
  RecordPaymentFormValues,
} from "@/module/customer-txn/customer-txn.form.schema";

type RecordPaymentDialogProps = {
  customerId: string;
};

/**
 * A payment that arrives outside any invoice — the customer walks in and pays
 * against their balance.
 */
export function RecordPaymentDialog({ customerId }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(
      RecordPaymentFormSchema,
    ) as Resolver<RecordPaymentFormValues>,
    defaultValues: { paymentMethod: PaymentType.CASH },
  });

  const paymentMutation = useApiMutation({
    url: `/api/customer-txn/${customerId}/payments`,
    invalidateKeys: [queryKeys.customerTxn.all, queryKeys.customers.all],
    onSuccess: () => {
      toast.success("Payment recorded");
      form.reset({ paymentMethod: PaymentType.CASH });
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              paymentMutation.mutate(values),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                      placeholder="Amount received"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Payment Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      {Object.values(PaymentType).map((method) => (
                        <FormItem key={method} className="flex items-center">
                          <FormControl>
                            <RadioGroupItem value={method} />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {method}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Cheque number, who collected it, …"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" isLoading={paymentMutation.isPending}>
              Record payment
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

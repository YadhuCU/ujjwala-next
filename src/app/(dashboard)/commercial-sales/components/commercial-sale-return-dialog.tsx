"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CommercialSaleType } from "@/generated/enums";
import {
  CylinderReturnFormSchema,
  CylinderReturnFormValues,
} from "@/module/commercial-sale/commercial-sale.form.schema";
import { CommercialSaleResponse } from "@/module/commercial-sale/commercial-sale.serializer";

type CylinderReturnDialogProps = {
  sale: CommercialSaleResponse;
};

/**
 * Recording a return is a separate business event — it PATCHes its own route
 * instead of editing the invoice.
 */
export function CylinderReturnDialog({ sale }: CylinderReturnDialogProps) {
  const [open, setOpen] = useState(false);

  const rentLines = sale.items.filter(
    (item) =>
      item.saleType === CommercialSaleType.RENT &&
      item.cylindersOutstanding > 0,
  );

  const form = useForm<CylinderReturnFormValues>({
    resolver: zodResolver(
      CylinderReturnFormSchema,
    ) as Resolver<CylinderReturnFormValues>,
    defaultValues: {
      items: rentLines.map((item) => ({ itemId: item.id, returnQty: 0 })),
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "items" });

  const returnMutation = useApiMutation({
    url: `/api/commercial-sales/${sale.id}/return`,
    method: "PATCH",
    invalidateKeys: [
      queryKeys.commercialSales.all,
      queryKeys.stocks.all,
      queryKeys.customerTxn.all,
    ],
    onSuccess: () => {
      toast.success("Cylinder return recorded");
      setOpen(false);
      form.reset();
    },
  });

  if (rentLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Record cylinder return">
          <Undo2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return cylinders — {sale.trNo}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              returnMutation.mutate(values),
            )}
            className="space-y-4"
          >
            {fields.map((field, index) => {
              const line = rentLines[index];
              return (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`items.${index}.returnQty`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>
                        {line.product?.name} — {line.cylindersOutstanding} with
                        customer
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={line.cylindersOutstanding}
                          {...f}
                          onChange={(e) =>
                            f.onChange(e.target.valueAsNumber || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              );
            })}

            <Button type="submit" isLoading={returnMutation.isPending}>
              Record return
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

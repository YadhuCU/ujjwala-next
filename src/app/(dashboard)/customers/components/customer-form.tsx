"use client";

import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLocations, useProducts } from "@/hooks/use-api";
import { customerSchema, type CustomerFormValues } from "@/lib/schemas";
import { Plus, Trash2 } from "lucide-react";

interface CustomerFormProps {
  defaultValues?: CustomerFormValues;
  isEditMode?: boolean;
  onSubmit: (values: CustomerFormValues) => void;
  isPending: boolean;
}

export function CustomerForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: CustomerFormProps) {
  const { data: locations = [] } = useLocations() as { data: { id: number; name: string | null }[] };
  const { data: rawProducts = [] } = useProducts("Commercial");
  const commercialProducts = rawProducts as { id: number; name: string | null }[];

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema) as Resolver<CustomerFormValues>,
    defaultValues: defaultValues ?? {
      name: "",
      phone: "",
      address: "",
      locationId: "",
      discount: 0,
      concernedPerson: "",
      concernedPersonMobile: "",
      gstNumber: "",
      initialCylinderBalance: 0,
      initialPendingAmount: 0,
      initialCylinderBalances: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "initialCylinderBalances",
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Customer Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input maxLength={10} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="locationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select Location" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="discount" render={({ field }) => (
                <FormItem><FormLabel>Discount (%)</FormLabel><FormControl>
                  <Input type="number" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="concernedPerson" render={({ field }) => (
                <FormItem><FormLabel>Concerned Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="concernedPersonMobile" render={({ field }) => (
                <FormItem><FormLabel>Concerned Person Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gstNumber" render={({ field }) => (
                <FormItem><FormLabel>GST Number</FormLabel><FormControl><Input maxLength={15} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="initialPendingAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Pending Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" min={0} {...field}
                      onChange={(e) => field.onChange(Math.round(e.target.valueAsNumber || 0))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* ─── Opening Cylinder Balance — per product ─── */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h3 className="text-sm font-semibold">Opening Cylinder Balance</h3>
                  <p className="text-xs text-muted-foreground">
                    Cylinders this customer already holds at account creation (per product).
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => append({ productId: "", quantity: 0 })}>
                  <Plus className="w-4 h-4 mr-1" /> Add Product
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No opening cylinder balance. Click &quot;Add Product&quot; to set one.
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3">
                  <FormField control={form.control} name={`initialCylinderBalances.${index}.productId`}
                    render={({ field: ff }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Product</FormLabel>
                        <Select onValueChange={ff.onChange} value={ff.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select Commercial Product" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {commercialProducts.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <FormField control={form.control} name={`initialCylinderBalances.${index}.quantity`}
                    render={({ field: ff }) => (
                      <FormItem className="w-28">
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...ff}
                            onChange={(e) => ff.onChange(e.target.valueAsNumber || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <Button type="button" variant="ghost" size="icon"
                    className="text-destructive mb-0.5" onClick={() => remove(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Update Customer" : "Save Customer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

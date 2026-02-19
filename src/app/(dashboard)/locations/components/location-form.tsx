"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  district: z.string().optional().or(z.literal("")),
  pincode: z.string().optional().or(z.literal("")),
  locality: z.string().optional().or(z.literal("")),
});

export type LocationFormValues = z.infer<typeof locationSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface LocationFormProps {
  defaultValues?: LocationFormValues;
  isEditMode?: boolean;
  onSubmit: (values: LocationFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LocationForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: LocationFormProps) {
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: defaultValues ?? { name: "", district: "", pincode: "", locality: "" },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Location Details</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="district" render={({ field }) => (
              <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="pincode" render={({ field }) => (
              <FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="locality" render={({ field }) => (
              <FormItem><FormLabel>Locality</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : isEditMode ? "Update" : "Save"}</Button>
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

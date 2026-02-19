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

export const userTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional().or(z.literal("")),
});

export type UserTypeFormValues = z.infer<typeof userTypeSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface UserTypeFormProps {
  defaultValues?: UserTypeFormValues;
  isEditMode?: boolean;
  onSubmit: (values: UserTypeFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UserTypeForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: UserTypeFormProps) {
  const form = useForm<UserTypeFormValues>({
    resolver: zodResolver(userTypeSchema),
    defaultValues: defaultValues ?? { name: "", role: "" },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>User Type Details</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem><FormLabel>Role</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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

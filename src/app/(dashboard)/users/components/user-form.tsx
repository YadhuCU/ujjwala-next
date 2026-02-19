"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useUserTypes } from "@/hooks/use-api";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  username: z.string().optional().or(z.literal("")),
  name: z.string().min(1, "Name is required"),
  password: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  usertypeId: z.string().optional().or(z.literal("")),
});

export type UserFormValues = z.infer<typeof userSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserType {
  id: number;
  name: string | null;
  role: string | null;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface UserFormProps {
  defaultValues?: UserFormValues;
  isEditMode?: boolean;
  onSubmit: (values: UserFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UserForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: UserFormProps) {
  const { data: rawUserTypes = [] } = useUserTypes();
  const userTypes = rawUserTypes as UserType[];

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: defaultValues ?? {
      username: "",
      name: "",
      password: "",
      email: "",
      mobile: "",
      usertypeId: "",
    },
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>User Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-2 items-start">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEditMode
                      ? "Password (leave blank to keep unchanged)"
                      : "Password"}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usertypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Update" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

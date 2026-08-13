"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
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
import { rolesOptions } from "@/lib/query-options";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  UserCreateFormSchema,
  UserUpdateFormSchema,
  type UserFormValues,
} from "@/module/user/user.form.schema";

export type { UserFormValues };

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
  const { data: roles } = useSuspenseQuery({
    ...rolesOptions,
    select: (res) => {
      return res.data.map((x) => ({ label: x.name, value: x.id }));
    },
  });

  // On create the username and password are required; on edit the username is
  // fixed and a blank password means "keep the current one".
  const form = useForm<UserFormValues>({
    resolver: zodResolver(
      isEditMode ? UserUpdateFormSchema : UserCreateFormSchema,
    ) as Resolver<UserFormValues>,
    defaultValues: defaultValues ?? {
      username: "",
      name: "",
      password: "",
      email: "",
      mobile: "",
      userRoles: [],
    },
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>User Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 lg:grid-cols-2 items-start"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isEditMode} />
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
              name="userRoles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange([Number(value)])}
                    value={String(field.value[0] ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={String(role.value)}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                isLoading={isPending}
              >
                {isEditMode ? "Update" : "Save"}
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

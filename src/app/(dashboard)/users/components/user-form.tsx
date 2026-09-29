"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
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
    select: (res) => res.data,
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
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start"
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
            {/* A user may hold several roles; their permissions are the union.
                This used to be a single-select writing an array of one, which
                silently dropped the extra roles of a multi-role user on save. */}
            <FormField
              control={form.control}
              name="userRoles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <FormDescription>
                    Pick one or more. The user can do anything any of their
                    roles allows.
                  </FormDescription>
                  <FormControl>
                    <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                      {roles.map((role) => {
                        const checked = field.value.includes(role.id);

                        return (
                          <label
                            key={role.id}
                            className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded p-2"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                field.onChange(
                                  checked
                                    ? field.value.filter((id) => id !== role.id)
                                    : [...field.value, role.id],
                                )
                              }
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-sm font-medium">
                                {role.name}
                                {role.isSystem && (
                                  <Badge variant="outline">full access</Badge>
                                )}
                              </span>
                              {role.description && (
                                <span className="text-muted-foreground block text-xs">
                                  {role.description}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3 sm:flex pt-2">
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

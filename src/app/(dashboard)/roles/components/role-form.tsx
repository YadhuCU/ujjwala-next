"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  RoleFormSchema,
  type RoleFormValues,
} from "@/module/role/role.form.schema";
import { PermissionMatrix } from "./permission-matrix";

interface RoleFormProps {
  defaultValues?: RoleFormValues;
  isEditMode?: boolean;
  /** A system role is shown for reference but cannot be changed. */
  isSystem?: boolean;
  onSubmit: (values: RoleFormValues) => void;
  isPending: boolean;
}

export function RoleForm({
  defaultValues,
  isEditMode = false,
  isSystem = false,
  onSubmit,
  isPending,
}: RoleFormProps) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(RoleFormSchema),
    defaultValues: defaultValues ?? {
      name: "",
      description: "",
      permissionCodes: [],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {isSystem && (
          <div className="border-primary/40 bg-primary/5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
            <Lock className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">This is a system role</p>
              <p className="text-muted-foreground">
                It always holds every permission and cannot be renamed, edited
                or deleted. That is what guarantees there is a way back in if
                another role is misconfigured.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isEditMode ? "Edit role" : "New role"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Accountant"
                      disabled={isSystem}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What this role is for"
                      rows={2}
                      disabled={isSystem}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Shown on the roles list, to explain the intent to whoever
                    edits it next.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="permissionCodes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PermissionMatrix
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSystem}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!isSystem && (
          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isEditMode
                  ? "Save changes"
                  : "Create role"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}

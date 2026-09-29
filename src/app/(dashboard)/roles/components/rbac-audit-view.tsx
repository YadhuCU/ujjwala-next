"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rbacAuditOptions } from "@/lib/query-options";
import type { RbacAuditResponse } from "@/module/role/rbac-audit.serializer";

const ACTION_LABELS: Record<string, string> = {
  ROLE_CREATED: "Role created",
  ROLE_UPDATED: "Role changed",
  ROLE_DELETED: "Role deleted",
  USER_ROLES_CHANGED: "User's roles changed",
};

export function RbacAuditViewComponent() {
  const { data } = useSuspenseQuery(rbacAuditOptions({ limit: 50 }));
  const entries = data.data;

  return (
    <Card>
      <CardContent className="pt-6 max-sm:pt-0">
        {/* Phones: one entry per block, the change badges given the full width */}
        <ul className="divide-y md:hidden">
          {entries.length === 0 ? (
            <li className="text-muted-foreground py-8 text-center text-sm">
              No access changes recorded yet. Creating or editing a role, or
              changing which roles a user holds, appears here.
            </li>
          ) : (
            entries.map((entry) => (
              <li key={entry.id} className="space-y-1.5 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-medium">
                    {entry.roleName ?? entry.targetUserName ?? "—"}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {new Date(entry.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {ACTION_LABELS[entry.action] ?? entry.action} by{" "}
                  {entry.actor}
                </p>
                <Change entry={entry} />
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No access changes recorded yet. Creating or editing a role,
                    or changing which roles a user holds, appears here.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>{entry.actor}</TableCell>
                    <TableCell>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.roleName ?? entry.targetUserName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Change entry={entry} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          Append-only: entries are never edited or removed, and they keep the
          name of a role or user even after it has been deleted.
        </p>
      </CardContent>
    </Card>
  );
}

function Change({ entry }: { entry: RbacAuditResponse }) {
  if (entry.added.length === 0 && entry.removed.length === 0) {
    return <span className="text-muted-foreground">no change</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entry.added.map((code) => (
        <Badge
          key={`+${code}`}
          variant="outline"
          className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
        >
          <Plus className="mr-1 h-3 w-3" />
          {code}
        </Badge>
      ))}
      {entry.removed.map((code) => (
        <Badge
          key={`-${code}`}
          variant="outline"
          className="border-destructive/40 text-destructive"
        >
          <Minus className="mr-1 h-3 w-3" />
          {code}
        </Badge>
      ))}
    </div>
  );
}

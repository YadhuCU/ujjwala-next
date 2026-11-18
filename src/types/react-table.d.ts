import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    /** Name in the Columns menu, for a column whose header is not plain text. */
    label?: string;
  }
}

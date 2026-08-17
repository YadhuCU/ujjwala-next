"use client";

import { Loader2 } from "lucide-react";
const LayoutLoader = () => {
  return (
    <div className="h-screen flex items-center justify-center flex-col space-y-2">
      <span className="inline-flex gap-1 items-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span>Loading....</span>
      </span>
    </div>
  );
};

export default LayoutLoader;

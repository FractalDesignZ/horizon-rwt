import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-md border border-border bg-elevated p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-sm px-3 text-xs font-medium text-muted",
        "data-[state=active]:bg-surface data-[state=active]:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

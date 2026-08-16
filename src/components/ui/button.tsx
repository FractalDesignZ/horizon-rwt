import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98]",
        secondary:
          "border border-border bg-elevated text-fg hover:bg-surface",
        ghost: "text-muted hover:bg-elevated hover:text-fg",
        danger: "bg-danger text-fg hover:opacity-90",
      },
      size: {
        default: "h-10 rounded-sm px-4 text-sm",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-md px-5 text-sm",
        icon: "size-10 rounded-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

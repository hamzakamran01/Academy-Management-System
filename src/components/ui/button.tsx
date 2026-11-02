import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover",
        secondary: "bg-surface text-fg border border-border shadow-xs hover:bg-surface-2",
        soft: "bg-primary-soft text-primary-soft-fg hover:brightness-[0.97]",
        ghost: "text-fg hover:bg-surface-2",
        danger: "bg-danger text-white shadow-xs hover:brightness-95",
        "danger-soft": "bg-danger-soft text-danger-fg hover:brightness-[0.97]",
        success: "bg-success text-white shadow-xs hover:brightness-95",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 rounded-md px-3 text-sm [&_svg]:size-4",
        md: "h-11 rounded-lg px-4 text-[15px] [&_svg]:size-[18px]",
        lg: "h-12 rounded-lg px-5 text-base [&_svg]:size-5",
        icon: "size-11 rounded-lg [&_svg]:size-5",
        "icon-sm": "size-9 rounded-md [&_svg]:size-[18px]",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export type ButtonProps = ComponentProps<"button"> & Variants & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

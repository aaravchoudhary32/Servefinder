import { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

type Props = ButtonAsButton | ButtonAsLink;

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-moss text-white shadow-soft hover:bg-moss-dark hover:shadow-pop hover:-translate-y-px",
  secondary:
    "bg-white text-ink border border-line hover:border-moss hover:shadow-pop hover:-translate-y-px",
  outline:
    "bg-transparent text-ink border border-line hover:border-marigold",
  ghost: "bg-transparent text-ink/70 hover:text-ink underline underline-offset-2",
  destructive:
    "bg-red-700 text-white hover:bg-red-800 disabled:hover:bg-red-700",
};

const SIZES: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  href,
  ...props
}: Props) {
  const classes = `rounded-card font-medium transition-all duration-200 ease-smooth active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none disabled:translate-y-0 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} {...(props as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">)} />
    );
  }

  return <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}

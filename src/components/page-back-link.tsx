import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PageBackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link className="contentBackLink" href={href}>
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}

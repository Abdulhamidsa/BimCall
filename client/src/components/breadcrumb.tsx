import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
      data-testid="breadcrumb-nav"
    >
      <Link href="/">
        <span className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer" data-testid="breadcrumb-home">
          <Home className="h-4 w-4" />
        </span>
      </Link>
      
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          {item.href ? (
            <Link href={item.href}>
              <span 
                className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                data-testid={`breadcrumb-${index}`}
              >
                {item.icon}
                <span className="max-w-[200px] truncate">{item.label}</span>
              </span>
            </Link>
          ) : (
            <span 
              className="flex items-center gap-1.5 text-foreground font-medium"
              data-testid={`breadcrumb-${index}`}
            >
              {item.icon}
              <span className="max-w-[200px] truncate">{item.label}</span>
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

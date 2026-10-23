import type { ReactNode } from "react";
import { PAGE_GAP, pageNumbers } from "@/lib/pagination";
import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function StepButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="pill" disabled={disabled} onClick={onClick} className="disabled:opacity-40">
      {children}
    </Button>
  );
}

/** Prev / numbered pages / Next. Renders nothing when everything fits on one page. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <StepButton disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        ← Prev
      </StepButton>
      {pageNumbers(page, totalPages).map((entry, i) =>
        entry === PAGE_GAP ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted">
            {PAGE_GAP}
          </span>
        ) : (
          <Button
            key={entry}
            variant="pill"
            active={entry === page}
            aria-current={entry === page ? "page" : undefined}
            aria-label={`Page ${entry}`}
            onClick={() => onPageChange(entry)}
            className="min-w-10"
          >
            {entry}
          </Button>
        ),
      )}
      <StepButton disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
        Next →
      </StepButton>
    </nav>
  );
}

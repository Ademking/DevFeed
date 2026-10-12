import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A horizontal row that scrolls with arrow buttons (shown only when there's
 * more in that direction) and with the mouse wheel.
 */
export const ScrollRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    // A vertical wheel moves the row sideways; trackpads already scroll horizontally.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [update]);

  // Children change (feeds turned on or off) can change the width.
  useEffect(update);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className={cn("relative flex min-w-0 flex-1 items-center", className)}>
      {canLeft && (
        <div className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center bg-gradient-to-r from-background from-60% to-transparent pe-6">
          <Button
            aria-label="Scroll left"
            className="pointer-events-auto"
            onClick={() => scrollBy(-1)}
            size="icon-xs"
            variant="ghost"
          >
            <ChevronLeft />
          </Button>
        </div>
      )}
      <div
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={update}
        ref={ref}
      >
        {children}
      </div>
      {canRight && (
        <div className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center bg-gradient-to-l from-background from-60% to-transparent ps-6">
          <Button
            aria-label="Scroll right"
            className="pointer-events-auto"
            onClick={() => scrollBy(1)}
            size="icon-xs"
            variant="ghost"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
};

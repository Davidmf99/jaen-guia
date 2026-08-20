import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-[420px] w-full rounded-none" />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Skeleton className="mb-5 h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-56 md:col-span-1" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

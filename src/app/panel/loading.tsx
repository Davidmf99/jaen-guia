import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-72 max-w-full" />

      <div className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </main>
  );
}

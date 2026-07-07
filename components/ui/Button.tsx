export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="
      px-6 py-3
      rounded-full

      bg-white
      text-black
      font-medium

      hover:bg-white/90
      transition

      text-sm md:text-base
    ">
      {children}
    </button>
  );
}
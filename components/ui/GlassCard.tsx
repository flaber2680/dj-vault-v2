type Props = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: Props) {
  return (
    <div
      className={`
        rounded-3xl

        border border-white/10
        bg-white/[0.03]

        backdrop-blur-2xl

        shadow-[0_20px_60px_rgba(0,0,0,0.6)]

        transition-all duration-300

        hover:bg-white/[0.05]
        hover:border-white/15

        ${className}
      `}
    >
      {children}
    </div>
  );
}
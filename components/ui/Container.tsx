type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: Props) {
  return (
    <div
      className={`
        w-full
        max-w-[1200px]
        mx-auto
        px-6 md:px-10
        ${className}
      `}
    >
      {children}
    </div>
  );
}
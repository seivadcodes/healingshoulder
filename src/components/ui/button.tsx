// Must accept className and children, and render a <button>
export default function Button({
  children,
  className = '',
  variant = 'default',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline';
  [key: string]: any;
}) {
  const baseClasses = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
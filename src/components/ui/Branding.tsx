import Image from 'next/image';

interface BrandingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Branding({ size = 'md', className }: BrandingProps) {
  const dimensions = {
    sm: { width: 32, height: 32 },
    md: { width: 120, height: 40 },
    lg: { width: 150, height: 50 },
    xl: { width: 200, height: 67 },
  };

  const dimension = dimensions[size] || dimensions.md; // Fallback to 'md' if size is invalid

  return (
    <Image
      src="/images/dcconcretos/logo-dark.svg"
      alt="DC Concretos"
      width={dimension.width}
      height={dimension.height}
      className={className}
      priority
    />
  );
}
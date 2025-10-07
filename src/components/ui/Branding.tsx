import Image from 'next/image';

interface BrandingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  // When true, use the client-portal specific logo image
  variant?: 'default' | 'client-portal';
}

export function Branding({ size = 'md', className, variant = 'default' }: BrandingProps) {
  const dimensions = {
    sm: { width: 32, height: 32 },
    md: { width: 120, height: 40 },
    lg: { width: 150, height: 50 },
    xl: { width: 200, height: 67 },
  };

  const dimension = dimensions[size] || dimensions.md; // Fallback to 'md' if size is invalid

  const src = variant === 'client-portal'
    ? '/images/client-portal-logo.png'
    : '/images/dcconcretos/logo-dark.svg';

  return (
    <Image
      src={src}
      alt={variant === 'client-portal' ? 'DC Hub' : 'DC Concretos'}
      width={dimension.width}
      height={dimension.height}
      className={className}
      priority
    />
  );
}
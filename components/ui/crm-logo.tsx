import Image from 'next/image';

interface CrmLogoProps {
  readonly size?: number;
  readonly className?: string;
}

export function CrmLogo({ size = 28, className = '' }: CrmLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="CRM Sales"
      width={size}
      height={size}
      className={className ? `crm-logo ${className}` : 'crm-logo'}
      priority
    />
  );
}

import { CompanyLogo } from "@/components/CompanyLogo";
import type { Company } from "@/lib/orders";

// The three company logos shown in every report header: first on the left, the others grouped on the right.
export function companyLogos(c: Company): string[] {
  return [c.logo, c.logo2, c.logo3].filter((s): s is string => Boolean(s));
}

export function CompanyHeader({
  company,
  className = "",
  dataPdfBlock = false,
  nameClass = "font-display text-lg font-bold",
  infoClass = "whitespace-pre-wrap text-xs text-muted-foreground",
}: {
  company: Company | null;
  className?: string;
  dataPdfBlock?: boolean;
  nameClass?: string;
  infoClass?: string;
}) {
  if (!company) return null;
  const logos = companyLogos(company);
  if (!logos.length && !company.name) return null;
  // Three logos on one line would overflow the A4 report, so they share a smaller box.
  const cap = logos.length >= 3 ? { maxW: 120, maxH: 52 } : { maxW: 180, maxH: 72 };
  const [first, ...rest] = logos;
  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`} data-pdf-block={dataPdfBlock || undefined}>
      {first && <CompanyLogo src={first} {...cap} />}
      <div>
        {company.name && <p className={nameClass}>{company.name}</p>}
        {company.info && <p className={infoClass}>{company.info}</p>}
      </div>
      {rest.length > 0 && (
        <div className="ml-auto flex items-center gap-4">
          {rest.map((src) => (
            <CompanyLogo key={src.slice(-24)} src={src} {...cap} />
          ))}
        </div>
      )}
    </div>
  );
}

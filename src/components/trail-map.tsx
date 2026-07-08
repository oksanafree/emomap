type TrailMapProps = {
  protectingLabel: string;
  buildingLabel: string;
  enduringLabel: string;
  receivingLabel: string;
};

export function TrailMap({
  protectingLabel,
  buildingLabel,
  enduringLabel,
  receivingLabel,
}: TrailMapProps) {
  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg
        viewBox="0 0 220 220"
        className="absolute left-0 top-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="110" cy="110" r="33" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        <circle cx="110" cy="110" r="68" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <circle cx="110" cy="110" r="102" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
        <line x1="0" y1="110" x2="220" y2="110" stroke="rgba(255,255,255,0.50)" strokeWidth="1" />
        <line x1="110" y1="0" x2="110" y2="220" stroke="rgba(255,255,255,0.50)" strokeWidth="1" />
        <text x="8" y="20" fontSize="9" fill="rgba(255,255,255,0.60)" fontWeight="700" letterSpacing="0.07em">
          {protectingLabel.toUpperCase()}
        </text>
        <text x="212" y="20" fontSize="9" fill="rgba(255,255,255,0.60)" fontWeight="700" letterSpacing="0.07em" textAnchor="end">
          {buildingLabel.toUpperCase()}
        </text>
        <text x="8" y="215" fontSize="9" fill="rgba(255,255,255,0.60)" fontWeight="700" letterSpacing="0.07em">
          {enduringLabel.toUpperCase()}
        </text>
        <text x="212" y="215" fontSize="9" fill="rgba(255,255,255,0.60)" fontWeight="700" letterSpacing="0.07em" textAnchor="end">
          {receivingLabel.toUpperCase()}
        </text>
        <line x1="110" y1="110" x2="128" y2="86" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" strokeDasharray="3,4" />
        <line x1="128" y1="86" x2="120" y2="104" stroke="rgba(255,255,255,0.11)" strokeWidth="1.2" strokeDasharray="3,4" />
        <line x1="120" y1="104" x2="82" y2="118" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" strokeDasharray="3,4" />
        <line x1="82" y1="118" x2="140" y2="76" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2" strokeDasharray="3,4" />
        <circle cx="110" cy="110" r="5.5" fill="rgba(255,255,255,0.15)" />
        <circle cx="128" cy="86" r="6" fill="rgba(255,255,255,0.18)" />
        <circle cx="120" cy="104" r="6.5" fill="rgba(255,255,255,0.20)" />
        <circle cx="82" cy="118" r="7" fill="rgba(255,255,255,0.22)" />
        <circle cx="140" cy="76" r="9" fill="#7c6cf0" opacity="0.9" />
        <circle cx="140" cy="76" r="14" fill="#7c6cf0" opacity="0.2" />
      </svg>
    </div>
  );
}

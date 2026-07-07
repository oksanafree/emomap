type OnboardingMapProps = {
  protectingLabel: string;
  buildingLabel: string;
  enduringLabel: string;
  receivingLabel: string;
};

export function OnboardingMap({
  protectingLabel,
  buildingLabel,
  enduringLabel,
  receivingLabel,
}: OnboardingMapProps) {
  return (
    <div className="relative h-[210px] w-[210px] shrink-0">
      <svg
        viewBox="0 0 200 200"
        className="absolute left-0 top-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="2" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        <line x1="0" y1="100" x2="200" y2="100" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        <line x1="100" y1="0" x2="100" y2="200" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        <text x="6" y="16" fontSize="9" fill="rgba(255,255,255,0.50)" fontWeight="700" letterSpacing="0.07em">
          {protectingLabel.toUpperCase()}
        </text>
        <text x="194" y="16" fontSize="9" fill="rgba(255,255,255,0.50)" fontWeight="700" letterSpacing="0.07em" textAnchor="end">
          {buildingLabel.toUpperCase()}
        </text>
        <text x="6" y="197" fontSize="9" fill="rgba(255,255,255,0.50)" fontWeight="700" letterSpacing="0.07em">
          {enduringLabel.toUpperCase()}
        </text>
        <text x="194" y="197" fontSize="9" fill="rgba(255,255,255,0.50)" fontWeight="700" letterSpacing="0.07em" textAnchor="end">
          {receivingLabel.toUpperCase()}
        </text>
        <circle cx="78" cy="112" r="5" fill="rgba(255,255,255,0.14)" />
        <circle cx="88" cy="105" r="5.5" fill="rgba(255,255,255,0.18)" />
        <circle cx="108" cy="88" r="6" fill="rgba(255,255,255,0.22)" />
        <line x1="78" y1="112" x2="88" y2="105" stroke="rgba(255,255,255,0.09)" strokeWidth="1.2" strokeDasharray="3,4" />
        <line x1="88" y1="105" x2="108" y2="88" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" strokeDasharray="3,4" />
        <line x1="108" y1="88" x2="124" y2="74" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeDasharray="3,4" />
        <circle cx="124" cy="74" r="9" fill="#7c6cf0" opacity="0.9" />
        <circle cx="124" cy="74" r="15" fill="#7c6cf0" opacity="0.14" />
      </svg>
    </div>
  );
}

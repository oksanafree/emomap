type OnboardingMilestonesProps = {
  firstLabel: string;
  secondLabel: string;
};

export function OnboardingMilestones({ firstLabel, secondLabel }: OnboardingMilestonesProps) {
  return (
    <svg width="240" height="80" viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="20" r="6" fill="#7c6cf0" opacity="0.9" />
      <text x="32" y="25" fontSize="14" fill="rgba(232,228,255,0.8)" fontFamily="-apple-system,sans-serif">
        {firstLabel}
      </text>
      <circle cx="16" cy="56" r="6" fill="#7c6cf0" opacity="0.5" />
      <text x="32" y="61" fontSize="14" fill="rgba(232,228,255,0.5)" fontFamily="-apple-system,sans-serif">
        {secondLabel}
      </text>
    </svg>
  );
}

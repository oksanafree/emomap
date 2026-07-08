type OnboardingSliderPreviewProps = {
  worldLabel: string;
  selfLabel: string;
};

export function OnboardingSliderPreview({ worldLabel, selfLabel }: OnboardingSliderPreviewProps) {
  return (
    <svg width="240" height="80" viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="14" fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="-apple-system,sans-serif" letterSpacing="0.1em">
        {worldLabel}
      </text>
      <rect x="0" y="22" width="240" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
      <rect x="0" y="22" width="168" height="3" rx="1.5" fill="#7c6cf0" opacity="0.6" />
      <circle cx="168" cy="23.5" r="8" fill="#7c6cf0" opacity="0.9" />
      <text x="0" y="54" fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="-apple-system,sans-serif" letterSpacing="0.1em">
        {selfLabel}
      </text>
      <rect x="0" y="62" width="240" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
      <rect x="0" y="62" width="80" height="3" rx="1.5" fill="#7c6cf0" opacity="0.6" />
      <circle cx="80" cy="63.5" r="8" fill="#7c6cf0" opacity="0.9" />
    </svg>
  );
}

export type ReportCard = {
  label: string;
  text: string;
};

export type StructuredReport = {
  report_type: "5_entry" | "14_entry";
  pattern_statement: string;
  cards: ReportCard[];
  axis_note: string | null;
  distortion_flag: string | null;
  map_story: string | null;
  something_to_sit_with: string;
};

export function formatReport(report: StructuredReport): string {
  const sections: string[] = [report.pattern_statement];

  for (const card of report.cards) {
    sections.push(`${card.label.toUpperCase()}\n${card.text}`);
  }

  if (report.map_story) {
    sections.push(report.map_story);
  }

  if (report.axis_note) {
    sections.push(report.axis_note);
  }

  if (report.distortion_flag) {
    sections.push(report.distortion_flag);
  }

  sections.push(report.something_to_sit_with);

  return sections.join("\n\n");
}

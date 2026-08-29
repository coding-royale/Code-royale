export const REPORT_REASONS = ["Harassment", "Cheating", "Spam", "Inappropriate Name"] as const;

export type ReportInput = {
  reporterId: string;
  reportedId: string;
  reason: string;
  description?: string;
};

export type ReportValidation = { error?: string };

/** Validate a user report before it is persisted. */
export function validateReport(input: ReportInput): ReportValidation {
  if (!input.reporterId || !input.reportedId) {
    return { error: "Missing reporter or reported user." };
  }
  if (input.reporterId === input.reportedId) {
    return { error: "You cannot report yourself." };
  }
  if (!REPORT_REASONS.includes(input.reason as (typeof REPORT_REASONS)[number])) {
    return { error: "Invalid report reason." };
  }
  if (input.description && input.description.length > 500) {
    return { error: "Description must be 500 characters or fewer." };
  }
  return {};
}
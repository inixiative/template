export type InquiryHandler = {
  autoApprove(db, inquiry: { id: string }): Promise<boolean>;
};

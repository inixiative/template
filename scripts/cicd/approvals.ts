import type { CicdConfig } from './config';

export type PullRequestReview = {
  id: number;
  authorId: number;
  authorType: 'User' | 'Bot';
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED' | 'COMMENTED' | 'PENDING';
  commitId: string;
  canApprove: boolean;
};

export const evaluateApprovals = (
  policy: CicdConfig['pullRequests'],
  headSha: string,
  authorId: number,
  reviews: PullRequestReview[],
) => {
  const latest = new Map<number, PullRequestReview>();
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (review.state === 'COMMENTED' || review.state === 'PENDING') continue;
    latest.set(review.authorId, review);
  }
  const eligible = [...latest.values()].filter(
    (review) =>
      review.authorId !== authorId && review.canApprove && (policy.allowBotApprovals || review.authorType === 'User'),
  );
  const approvals = eligible.filter((review) => review.state === 'APPROVED' && review.commitId === headSha);
  const changesRequested = eligible.some((review) => review.state === 'CHANGES_REQUESTED');
  return {
    approved: approvals.length >= policy.requiredApprovals && !changesRequested,
    count: approvals.length,
    required: policy.requiredApprovals,
    changesRequested,
  };
};

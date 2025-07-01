// Resource inclusion patterns for eager loading related data
// Define Prisma include patterns for each resource type
export const resourceInclusions: Record<string, any> = {
  user: {
    accounts: true
  },
  // Add more resources with their include patterns
  // Example:
  // post: {
  //   author: true,
  //   comments: {
  //     include: {
  //       user: true
  //     }
  //   }
  // }
};
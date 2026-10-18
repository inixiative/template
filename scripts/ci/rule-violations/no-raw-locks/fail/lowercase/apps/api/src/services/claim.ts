export const lock = (id: string) => `select * from "Job" where id = '${id}' for update`;

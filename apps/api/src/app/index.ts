import { app } from "src/app/app";

app.listen(process.env.PORT);
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

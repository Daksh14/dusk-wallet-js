import { Application } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();

app.use(async (context, next) => {
  try {
    await context.send({
      root: `./`,
      index: "index.html",
    });
  } catch {
    await next();
  }
});

// The domain for LOCAL_NODE for example purposes
app.use(oakCors({ origin: "http://localhost:8080" }));

console.log("Starting example server at http://localhost:8000/index.html");

await app.listen({ port: 8000 });

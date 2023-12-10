import { Application } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();

// The domain for LOCAL_NODE for example purposes
app.use(
  oakCors({
    origin: "http://127.0.0.1:8080",
  })
);

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

console.log(
  "Starting example server at http://127.0.0.1:8000/example/index.html"
);

await app.listen({ port: 8000 });

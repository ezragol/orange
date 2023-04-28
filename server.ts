type DirectoryListing = Record<string, Uint8Array>;

async function loadFrom(baseDir: string, subDir?: string) {
  const publicDir = subDir || "/";
  const sourceDir = Deno.cwd() + `/${baseDir}/${publicDir}`;
  const directory: DirectoryListing = {};

  for await (const entry of Deno.readDir(sourceDir)) {
    const path = entry.name;
    if (entry.isDirectory) {
      const subDirectory = await loadFrom(baseDir, `${publicDir}${path}/`);
      Object.assign(directory, subDirectory);
    } else {
      directory[publicDir + path] = await Deno.readFile(sourceDir + path);
    }
  }
  return directory;
}

function replyTo(client: Deno.RequestEvent) {
  // either ends up as [url, <null>, path]
  // or [url, path, <null>]
  // or [url, <null>, <null>]
  // then filters it
  // all because url may or may not have trailing slashes

  const pathMatcher = client.request.url
    .match(
      /^https?:\/\/[^/]+(?:(.*)+\/$|(.*)+$)/,
    )
    ?.filter((n) => n);

  if (pathMatcher != null) {
    let path = pathMatcher[1] || "";

    if (Object.hasOwn(files, path + "/index.html")) {
      path += "/index.html";
    }

    if (Object.hasOwn(files, path)) {
      client.respondWith(
        new Response(
          files[path],
          { status: 200 },
        ),
      );
      return;
    }
  }

  client.respondWith(
    new Response(
      files["/status/$404.html"],
      { status: 404 },
    ),
  );
}

async function useHandler(connection: Deno.Conn) {
  for await (const client of Deno.serveHttp(connection)) {
    replyTo(client);
  }
}

const files = await loadFrom("public");
for await (const connection of Deno.listen({ port: 8000 })) {
  useHandler(connection);
}

export function createCorsResponse(
  response: Response,
  isFile: boolean = false,
): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,ngrok-skip-browser-warning",
  );
  if (!isFile) {
    headers.set("Content-Type", "application/json");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export function handleOptionsRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type,Authorization,ngrok-skip-browser-warning",
    },
  });
}

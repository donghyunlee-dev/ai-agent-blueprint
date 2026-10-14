export async function fetchBlueprintApi(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  if (response.status === 401) window.dispatchEvent(new Event("blueprint:session-expired"));
  return response;
}

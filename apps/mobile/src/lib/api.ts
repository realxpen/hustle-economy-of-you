const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function getFoundationHealth() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error(`Hustle API health failed: ${response.status}`);
  return response.json();
}

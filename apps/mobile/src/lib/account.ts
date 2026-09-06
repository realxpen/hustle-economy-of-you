const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function syncMobileAccount(accessToken: string) {
  const response = await fetch(`${API_URL}/auth/sync`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Could not sync Hustle account (${response.status})`);
  return response.json();
}

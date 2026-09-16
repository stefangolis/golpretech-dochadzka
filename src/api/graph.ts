export type GraphMe = {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export function resolveEmployeeEmail(me: GraphMe): string {
  const email = (me.mail || me.userPrincipalName || "").trim();
  if (!email) {
    throw new Error("Graph /me nevrátil email (mail ani userPrincipalName).");
  }
  return email;
}

export async function fetchMe(accessToken: string): Promise<GraphMe> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph /me zlyhal (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  return (await res.json()) as GraphMe;
}
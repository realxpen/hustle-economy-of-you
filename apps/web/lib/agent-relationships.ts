"use client";

import type {
  AgentRelationship,
  CreateAgentInvitationInput,
  UpdateAgentRelationshipPermissionsInput
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";

export async function getHustlerAgentRelationships(): Promise<AgentRelationship[]> {
  const response = await authenticatedFetch("/agent-relationships/hustler");
  return response.json() as Promise<AgentRelationship[]>;
}

export async function inviteAgent(
  input: CreateAgentInvitationInput
): Promise<AgentRelationship> {
  const response = await authenticatedFetch("/agent-relationships/hustler/invitations", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<AgentRelationship>;
}

export async function updateAgentPermissions(
  relationshipId: string,
  input: UpdateAgentRelationshipPermissionsInput
): Promise<AgentRelationship> {
  const response = await authenticatedFetch(
    `/agent-relationships/hustler/${relationshipId}/permissions`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return response.json() as Promise<AgentRelationship>;
}

export async function revokeAgentRelationship(
  relationshipId: string
): Promise<AgentRelationship> {
  const response = await authenticatedFetch(
    `/agent-relationships/hustler/${relationshipId}/revoke`,
    { method: "POST" }
  );
  return response.json() as Promise<AgentRelationship>;
}

export async function getAgentRepresentations(): Promise<AgentRelationship[]> {
  const response = await authenticatedFetch("/agent-relationships/agent");
  return response.json() as Promise<AgentRelationship[]>;
}

export async function acceptAgentRelationship(
  relationshipId: string
): Promise<AgentRelationship> {
  const response = await authenticatedFetch(
    `/agent-relationships/agent/${relationshipId}/accept`,
    { method: "POST" }
  );
  return response.json() as Promise<AgentRelationship>;
}

export async function declineAgentRelationship(
  relationshipId: string
): Promise<AgentRelationship> {
  const response = await authenticatedFetch(
    `/agent-relationships/agent/${relationshipId}/decline`,
    { method: "POST" }
  );
  return response.json() as Promise<AgentRelationship>;
}

export async function leaveAgentRelationship(
  relationshipId: string
): Promise<AgentRelationship> {
  const response = await authenticatedFetch(
    `/agent-relationships/agent/${relationshipId}/leave`,
    { method: "POST" }
  );
  return response.json() as Promise<AgentRelationship>;
}

"use client";

import type {
  AddPostMediaInput,
  AgentRelationship,
  Post,
  Product,
  ProfessionalProfile,
  SavePostInput,
  SaveProductInput,
  SaveProfessionalProfileInput,
  SaveServiceInput,
  Service
} from "@hustle/types";

import { authenticatedFetch } from "./api/authenticated-fetch";

const base = (principalUserId: string) =>
  `/agent-business/${encodeURIComponent(principalUserId)}`;

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function getAgentBusinessOverview(
  principalUserId: string
): Promise<AgentRelationship> {
  return json(await authenticatedFetch(base(principalUserId)));
}

export async function getAgentBusinessProfile(
  principalUserId: string
): Promise<ProfessionalProfile | null> {
  return json(await authenticatedFetch(`${base(principalUserId)}/profile`));
}

export async function saveAgentBusinessProfile(
  principalUserId: string,
  input: SaveProfessionalProfileInput
): Promise<ProfessionalProfile> {
  return json(await authenticatedFetch(`${base(principalUserId)}/profile`, {
    method: "PUT",
    body: JSON.stringify(input)
  }));
}

export async function publishAgentBusinessProfile(
  principalUserId: string
): Promise<ProfessionalProfile> {
  return json(await authenticatedFetch(`${base(principalUserId)}/profile/publish`, {
    method: "POST"
  }));
}

export async function unpublishAgentBusinessProfile(
  principalUserId: string
): Promise<ProfessionalProfile> {
  return json(await authenticatedFetch(`${base(principalUserId)}/profile/unpublish`, {
    method: "POST"
  }));
}

export async function listAgentServices(principalUserId: string): Promise<Service[]> {
  return json(await authenticatedFetch(`${base(principalUserId)}/services`));
}

export async function createAgentService(
  principalUserId: string,
  input: SaveServiceInput
): Promise<Service> {
  return json(await authenticatedFetch(`${base(principalUserId)}/services`, {
    method: "POST",
    body: JSON.stringify(input)
  }));
}

export async function saveAgentService(
  principalUserId: string,
  serviceId: string,
  input: SaveServiceInput
): Promise<Service> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/services/${encodeURIComponent(serviceId)}`,
    { method: "PUT", body: JSON.stringify(input) }
  ));
}

export async function publishAgentService(
  principalUserId: string,
  serviceId: string
): Promise<Service> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/services/${encodeURIComponent(serviceId)}/publish`,
    { method: "POST" }
  ));
}

export async function pauseAgentService(
  principalUserId: string,
  serviceId: string
): Promise<Service> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/services/${encodeURIComponent(serviceId)}/pause`,
    { method: "POST" }
  ));
}

export async function deleteAgentService(
  principalUserId: string,
  serviceId: string
): Promise<{ deleted: true; id: string }> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/services/${encodeURIComponent(serviceId)}`,
    { method: "DELETE" }
  ));
}

export async function listAgentProducts(principalUserId: string): Promise<Product[]> {
  return json(await authenticatedFetch(`${base(principalUserId)}/products`));
}

export async function createAgentProduct(
  principalUserId: string,
  input: SaveProductInput
): Promise<Product> {
  return json(await authenticatedFetch(`${base(principalUserId)}/products`, {
    method: "POST",
    body: JSON.stringify(input)
  }));
}

export async function saveAgentProduct(
  principalUserId: string,
  productId: string,
  input: SaveProductInput
): Promise<Product> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/products/${encodeURIComponent(productId)}`,
    { method: "PUT", body: JSON.stringify(input) }
  ));
}

export async function publishAgentProduct(
  principalUserId: string,
  productId: string
): Promise<Product> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/products/${encodeURIComponent(productId)}/publish`,
    { method: "POST" }
  ));
}

export async function pauseAgentProduct(
  principalUserId: string,
  productId: string
): Promise<Product> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/products/${encodeURIComponent(productId)}/pause`,
    { method: "POST" }
  ));
}

export async function deleteAgentProduct(
  principalUserId: string,
  productId: string
): Promise<{ deleted: true; id: string }> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  ));
}

export async function listAgentPosts(principalUserId: string): Promise<Post[]> {
  return json(await authenticatedFetch(`${base(principalUserId)}/posts`));
}

export async function createAgentPost(
  principalUserId: string,
  input: SavePostInput
): Promise<Post> {
  return json(await authenticatedFetch(`${base(principalUserId)}/posts`, {
    method: "POST",
    body: JSON.stringify(input)
  }));
}

export async function saveAgentPost(
  principalUserId: string,
  postId: string,
  input: SavePostInput
): Promise<Post> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/posts/${encodeURIComponent(postId)}`,
    { method: "PUT", body: JSON.stringify(input) }
  ));
}

export async function addAgentPostMedia(
  principalUserId: string,
  postId: string,
  input: AddPostMediaInput
): Promise<Post> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/posts/${encodeURIComponent(postId)}/media`,
    { method: "POST", body: JSON.stringify(input) }
  ));
}

export async function removeAgentPostMedia(
  principalUserId: string,
  postId: string,
  mediaId: string
): Promise<Post> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}`,
    { method: "DELETE" }
  ));
}

export async function publishAgentPost(
  principalUserId: string,
  postId: string
): Promise<Post> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/posts/${encodeURIComponent(postId)}/publish`,
    { method: "POST" }
  ));
}

export async function archiveAgentPost(
  principalUserId: string,
  postId: string
): Promise<Post> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/posts/${encodeURIComponent(postId)}/archive`,
    { method: "POST" }
  ));
}

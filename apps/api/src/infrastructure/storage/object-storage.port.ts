export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
  url?: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface ObjectStoragePort {
  put(input: PutObjectInput): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  getSignedReadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export const OBJECT_STORAGE_PORT = Symbol("OBJECT_STORAGE_PORT");

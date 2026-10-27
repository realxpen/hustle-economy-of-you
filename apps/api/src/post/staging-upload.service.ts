import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException, ServiceUnavailableException
} from "@nestjs/common";
import { PostMediaType, PostStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  signedUploadForm, stagingMediaEnabled, stagingMediaOrigin,
  objectMetadata, firstBytes, promoteObject, temporaryObjectRead
} from "./staging-s3";

type Mime = "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
type UploadClaim = {
  v: 1; userId: string; postId: string; mediaId: string;
  type: PostMediaType; mime: Mime; size: number; expires: number;
};
const maxBytes: Record<Mime, number> = {
  "image/jpeg": 8_000_000, "image/png": 8_000_000,
  "image/webp": 8_000_000, "video/mp4": 30_000_000
};
const allowed: Mime[] = ["image/jpeg", "image/png", "image/webp", "video/mp4"];

function contentMatchesMime(bytes: Buffer, mime: Mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === "image/webp") return bytes.toString("ascii",0,4) === "RIFF" &&
    bytes.toString("ascii",8,12) === "WEBP";
  if (mime === "video/mp4") {
    return bytes.toString("ascii",4,8) === "ftyp" &&
      ["isom","iso2","mp41","mp42","avc1","M4V ","MSNV"].includes(bytes.toString("ascii",8,12));
  }
  return false;
}

function secret() {
  if (!stagingMediaEnabled() || !process.env.BETTER_AUTH_SECRET)
    throw new ServiceUnavailableException("Staging media storage is disabled");
  return process.env.BETTER_AUTH_SECRET;
}
function sign(part: string) {
  return createHmac("sha256", secret()).update(part).digest("base64url");
}
function encodeClaim(claim: UploadClaim) {
  const data = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${data}.${sign(data)}`;
}
function decodeClaim(value: unknown): UploadClaim {
  if (typeof value !== "string" || value.length > 1600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
    throw new ForbiddenException("Invalid media upload receipt");
  const [data, mac] = value.split(".");
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(mac);
  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new ForbiddenException("Media upload receipt signature invalid");
  let claim: UploadClaim;
  try { claim = JSON.parse(Buffer.from(data, "base64url").toString()) as UploadClaim; }
  catch { throw new ForbiddenException("Invalid media upload receipt"); }
  if (claim.v !== 1 || !claim.expires || claim.expires <= Date.now() ||
      !allowed.includes(claim.mime) || !Number.isInteger(claim.size) ||
      claim.size < 1 || claim.size > maxBytes[claim.mime] ||
      !/^[a-f0-9-]{36}$/.test(claim.mediaId) ||
      !/^[a-zA-Z0-9_-]+$/.test(claim.postId) ||
      !/^[a-zA-Z0-9_-]+$/.test(claim.userId) ||
      claim.type !== (claim.mime.startsWith("image/") ? PostMediaType.IMAGE : PostMediaType.VIDEO))
    throw new ForbiddenException("Invalid or expired media upload receipt");
  return claim;
}

function pendingKey(claim: UploadClaim) {
  return `pending/${claim.userId}/${claim.postId}/${claim.mediaId}`;
}
function permanentKey(claim: UploadClaim) {
  return `media/${claim.userId}/${claim.postId}/${claim.mediaId}`;
}

@Injectable()
export class StagingUploadService {
  constructor(private readonly prisma: PrismaService) {}

  private async owned(identity: AuthIdentity, postId: string) {
    if (!stagingMediaEnabled())
      throw new ServiceUnavailableException("Private media upload not enabled in this environment");
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (!user) throw new NotFoundException("Account not found");
    const post = await this.prisma.post.findFirst({
      where: { id: postId, professionalProfile: { userId: user.id } },
      include: { media: { select: { id: true, type: true, storageKey: true } } }
    });
    if (!post) throw new NotFoundException("Post not found");
    return { user, post };
  }

  async authorize(identity: AuthIdentity, postId: string, input: {
    contentType?: unknown; size?: unknown
  }) {
    const { user, post } = await this.owned(identity, postId);
    if (post.status !== PostStatus.DRAFT) throw new ConflictException("Upload media only to a draft");
    const mime = input?.contentType;
    if (typeof mime !== "string" || !allowed.includes(mime as Mime))
      throw new BadRequestException("Choose a JPEG, PNG, WebP or MP4 file");
    const size = input?.size;
    const contentType = mime as Mime;
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > maxBytes[contentType])
      throw new BadRequestException("Media file is empty or exceeds the staging limit");
    const type = contentType.startsWith("image/") ? PostMediaType.IMAGE : PostMediaType.VIDEO;
    if (post.media.length >= 10 || type === PostMediaType.VIDEO && post.media.length > 0 ||
        type === PostMediaType.IMAGE && post.media.some(m => m.type === PostMediaType.VIDEO))
      throw new ConflictException("This draft's carousel/video limit has been reached");

    const claim: UploadClaim = {
      v: 1, userId: user.id, postId, mediaId: randomUUID(),
      type, mime: contentType, size, expires: Date.now() + 10 * 60_000
    };
    return {
      ...signedUploadForm(pendingKey(claim), contentType, maxBytes[contentType]),
      receipt: encodeClaim(claim),
      contentType, size, maxBytes: maxBytes[contentType],
      note: "Private staging upload. Does not publish the post."
    };
  }

  async confirm(identity: AuthIdentity, postId: string, input: { receipt?: unknown }) {
    const claim = decodeClaim(input?.receipt);
    const { user, post } = await this.owned(identity, postId);
    if (claim.userId !== user.id || claim.postId !== post.id)
      throw new ForbiddenException("Media upload belongs to another account or draft");
    const existing = await this.prisma.postMedia.findUnique({ where: { id: claim.mediaId } });
    if (existing?.storageKey === permanentKey(claim) && existing.postId === postId)
      return { mediaId: existing.id, alreadyAttached: true };
    if (existing) throw new ConflictException("Media upload receipt already used");
    if (post.status !== PostStatus.DRAFT) throw new ConflictException("Media can only be added to a draft");
    if (post.media.length >= 10 || claim.type === PostMediaType.VIDEO && post.media.length > 0 ||
        claim.type === PostMediaType.IMAGE && post.media.some(m => m.type === PostMediaType.VIDEO))
      throw new ConflictException("The draft media limit has changed");

    const meta = await objectMetadata(pendingKey(claim));
    if (meta.length !== claim.size || meta.type !== claim.mime)
      throw new BadRequestException("Uploaded bytes do not match the authorized file");
    const bytes = await firstBytes(pendingKey(claim));
    if (!contentMatchesMime(bytes, claim.mime))
      throw new BadRequestException("The uploaded file signature does not match its media type");
    await promoteObject(pendingKey(claim), permanentKey(claim));

    // Serializable transaction prevents overlapping confirms from bypassing
    // the one-video / 10-image limit. The UUID media id ensures retry safety.
    await this.prisma.$transaction(async tx => {
      const current = await tx.post.findFirst({
        where: { id: postId, professionalProfile: { userId: user.id } },
        include: { media: { select: { id: true, type: true } } }
      });
      if (!current || current.status !== PostStatus.DRAFT)
        throw new ConflictException("Draft no longer available");
      if (current.media.length >= 10 ||
          claim.type === PostMediaType.VIDEO && current.media.length > 0 ||
          claim.type === PostMediaType.IMAGE && current.media.some(m => m.type === PostMediaType.VIDEO))
        throw new ConflictException("Draft media limit reached");
      await tx.postMedia.upsert({
        where: { id: claim.mediaId },
        update: {},
        create: {
          id: claim.mediaId, postId, type: claim.type,
          storageKey: permanentKey(claim),
          mediaUrl: `${stagingMediaOrigin}/api/isolated/api/v1/media/p/${postId}/${claim.mediaId}`,
          position: current.media.length
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { mediaId: claim.mediaId, alreadyAttached: false };
  }

  async publicMedia(postId: string, mediaId: string) {
    if (!stagingMediaEnabled()) throw new NotFoundException();
    const row = await this.prisma.postMedia.findFirst({
      where: {
        id: mediaId, postId, storageKey: { startsWith: "media/" },
        post: { status: PostStatus.PUBLISHED, moderationState: "CLEAR" }
      },
      select: { storageKey: true }
    });
    if (!row?.storageKey) throw new NotFoundException("Media is not public");
    return temporaryObjectRead(row.storageKey, 60);
  }

  async ownedMedia(identity: AuthIdentity, postId: string, mediaId: string) {
    const { post } = await this.owned(identity, postId);
    const row = await this.prisma.postMedia.findFirst({
      where: { id: mediaId, postId: post.id, storageKey: { startsWith: "media/" } },
      select: { storageKey: true }
    });
    if (!row?.storageKey) throw new NotFoundException("Media unavailable");
    return temporaryObjectRead(row.storageKey, 60);
  }
}

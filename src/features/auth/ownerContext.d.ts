export type VerifiedOwnerIdentity = {
  issuer: string;
  subject: string;
};

export type OwnerContextSnapshot = {
  generation: number;
  ownerKey: string | null;
};

export type OwnerContextLifecycle = {
  beginCheck(): number;
  revoke(): number;
  isCurrent(candidate: number): boolean;
  activate(candidate: number, identity: VerifiedOwnerIdentity): Promise<boolean>;
  snapshot(): OwnerContextSnapshot;
};

export function deriveOwnerKey(identity: VerifiedOwnerIdentity): Promise<string>;
export function createOwnerContextLifecycle(options?: {
  deriveKey?: (identity: VerifiedOwnerIdentity) => Promise<string>;
}): OwnerContextLifecycle;

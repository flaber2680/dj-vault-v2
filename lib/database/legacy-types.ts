export type LegacyUser = {
  id: string;
  email: string;
  name: string;
  plan?: string;
  planExpiresAt?: string;
  activatedPaymentIds?: string[];
  providers: string[];
  passwordHash?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyPayment = {
  id: string;
  provider: string;
  providerPaymentId?: string;
  providerStatus?: string;
  confirmationUrl?: string;
  userId: string;
  packageId?: string;
  durationDays?: number;
  planId?: string;
  activationPlanId?: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyPromoCode = {
  id: string;
  code: string;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LegacyReferral = {
  id: string;
  promoCodeId: string;
  code: string;
  ownerUserId: string;
  referredUserId: string;
  registeredAt: string;
  convertedAt?: string;
  convertedPackageId?: string;
  convertedDurationDays?: number;
  convertedAmount?: number;
  convertedPlan?: string;
  paymentId?: string;
};

export type LegacyReferralData = {
  codes: LegacyPromoCode[];
  referrals: LegacyReferral[];
};

export type LegacyCollection = {
  number: string;
  date: string;
  size?: string;
  sizeBytes?: number;
  genres: string;
  description?: string;
  tracks: string;
  s3Key?: string;
  downloadUrl?: string;
  isActive?: boolean;
  downloadLimit?: string | number;
};

export type LegacyDownloadEvent = {
  downloadedAt: string;
  ipAddress: string;
  userAgent: string;
};

export type LegacyDownloadRecord = {
  userId: string;
  archiveId: string;
  downloadCount: number;
  downloadedAt?: string;
  events: LegacyDownloadEvent[];
  updatedAt: string;
};

export type LegacyPasswordReset = {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

export type LegacyData = {
  users: LegacyUser[];
  payments: LegacyPayment[];
  referralData: LegacyReferralData;
  collections: LegacyCollection[];
  downloads: LegacyDownloadRecord[];
  passwordResets: LegacyPasswordReset[];
};

export type ImportCounts = {
  users: number;
  userProviders: number;
  activatedPayments: number;
  promoCodes: number;
  referrals: number;
  collections: number;
  downloadRecords: number;
  downloadEvents: number;
  passwordResets: number;
};

export type ImportReport = {
  imported: boolean;
  counts: ImportCounts;
};

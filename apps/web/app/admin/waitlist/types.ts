// Mirrors apps/api/src/modules/admin/admin-waitlist.service.ts's response shape.

export interface AdminWaitlistSignup {
  id: string;
  email: string;
  createdAt: string;
}

export interface AdminWaitlistListResponse {
  signups: AdminWaitlistSignup[];
  page: number;
  pageSize: number;
  total: number;
}

export type Role = "ADMIN" | "MEMBER";
export type ResourceStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";
export type ReservationStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Resource {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  status: ResourceStatus;
  openTime: string;
  closeTime: string;
  maxDurationMins: number;
  requiresApproval: boolean;
  categoryId: string;
  category: Category;
}

export interface Reservation {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  attendees: number | null;
  rejectReason: string | null;
  resourceId: string;
  userId: string;
  resource: { id: string; name: string; location: string | null };
  user: { id: string; name: string; email: string };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  reservationId: string | null;
}

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages?: number; unreadCount?: number };
}

export interface Availability {
  resourceId: string;
  date: string;
  status: ResourceStatus;
  openTime: string;
  closeTime: string;
  bookings: { id: string; startTime: string; endTime: string; status: ReservationStatus; mine: boolean }[];
  freeSlots: { start: string; end: string }[];
}

export interface DashboardStats {
  resources: Record<string, number>;
  reservations: Record<string, number>;
  todayReservations: number;
  pendingApprovals: number;
  topResourcesLast30Days: { resourceId: string; name: string; reservations: number }[];
}
export interface DelivererScheduleRow {
  id: string;
  operation: "VENDOR" | "MARKETPLACE";
  date: string;
  slotId: string;
  slotLabel: string;
  windowStart: string;
  windowEnd: string;
  isOverflow: boolean;
  limit: number | null;
  full: boolean;
  dispatched: boolean;
  status: string;
  delivererName: string;
  orderIds: string[];
  businessNames: string[];
}

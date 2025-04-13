export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

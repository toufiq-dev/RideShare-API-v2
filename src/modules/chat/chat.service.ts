// src/modules/chat/chat.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { BookingStatus } from '@prisma/client';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from './dto/message.interface';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(
    userId: string,
    sendMessageDto: SendMessageDto,
  ): Promise<Message> {
    const { bookingId, content } = sendMessageDto;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, pilot: true },
    });
    if (!booking || booking.status === BookingStatus.PENDING) {
      throw new ForbiddenException('No active ride for this booking');
    }
    if (userId !== booking.customer.userId && userId !== booking.pilot.userId) {
      throw new ForbiddenException('Unauthorized to chat for this booking');
    }

    const message = await this.prisma.message.create({
      data: {
        bookingId,
        senderId: userId,
        content: content.trim(),
      },
    });

    return {
      id: message.id,
      bookingId: message.bookingId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  async getMessages(bookingId: string, userId: string): Promise<Message[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, pilot: true },
    });
    if (
      !booking ||
      (userId !== booking.customer.userId && userId !== booking.pilot.userId)
    ) {
      throw new ForbiddenException('Unauthorized to view messages');
    }

    const messages = await this.prisma.message.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return messages.map((msg) => ({
      id: msg.id,
      bookingId: msg.bookingId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }
}

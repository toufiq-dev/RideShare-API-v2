// src/modules/chat/chat.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { BookingStatus } from '@prisma/client';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(
    userId: string,
    sendMessageDto: SendMessageDto,
  ): Promise<{ message: Message; recipientId: string }> {
    const { bookingId, content } = sendMessageDto;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, pilot: true },
    });
    if (!(booking.status in [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS, BookingStatus.STARTED])) {
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

    console.log('usrid\n', userId);
    console.log('recipientId\n', booking);
    const recipientId =
      userId === booking.customer.userId
        ? booking.pilot.userId
        : booking.customer.userId;
    console.log('recipientId\n', recipientId);
    return {
      message: {
        id: message.id,
        bookingId: message.bookingId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
      },
      recipientId,
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

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

    const booking: any = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, pilot: true },
    });

    if (
      ![
        BookingStatus.ACCEPTED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.STARTED,
      ].includes(booking.status)
    ) {
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

    const recipientId =
      userId === booking.customer.userId
        ? booking.pilot.userId
        : booking.customer.userId;

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

  async getMessages(
    userId: string,
    bookingId: string,
    page: number,
    pageSize: number,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, pilot: true },
    });
    if (!booking) {
      throw new ForbiddenException('No active ride for this booking');
    }
    if (userId !== booking.customer.userId && userId !== booking.pilot.userId) {
      throw new ForbiddenException('Unauthorized to chat for this booking');
    }

    // Calculate skip value
    const skip = (page - 1) * pageSize;

    // Get total count of messages
    const totalCount = await this.prisma.message.count({
      where: { bookingId },
    });
    const messages = await this.prisma.message.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
      pagination: {
        totalItems: totalCount,
        totalPages,
        currentPage: page,
        pageSize: pageSize,
        hasNextPage,
        hasPrevPage,
      },
    };
  }
}

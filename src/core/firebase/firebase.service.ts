import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class FirebaseService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get<string>('firebase.projectId'),
          privateKey: this.configService
            .get<string>('firebase.privateKey')
            .replace(/\\n/g, '\n'),
          clientEmail: this.configService.get<string>('firebase.clientEmail'),
        }),
      });
    }
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data: any,
    sound: string = 'default',
  ) {
    try {
      const message: admin.messaging.Message = {
        token,
        data: {
          title,
          body,
          sound,
          ...data, // merge your custom data (like type, rideId, etc.)
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              'mutable-content': 1,
              alert: {
                title,
                body,
              },
              sound: `${sound}.wav`,
            },
          },
        },
      };

      // await new Promise(resolve => setTimeout(resolve, 10000));

      const response = await admin.messaging().send(message);
      this.logger.debug(
        `FCM message sent (messageId=${typeof response === 'string' ? response : 'ok'})`,
        'FirebaseService',
      );

      return response;
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'FirebaseService',
        { scope: 'sendNotification' },
      );
      throw error;
    }
  }
}

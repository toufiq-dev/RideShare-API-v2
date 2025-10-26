import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService {
  constructor(private readonly configService: ConfigService) {
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

  // async sendNotification(
  //   token: string,
  //   title: string,
  //   body: string,
  //   data: any,
  //   sound: string = 'default',
  // ) {
  //   try {
  //     const message: admin.messaging.Message = {
  //       token,
  //       notification: { title, body },
  //       data,
  //       android: {
  //         priority: 'high',
  //         notification: {
  //           sound: sound,
  //           channelId: 'default',
  //         },
  //       },
  //       apns: {
  //         payload: {
  //           aps: {
  //             sound: sound + '.wav',
  //           },
  //         },
  //       },
  //     };

  //     console.log('***Push***', message)

  //     const response = await admin.messaging().send(message);
  //     console.log('Successfully sent message:', response);
  //     return response;
  //   } catch (error) {
  //     console.error('Error sending message:', error);
  //     throw error;
  //   }
  // }

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

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);

      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}

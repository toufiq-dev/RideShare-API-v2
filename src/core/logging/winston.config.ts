// // src/core/logging/winston.config.ts
// import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
// import * as winston from 'winston';
// import * as fs from 'fs';
// import * as path from 'path';

// const logsDir = path.join(process.cwd(), 'logs');
// let canUseFileLogging = false;

// // Try to create logs directory
// if (!fs.existsSync(logsDir)) {
//   try {
//     fs.mkdirSync(logsDir, { recursive: true });
//     canUseFileLogging = true;
//   } catch (error) {
//     console.warn('Could not create logs directory:', error.message);
//     canUseFileLogging = false;
//   }
// } else {
//   canUseFileLogging = true;
// }

// // Check if we can write to the logs directory
// if (canUseFileLogging) {
//   try {
//     const testFile = path.join(logsDir, 'test-write.tmp');
//     fs.writeFileSync(testFile, 'test');
//     fs.unlinkSync(testFile);
//   } catch (error) {
//     console.warn('Cannot write to logs directory:', error.message);
//     canUseFileLogging = false;
//   }
// }

// export const winstonConfig: winston.LoggerOptions = {
//   level: process.env.LOG_LEVEL || 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.errors({ stack: true }),
//     winston.format.metadata(),
//   ),
//   transports: [
//     // Console: Always enabled
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.timestamp(),
//         nestWinstonModuleUtilities.format.nestLike('FairDrive', {
//           prettyPrint: true,
//         }),
//       ),
//     }),

//     // File transports: Only if we can use file logging
//     ...(canUseFileLogging ? [
//       new winston.transports.File({
//         filename: 'logs/combined.log',
//         level: 'info',
//         format: winston.format.combine(
//           winston.format.timestamp(),
//           winston.format.json(),
//         ),
//         maxsize: 5242880, // 5MB
//         maxFiles: 5,
//       }),

//       new winston.transports.File({
//         filename: 'logs/error.log',
//         level: 'error',
//         format: winston.format.combine(
//           winston.format.timestamp(),
//           winston.format.json(),
//         ),
//         maxsize: 5242880, // 5MB
//         maxFiles: 5,
//       }),
//     ] : []),
//   ],
// };

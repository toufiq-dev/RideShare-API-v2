declare namespace Express {
  namespace Multer {
    interface File {
      azureFileUrl?: string;
    }
  }

  interface Request {
    user?: any;
  }
}

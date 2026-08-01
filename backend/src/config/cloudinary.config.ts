import { ConfigService } from '@nestjs/config';

export interface CloudinaryEnvironment {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const missingCloudinaryCredentialMessage =
  'Faltan credenciales de Cloudinary. Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.';

const normalizeCredential = (value: string | undefined): string | null => {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
};

export const getCloudinaryEnvironment = (
  configService: ConfigService,
): CloudinaryEnvironment | null => {
  const cloudName = normalizeCredential(
    configService.get<string>('CLOUDINARY_CLOUD_NAME'),
  );
  const apiKey = normalizeCredential(
    configService.get<string>('CLOUDINARY_API_KEY'),
  );
  const apiSecret = normalizeCredential(
    configService.get<string>('CLOUDINARY_API_SECRET'),
  );

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
};

export const getMissingCloudinaryCredentialMessage = (): string =>
  missingCloudinaryCredentialMessage;

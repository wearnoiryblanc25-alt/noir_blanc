import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import {
  getCloudinaryEnvironment,
  getMissingCloudinaryCredentialMessage,
} from '../../config/cloudinary.config';

export interface CloudinaryUploadedImage {
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const credentials = getCloudinaryEnvironment(this.configService);

    if (!credentials) {
      this.isConfigured = false;
      this.logger.warn(
        `${getMissingCloudinaryCredentialMessage()} Las cargas de imagen quedaran deshabilitadas hasta configurar esas variables.`,
      );
      return;
    }

    this.isConfigured = true;
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    });
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'Cloudinary no esta configurado correctamente en el backend.',
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'noir-blanc/productos',
  ): Promise<CloudinaryUploadedImage> {
    this.ensureConfigured();

    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'No se recibio el contenido de la imagen en el servidor.',
      );
    }

    try {
      const dataUri = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString(
        'base64',
      )}`;

      const result: UploadApiResponse = await cloudinary.uploader.upload(
        dataUri,
        {
          folder,
          resource_type: 'image',
        },
      );

      return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'error desconocido';

      this.logger.error(
        `Fallo al subir una imagen a Cloudinary: ${
          errorMessage
        }`,
      );

      if (
        errorMessage.includes('Must supply api_key') ||
        errorMessage.includes('api_key') ||
        errorMessage.includes('cloud_name')
      ) {
        throw new InternalServerErrorException(
          'Cloudinary no esta configurado correctamente en el backend desplegado.',
        );
      }

      throw new InternalServerErrorException(
        'No fue posible subir la imagen en este momento.',
      );
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    this.ensureConfigured();

    try {
      const destroyResponse: unknown =
        await cloudinary.uploader.destroy(publicId);
      const result =
        typeof destroyResponse === 'object' &&
        destroyResponse !== null &&
        'result' in destroyResponse &&
        typeof destroyResponse.result === 'string'
          ? destroyResponse.result
          : undefined;

      if (result === 'ok' || result === 'not found') {
        return;
      }

      throw new Error(
        `Cloudinary respondio con un resultado inesperado: ${result ?? 'sin resultado'}`,
      );
    } catch (error) {
      this.logger.error(
        `Fallo al eliminar la imagen ${publicId} en Cloudinary: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      throw new InternalServerErrorException(
        'No fue posible eliminar la imagen en este momento.',
      );
    }
  }
}

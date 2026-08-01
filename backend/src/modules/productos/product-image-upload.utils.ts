import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

const acceptedProductImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const maxProductImageBytes = 8 * 1024 * 1024;
const maxProductImageCount = 20;

export const validateProductImageFile = (file: Express.Multer.File): void => {
  if (!file) {
    throw new BadRequestException('Adjunta al menos una imagen valida.');
  }

  if (!acceptedProductImageMimeTypes.has(file.mimetype)) {
    throw new BadRequestException(
      'Solo se permiten imagenes JPG, PNG, WEBP o AVIF.',
    );
  }

  if (file.size > maxProductImageBytes) {
    throw new BadRequestException(
      'Cada imagen debe pesar como maximo 8 MB.',
    );
  }

  if (!file.buffer?.length) {
    throw new BadRequestException(
      'No se recibio el contenido de una de las imagenes.',
    );
  }
};

export const validateProductImageFiles = (
  files: Express.Multer.File[],
): void => {
  if (files.length > maxProductImageCount) {
    throw new BadRequestException(
      'Puedes subir un maximo de 20 imagenes por solicitud.',
    );
  }

  files.forEach(validateProductImageFile);
};

export const productImageMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    files: maxProductImageCount,
    fileSize: maxProductImageBytes,
  },
};

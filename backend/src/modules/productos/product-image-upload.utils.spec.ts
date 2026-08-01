import {
  validateProductImageFile,
  validateProductImageFiles,
} from './product-image-upload.utils';

const buildFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File => ({
  fieldname: 'image',
  originalname: 'producto.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  destination: '',
  filename: '',
  path: '',
  stream: undefined as never,
  buffer: Buffer.from('demo'),
  ...overrides,
});

describe('product-image-upload.utils', () => {
  it('acepta una imagen valida', () => {
    expect(() => validateProductImageFile(buildFile())).not.toThrow();
  });

  it('rechaza formatos no compatibles', () => {
    expect(() =>
      validateProductImageFile(
        buildFile({
          mimetype: 'image/gif',
        }),
      ),
    ).toThrow('Solo se permiten imagenes JPG, PNG, WEBP o AVIF.');
  });

  it('rechaza archivos mayores a 8 MB', () => {
    expect(() =>
      validateProductImageFile(
        buildFile({
          size: 8 * 1024 * 1024 + 1,
        }),
      ),
    ).toThrow('Cada imagen debe pesar como maximo 8 MB.');
  });

  it('rechaza lotes mayores a 20 imagenes', () => {
    expect(() =>
      validateProductImageFiles(
        Array.from({ length: 21 }, () => buildFile()),
      ),
    ).toThrow('Puedes subir un maximo de 20 imagenes por solicitud.');
  });
});

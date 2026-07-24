import axios from 'axios'
import api, { API_URL } from '../api/api'

export interface ProductoImagenColor {
  imagen: string
  color: string | null
  colorHex: string | null
}

export interface ProductoImagenMetadata {
  url: string
  publicId: string | null
}

export interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  existencia: number
  categoria: string
  categorias: string[]
  marca: string
  tallas: string[]
  colores: string[]
  imagenPrincipal: string | null
  imagenPrincipalPublicId: string | null
  imagenPrincipalColor: string | null
  imagenPrincipalColorHex: string | null
  imagenes: string[]
  imagenesMetadata: ProductoImagenMetadata[]
  imagenesPorColor: ProductoImagenColor[]
  activo: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProductoFilters {
  nombre?: string
  categoria?: string
  marca?: string
  activo?: boolean
}

export interface ProductoPayload {
  nombre: string
  descripcion: string
  precio: number
  existencia: number
  categoria: string
  categorias?: string[]
  marca: string
  tallas: string[]
  colores: string[]
  imagenPrincipal?: string | null
  imagenPrincipalPublicId?: string | null
  imagenPrincipalColor?: string | null
  imagenPrincipalColorHex?: string | null
  imagenes: string[]
  imagenesMetadata?: ProductoImagenMetadata[]
  imagenesPorColor?: ProductoImagenColor[]
  activo?: boolean
}

export interface UploadedProductoImage extends ProductoImagenMetadata {
  width: number
  height: number
  format: string
  bytes: number
}

interface UploadProductoImagesResponse {
  images?: Array<{
    secureUrl: string
    publicId: string
    width: number
    height: number
    format: string
    bytes: number
  }>
  paths?: string[]
}

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const PRODUCTOS_CACHE_TTL_MS = 30_000

type ProductosCacheEntry = {
  data: Producto[]
  expiresAt: number
}

type ProductoByIdCacheEntry = {
  data: Producto
  expiresAt: number
}

const productosCache = new Map<string, ProductosCacheEntry>()
const productosPendingRequests = new Map<string, Promise<Producto[]>>()
const productoByIdCache = new Map<number, ProductoByIdCacheEntry>()
const productoByIdPendingRequests = new Map<number, Promise<Producto>>()
let productosCacheVersion = 0

export const formatPrecio = (precio: number) => currencyFormatter.format(precio)

const resolveImageUrl = (path: string | null | undefined) => {
  if (!path?.trim()) {
    return null
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return new URL(path, `${API_URL}/`).toString()
}

const buildUniqueTextValues = (values: Array<string | null | undefined>) => {
  const uniqueValues = new Map<string, string>()

  values.forEach((value) => {
    const normalizedValue = value?.trim() ?? ''

    if (!normalizedValue) {
      return
    }

    const normalizedKey = normalizedValue.toLowerCase()

    if (!uniqueValues.has(normalizedKey)) {
      uniqueValues.set(normalizedKey, normalizedValue)
    }
  })

  return Array.from(uniqueValues.values())
}

const normalizePublicId = (value: string | null | undefined) => {
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : null
}

const buildProductosCacheKey = (filters?: ProductoFilters) => {
  if (!filters) {
    return '__all__'
  }

  const normalizedEntries = Object.entries(filters)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null) {
        return []
      }

      if (typeof value === 'string') {
        const trimmedValue = value.trim()

        return trimmedValue ? [[key, trimmedValue] as const] : []
      }

      return [[key, value] as const]
    })
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  if (normalizedEntries.length === 0) {
    return '__all__'
  }

  return JSON.stringify(normalizedEntries)
}

const isFreshCacheEntry = (expiresAt: number) => expiresAt > Date.now()

const cacheProductoById = (producto: Producto) => {
  productoByIdCache.set(producto.id, {
    data: producto,
    expiresAt: Date.now() + PRODUCTOS_CACHE_TTL_MS,
  })
}

const cacheProductosList = (key: string, productos: Producto[]) => {
  productosCache.set(key, {
    data: productos,
    expiresAt: Date.now() + PRODUCTOS_CACHE_TTL_MS,
  })

  productos.forEach(cacheProductoById)
}

export const clearProductosCache = () => {
  productosCacheVersion += 1
  productosCache.clear()
  productosPendingRequests.clear()
  productoByIdCache.clear()
  productoByIdPendingRequests.clear()
}

const normalizeProductoImageMetadata = (
  producto: Producto,
): ProductoImagenMetadata[] => {
  const metadataByUrl = new Map<string, ProductoImagenMetadata>()

  ;(producto.imagenesMetadata ?? []).forEach((item) => {
    const url = resolveImageUrl(item.url)

    if (!url || metadataByUrl.has(url)) {
      return
    }

    metadataByUrl.set(url, {
      url,
      publicId: normalizePublicId(item.publicId),
    })
  })

  const orderedUrls = Array.from(
    new Set([
      ...((producto.imagenes ?? [])
        .map((image) => resolveImageUrl(image))
        .filter((image): image is string => Boolean(image))),
      ...metadataByUrl.keys(),
    ]),
  )

  return orderedUrls.map((url) => metadataByUrl.get(url) ?? { url, publicId: null })
}

const normalizeProducto = (producto: Producto): Producto => {
  const uniqueImageAssignments = new Map<string, ProductoImagenColor>()
  ;(producto.imagenesPorColor ?? []).forEach((item) => {
    const imagen = resolveImageUrl(item.imagen)

    if (!imagen || uniqueImageAssignments.has(imagen)) {
      return
    }

    uniqueImageAssignments.set(imagen, {
      ...item,
      imagen,
    })
  })

  const imagenesPorColor = Array.from(uniqueImageAssignments.values())
    .map((item) => {
      const imagen = resolveImageUrl(item.imagen)

      if (!imagen) {
        return null
      }

      return {
        ...item,
        imagen,
      }
    })
    .filter((item): item is ProductoImagenColor => Boolean(item))
  const imagenesMetadata = normalizeProductoImageMetadata(producto)
  const imagenes = Array.from(
    new Set([
      ...imagenesMetadata.map((item) => item.url),
      ...imagenesPorColor.map((item) => item.imagen),
    ]),
  )
  const imagenPrincipal =
    resolveImageUrl(producto.imagenPrincipal) ?? imagenes[0] ?? null

  return {
    ...producto,
    categoria: producto.categoria.trim(),
    categorias:
      producto.categorias?.length > 0
        ? buildUniqueTextValues(producto.categorias)
        : buildUniqueTextValues([producto.categoria]),
    marca: producto.marca.trim(),
    tallas: buildUniqueTextValues(producto.tallas ?? []),
    colores: buildUniqueTextValues(producto.colores ?? []),
    imagenPrincipal,
    imagenPrincipalPublicId: normalizePublicId(producto.imagenPrincipalPublicId),
    imagenes,
    imagenesMetadata,
    imagenesPorColor,
  }
}

export const getProductos = async (filters?: ProductoFilters) => {
  const cacheKey = buildProductosCacheKey(filters)
  const cachedEntry = productosCache.get(cacheKey)

  if (cachedEntry && isFreshCacheEntry(cachedEntry.expiresAt)) {
    return cachedEntry.data
  }

  if (cachedEntry) {
    productosCache.delete(cacheKey)
  }

  const pendingRequest = productosPendingRequests.get(cacheKey)

  if (pendingRequest) {
    return pendingRequest
  }

  const requestVersion = productosCacheVersion
  const request = api
    .get<Producto[]>('/productos', {
      params: filters,
    })
    .then(({ data }) => {
      const normalizedProductos = data.map(normalizeProducto)

      if (requestVersion === productosCacheVersion) {
        cacheProductosList(cacheKey, normalizedProductos)
      }

      return normalizedProductos
    })
    .finally(() => {
      productosPendingRequests.delete(cacheKey)
    })

  productosPendingRequests.set(cacheKey, request)

  return request
}

export const getProductoById = async (id: number) => {
  const cachedEntry = productoByIdCache.get(id)

  if (cachedEntry && isFreshCacheEntry(cachedEntry.expiresAt)) {
    return cachedEntry.data
  }

  if (cachedEntry) {
    productoByIdCache.delete(id)
  }

  const pendingRequest = productoByIdPendingRequests.get(id)

  if (pendingRequest) {
    return pendingRequest
  }

  const requestVersion = productosCacheVersion
  const request = api
    .get<Producto>(`/productos/${id}`)
    .then(({ data }) => {
      const normalizedProducto = normalizeProducto(data)

      if (requestVersion === productosCacheVersion) {
        cacheProductoById(normalizedProducto)
      }

      return normalizedProducto
    })
    .finally(() => {
      productoByIdPendingRequests.delete(id)
    })

  productoByIdPendingRequests.set(id, request)

  return request
}

export const createProducto = async (payload: ProductoPayload) => {
  const { data } = await api.post<Producto>('/productos', payload)

  clearProductosCache()

  return normalizeProducto(data)
}

export const uploadProductoImages = async (
  files: File[],
): Promise<UploadedProductoImage[]> => {
  const formData = new FormData()

  files.forEach((file) => {
    formData.append('image', file)
  })

  let data: UploadProductoImagesResponse

  try {
    const response = await api.post<UploadProductoImagesResponse>(
      '/productos/uploads',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    data = response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error(
        'La sesion del panel vencio o ya no es valida. Inicia sesion de nuevo y vuelve a intentar la subida.',
      )
    }

    throw error
  }

  const uploadedImages =
    data.images?.map((image) => ({
      url: resolveImageUrl(image.secureUrl) ?? image.secureUrl,
      publicId: normalizePublicId(image.publicId),
      width: image.width,
      height: image.height,
      format: image.format,
      bytes: image.bytes,
    })) ?? []

  if (uploadedImages.length > 0) {
    return uploadedImages
  }

  const resolvedPaths =
    data.paths
      ?.map((path) => resolveImageUrl(path))
      .filter((path): path is string => Boolean(path))
      .map((url) => ({
        url,
        publicId: null,
        width: 0,
        height: 0,
        format: 'unknown',
        bytes: 0,
      })) ?? []

  if (resolvedPaths.length === 0) {
    throw new Error('La API no devolvio rutas de imagen validas para el producto.')
  }

  return resolvedPaths
}

export const updateProducto = async (
  id: number,
  payload: Partial<ProductoPayload>,
) => {
  const { data } = await api.patch<Producto>(`/productos/${id}`, payload)

  clearProductosCache()

  return normalizeProducto(data)
}

export const deleteProducto = async (id: number) => {
  await api.delete(`/productos/${id}`)
  clearProductosCache()
}

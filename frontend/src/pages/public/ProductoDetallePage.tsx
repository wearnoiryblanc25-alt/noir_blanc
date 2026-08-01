import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../api/api'
import { getProductCategoryLabel } from '../../constants/productCategories'
import {
  formatPrecio,
  getProductoById,
  type Producto,
} from '../../services/productos.service'
import {
  normalizeProductColorKey,
  resolveDefaultProductColorHex,
} from '../../utils/productColor'

interface ProductoColorVariant {
  key: string
  label: string
  colorHex: string
}

const buildVariantKey = (label?: string | null, colorHex?: string | null) =>
  `${normalizeProductColorKey(label)}|${(colorHex ?? '').trim().toLowerCase()}`

const buildUniqueGalleryImages = (items: Array<string | null | undefined>) =>
  Array.from(new Set(items.map((item) => item?.trim() ?? '').filter(Boolean)))

const getProductoCategorias = (producto: Producto) =>
  producto.categorias.length > 0
    ? producto.categorias
    : producto.categoria.trim()
      ? [producto.categoria]
      : []

const buildColorVariants = (producto: Producto | null): ProductoColorVariant[] => {
  if (!producto) {
    return []
  }

  const uniqueVariants = new Map<string, ProductoColorVariant>()
  const registerVariant = (label?: string | null, colorHex?: string | null) => {
    const normalizedHex = colorHex?.trim() || '#d2c8bc'
    const normalizedLabel = label?.trim() || 'Tono'
    const key = buildVariantKey(normalizedLabel, normalizedHex)

    if (!uniqueVariants.has(key)) {
      uniqueVariants.set(key, {
        key,
        label: normalizedLabel,
        colorHex: normalizedHex,
      })
    }
  }

  if (producto.imagenPrincipalColor || producto.imagenPrincipalColorHex) {
    registerVariant(producto.imagenPrincipalColor, producto.imagenPrincipalColorHex)
  }

  producto.colores.forEach((color) => {
    registerVariant(color, resolveDefaultProductColorHex(color))
  })

  producto.imagenesPorColor.forEach((image) => {
    if (image.color || image.colorHex) {
      registerVariant(image.color, image.colorHex)
    }
  })

  return Array.from(uniqueVariants.values())
}

const buildGaleria = (
  producto: Producto | null,
  selectedVariantKey: string | null,
) => {
  if (!producto) {
    return []
  }

  const matchesSelectedVariant = (
    label?: string | null,
    colorHex?: string | null,
  ) =>
    !selectedVariantKey ||
    buildVariantKey(label, colorHex) === selectedVariantKey
  const baseGallery = buildUniqueGalleryImages([
    producto.imagenPrincipal,
    ...producto.imagenes,
    ...producto.imagenesPorColor.map((image) => image.imagen),
  ])

  if (!selectedVariantKey) {
    return baseGallery
  }

  const assignedImageLookup = new Set(
    producto.imagenesPorColor.map((image) => image.imagen.trim().toLowerCase()),
  )
  const genericImages = buildUniqueGalleryImages([
    !producto.imagenPrincipalColor?.trim() ? producto.imagenPrincipal : null,
    ...producto.imagenes.filter(
      (image) => !assignedImageLookup.has(image.trim().toLowerCase()),
    ),
  ])
  const variantGallery = buildUniqueGalleryImages([
    matchesSelectedVariant(
      producto.imagenPrincipalColor,
      producto.imagenPrincipalColorHex,
    )
      ? producto.imagenPrincipal
      : null,
    ...producto.imagenesPorColor
      .filter((image) => matchesSelectedVariant(image.color, image.colorHex))
      .map((image) => image.imagen),
  ])

  if (variantGallery.length === 0) {
    return baseGallery
  }

  return buildUniqueGalleryImages([...variantGallery, ...genericImages])
}

export const ProductoDetallePage = () => {
  const { id } = useParams()
  const productoId = Number(id)
  const invalidProductoId = Number.isNaN(productoId)
  const [producto, setProducto] = useState<Producto | null>(null)
  const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null)
  const [selectedImagePreference, setSelectedImagePreference] = useState<string | null>(
    null,
  )
  const [failedSelectedImage, setFailedSelectedImage] = useState<string | null>(null)
  const [failedThumbImages, setFailedThumbImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (invalidProductoId) {
      return
    }

    const loadProducto = async () => {
      try {
        setLoading(true)
        const response = await getProductoById(productoId)

        if (active) {
          setProducto(response)
          setSelectedVariantKey(null)
          setSelectedImagePreference(null)
          setFailedSelectedImage(null)
          setFailedThumbImages([])
          setError(null)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getApiErrorMessage(
              requestError,
              'No fue posible cargar el detalle del producto.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadProducto()

    return () => {
      active = false
    }
  }, [invalidProductoId, productoId])

  const galeria = useMemo(
    () => buildGaleria(producto, selectedVariantKey),
    [producto, selectedVariantKey],
  )
  const colorVariants = useMemo(() => buildColorVariants(producto), [producto])
  const selectedVariant = colorVariants.find(
    (variant) => variant.key === selectedVariantKey,
  )
  const categorias = producto ? getProductoCategorias(producto) : []
  const selectedImage =
    selectedImagePreference && galeria.includes(selectedImagePreference)
      ? selectedImagePreference
      : galeria[0] ?? null

  if (invalidProductoId) {
    return (
      <div className="content-stack">
        <div className="alert alert--error">El producto solicitado no es valido.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="content-stack">
        <div className="skeleton-card" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="content-stack">
        <div className="alert alert--error">{error}</div>
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="content-stack">
        <div className="empty-state">No encontramos ese producto.</div>
      </div>
    )
  }

  const detailDescription = producto.descripcion.trim()
    ? `ID #${producto.id} - ${producto.descripcion}`
    : `ID #${producto.id}`

  return (
    <div className="content-stack detail-page-shell">
      <section className="detail-grid">
        <div className="detail-media-column">
          <div className="detail-mobile-title">
            <h1 className="detail-name detail-name--mobile">{producto.nombre}</h1>
          </div>

          <div className="detail-gallery-frame">
            {galeria.length > 1 ? (
              <div
                className="detail-thumbs detail-thumbs--desktop"
                aria-label="Vistas del producto"
              >
                {galeria.map((image) => (
                  <button
                    aria-label={`Vista de ${producto.nombre}`}
                    className={`thumb-button${
                      image === selectedImage ? ' is-active' : ''
                    }`}
                    key={image}
                    onClick={() => {
                      setSelectedImagePreference(image)
                      setFailedSelectedImage(null)
                    }}
                    type="button"
                  >
                    {failedThumbImages.includes(image) ? (
                      <span aria-hidden="true" className="thumb-fallback">
                        NB
                      </span>
                    ) : (
                      <img
                        alt=""
                        onError={() =>
                          setFailedThumbImages((current) =>
                            current.includes(image) ? current : [...current, image],
                          )
                        }
                        src={image}
                      />
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="detail-media">
              {selectedImage && failedSelectedImage !== selectedImage ? (
                <img
                  alt={producto.nombre}
                  onError={() => setFailedSelectedImage(selectedImage)}
                  src={selectedImage}
                />
              ) : (
                <div className="media-fallback">Noir & Blanc</div>
              )}
            </div>
          </div>

        </div>

        <aside className="detail-panel detail-stack">
          <div className="detail-heading-block">
            <span className="eyebrow">Detalle de producto</span>
            <h1 className="detail-name detail-name--desktop">{producto.nombre}</h1>
            <div className="detail-price">{formatPrecio(producto.precio)}</div>
          </div>

          <p className="lede">{detailDescription}</p>

          <div className="detail-meta-row">
            {categorias.map((categoria) => (
              <span className="meta-chip" key={categoria}>
                {getProductCategoryLabel(categoria)}
              </span>
            ))}
            <span className="meta-chip">{producto.marca}</span>
            <span
              className={`status-chip ${
                producto.activo ? 'is-active' : 'is-inactive'
              }`}
            >
              {producto.activo ? 'Disponible' : 'No disponible'}
            </span>
            {selectedVariant ? (
              <span className="meta-chip">Vista {selectedVariant.label}</span>
            ) : null}
          </div>
        </aside>

        {colorVariants.length > 0 ? (
          <div
            className={`detail-gallery-rails${galeria.length > 1 ? ' has-thumbs' : ''}`}
          >
            <div className="detail-color-switcher" aria-label="Colores del producto">
              {colorVariants.map((variant) => (
                <button
                  className={`detail-swatch-button${
                    selectedVariantKey === variant.key ? ' is-active' : ''
                  }`}
                  key={variant.key}
                  onClick={() => {
                    setSelectedVariantKey((current) =>
                      current === variant.key ? null : variant.key,
                    )
                    setSelectedImagePreference(null)
                    setFailedSelectedImage(null)
                  }}
                  type="button"
                >
                  <span
                    className="detail-swatch-dot"
                    style={{ backgroundColor: variant.colorHex }}
                  />
                  <span>{variant.label}</span>
                </button>
              ))}
            </div>

            {galeria.length > 1 ? (
              <div
                className="detail-thumbs detail-thumbs--mobile"
                aria-label="Vistas del producto"
              >
                {galeria.map((image) => (
                  <button
                    aria-label={`Vista de ${producto.nombre}`}
                    className={`thumb-button${
                      image === selectedImage ? ' is-active' : ''
                    }`}
                    key={`mobile-${image}`}
                    onClick={() => {
                      setSelectedImagePreference(image)
                      setFailedSelectedImage(null)
                    }}
                    type="button"
                  >
                    {failedThumbImages.includes(image) ? (
                      <span aria-hidden="true" className="thumb-fallback">
                        NB
                      </span>
                    ) : (
                      <img
                        alt=""
                        onError={() =>
                          setFailedThumbImages((current) =>
                            current.includes(image) ? current : [...current, image],
                          )
                        }
                        src={image}
                      />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

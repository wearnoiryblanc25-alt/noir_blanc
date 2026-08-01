import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../api/api'
import {
  ALL_PRODUCT_CATEGORIES_VALUE,
  normalizeProductCategory,
} from '../../constants/productCategories'
import {
  formatPrecio,
  getProductos,
  type Producto,
} from '../../services/productos.service'
import { resolveDefaultProductColorHex } from '../../utils/productColor'

const buildSearchableText = (producto: Producto) =>
  [
    producto.nombre,
    producto.descripcion,
    producto.categoria,
    ...producto.categorias,
    producto.marca,
    ...producto.colores,
    producto.imagenPrincipalColor ?? '',
    ...producto.imagenesPorColor.map((image) => image.color ?? ''),
    ...producto.tallas,
  ]
    .join(' ')
    .toLowerCase()

const getProductoCategorias = (producto: Producto) =>
  producto.categorias.length > 0
    ? producto.categorias
    : producto.categoria.trim()
      ? [producto.categoria]
      : []

const ProductMedia = ({
  alt,
  src,
}: {
  alt: string
  src: string | null
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const canRenderImage = Boolean(src) && failedSrc !== src

  return (
    <div className="product-media">
      {canRenderImage ? (
        <img
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          src={src ?? undefined}
        />
      ) : (
        <div className="media-fallback">Noir & Blanc</div>
      )}
    </div>
  )
}

const CatalogColorDots = ({ colors }: { colors: string[] }) => {
  const visibleColors = colors.slice(0, 4)

  if (visibleColors.length === 0) {
    return <p className="catalog-color-summary-text">Sin colores registrados</p>
  }

  return (
    <div className="catalog-color-summary">
      <div className="catalog-color-dots" aria-label="Colores disponibles">
        {visibleColors.map((color, index) => (
          <span
            className="color-dot"
            key={`${color}-${index}`}
            style={{ backgroundColor: resolveDefaultProductColorHex(color) }}
            title={color}
          />
        ))}
      </div>
      <span className="catalog-color-summary-text">
        {colors.length === 1 ? '1 color disponible' : `${colors.length} colores disponibles`}
      </span>
    </div>
  )
}

export const CatalogoPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [productos, setProductos] = useState<Producto[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase())
  const selectedCategory = normalizeProductCategory(
    searchParams.get('categoria') ?? ALL_PRODUCT_CATEGORIES_VALUE,
  )
  const selectedBrand = searchParams.get('marca')?.trim() ?? ''
  const normalizedSelectedBrand = selectedBrand.trim().toLowerCase()

  useEffect(() => {
    let active = true

    const loadProductos = async () => {
      try {
        setLoading(true)
        const response = await getProductos({ activo: true })

        if (active) {
          setProductos(response.filter((producto) => producto.activo))
          setError(null)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getApiErrorMessage(
              requestError,
              'No fue posible cargar el catálogo por ahora.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadProductos()

    return () => {
      active = false
    }
  }, [])

  const indexedProductos = useMemo(
    () =>
      productos.map((producto) => ({
        producto,
        categorias: getProductoCategorias(producto).map((categoria) =>
          normalizeProductCategory(categoria),
        ),
        marcaNormalizada: producto.marca.trim().toLowerCase(),
        searchableText: buildSearchableText(producto),
      })),
    [productos],
  )

  const filteredProducts = useMemo(
    () =>
      indexedProductos
        .filter(({ categorias, marcaNormalizada, searchableText }) => {
          if (
            selectedCategory !== ALL_PRODUCT_CATEGORIES_VALUE &&
            !categorias.includes(selectedCategory)
          ) {
            return false
          }

          if (normalizedSelectedBrand && marcaNormalizada !== normalizedSelectedBrand) {
            return false
          }

          if (deferredSearchTerm && !searchableText.includes(deferredSearchTerm)) {
            return false
          }

          return true
        })
        .map(({ producto }) => producto)
        .sort((left, right) => right.id - left.id),
    [
      deferredSearchTerm,
      indexedProductos,
      normalizedSelectedBrand,
      selectedCategory,
    ],
  )

  const hasActiveFilters =
    selectedCategory !== ALL_PRODUCT_CATEGORIES_VALUE ||
    selectedBrand !== '' ||
    searchTerm.trim().length > 0

  const clearFilters = () => {
    setSearchTerm('')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('categoria')
    nextParams.delete('marca')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <section className="catalog-stage">
      <div className="catalog-toolbar">
        <label className="catalog-search-inline">
          <span className="catalog-search-icon" aria-hidden="true" />
          <input
            className="catalog-search-input"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Busca por nombre, marca, color o talla"
            type="search"
            value={searchTerm}
          />
        </label>
      </div>

      <div className="catalog-results-bar">
        {hasActiveFilters ? (
          <button
            className="button button--ghost"
            onClick={clearFilters}
            type="button"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {loading ? (
        <div className="loading-grid" aria-label="Cargando productos">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <p>No encontramos piezas con esa combinacion de filtros.</p>
          <button
            className="button button--ghost"
            onClick={clearFilters}
            type="button"
          >
            Mostrar todo el catalogo
          </button>
        </div>
      ) : (
        <div className="catalog-grid catalog-grid--editorial">
          {filteredProducts.map((producto) => (
            <Link
              className="catalog-card catalog-card--editorial"
              key={producto.id}
              to={`/producto/${producto.id}`}
            >
              <div className="catalog-card-visual">
                <ProductMedia alt={producto.nombre} src={producto.imagenPrincipal} />
              </div>

              <div className="catalog-body catalog-body--editorial">
                <h3 className="catalog-name">{producto.nombre}</h3>

                <div className="catalog-price-row">
                  <div className="product-price">{formatPrecio(producto.precio)}</div>
                </div>

                <div className="catalog-colors-block">
                  <span className="small-label">Colores disponibles</span>
                  <CatalogColorDots colors={producto.colores} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

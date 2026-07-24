import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DropdownSelect } from '../components/DropdownSelect'
import {
  ALL_PRODUCT_CATEGORIES_VALUE,
  PRODUCT_CATEGORY_OPTIONS,
  normalizeProductCategory,
} from '../constants/productCategories'
import { LoginPage } from '../pages/auth/LoginPage'
import { getProductos } from '../services/productos.service'

const WhatsAppIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="18"
    viewBox="0 0 24 24"
    width="18"
  >
    <path
      d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .15 5.34.15 11.91c0 2.1.55 4.16 1.6 5.98L0 24l6.3-1.65a11.87 11.87 0 0 0 5.77 1.47h.01c6.57 0 11.92-5.34 11.92-11.91 0-3.18-1.24-6.17-3.48-8.43Zm-8.45 18.33h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.21-3.74.98 1-3.65-.23-.38a9.84 9.84 0 0 1-1.52-5.26c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.98 2.9a9.81 9.81 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.89 9.9Z"
      fill="currentColor"
    />
    <path
      d="M17.52 14.56c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.79-1.68-2.1-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.11 3.22 5.12 4.52.72.31 1.28.5 1.71.64.72.23 1.37.2 1.89.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z"
      fill="currentColor"
    />
  </svg>
)

const InstagramIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="18"
    viewBox="0 0 24 24"
    width="18"
  >
    <rect
      height="17"
      rx="5"
      stroke="currentColor"
      strokeWidth="1.8"
      width="17"
      x="3.5"
      y="3.5"
    />
    <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.4" cy="6.7" fill="currentColor" r="1.1" />
  </svg>
)

const buildUniqueLabels = (items: string[]) => {
  const uniqueValues = new Map<string, string>()

  items.forEach((item) => {
    const normalizedValue = item.trim()

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

export const PublicLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, isSuperUser, logout } = useAuth()
  const searchParams = new URLSearchParams(location.search)
  const showLoginOverlay = location.pathname === '/login'
  const isCatalogHomeView = location.pathname === '/' || showLoginOverlay
  const isProductDetailView = location.pathname.startsWith('/producto/')
  const isCatalogView =
    isCatalogHomeView || isProductDetailView
  const selectedCategory = normalizeProductCategory(
    searchParams.get('categoria') ?? ALL_PRODUCT_CATEGORIES_VALUE,
  )
  const selectedBrand = isCatalogView ? searchParams.get('marca')?.trim() ?? '' : ''
  const [brandOptions, setBrandOptions] = useState<string[]>([])

  useEffect(() => {
    if (!isCatalogView) {
      return
    }

    let active = true

    const loadBrands = async () => {
      try {
        const productos = await getProductos()

        if (!active) {
          return
        }

        const marcas = buildUniqueLabels(
          productos
            .filter((producto) => producto.activo)
            .map((producto) => producto.marca.trim()),
        ).sort((left, right) => left.localeCompare(right))

        setBrandOptions(marcas)
      } catch {
        if (active) {
          setBrandOptions([])
        }
      }
    }

    void loadBrands()

    return () => {
      active = false
    }
  }, [isCatalogView])

  const buildCatalogRoute = (
    nextCategory: string,
    nextBrand: string,
  ) => {
    const params = new URLSearchParams()

    if (nextCategory !== ALL_PRODUCT_CATEGORIES_VALUE) {
      params.set('categoria', nextCategory)
    }

    if (nextBrand.trim()) {
      params.set('marca', nextBrand.trim())
    }

    const query = params.toString()

    return query ? `/?${query}` : '/'
  }

  return (
    <div className="app-shell public-layout">
      <header className="public-header">
        <div className="brand-lockup">
          <NavLink className="brand-mark" to="/">
            NOIR&BLANC
          </NavLink>
          <span className="brand-subtitle">Collection</span>
          <div className="brand-socials" aria-label="Redes sociales">
            <a
              className="brand-social-link brand-social-link--whatsapp"
              href="https://wa.me/message/USYOWGBVWLSAH1"
              rel="noreferrer"
              target="_blank"
            >
              <span className="brand-social-icon">
                <WhatsAppIcon />
              </span>
              <span>WhatsApp</span>
            </a>
            <a
              className="brand-social-link brand-social-link--instagram"
              href="https://www.instagram.com/wear.noiryblanc?igsh=MXZ5OTVrbW41YWZ5Zw=="
              rel="noreferrer"
              target="_blank"
            >
              <span className="brand-social-icon">
                <InstagramIcon />
              </span>
              <span>Instagram</span>
            </a>
          </div>
        </div>

        <div className="public-header-center">
          <nav
            className="public-category-nav public-category-nav--desktop"
            aria-label="Categorias del catálogo"
          >
            <NavLink
              className={`public-category-link${
                selectedCategory === ALL_PRODUCT_CATEGORIES_VALUE ? ' is-active' : ''
              }`}
              to={buildCatalogRoute(ALL_PRODUCT_CATEGORIES_VALUE, selectedBrand)}
            >
              Todos
            </NavLink>
            {PRODUCT_CATEGORY_OPTIONS.map((option) => (
              <NavLink
                className={`public-category-link${
                  selectedCategory === option.value ? ' is-active' : ''
                }`}
                key={option.value}
                to={buildCatalogRoute(option.value, selectedBrand)}
              >
                {option.label}
              </NavLink>
            ))}
          </nav>

          <div className="public-header-filters">
            <div
              className={`public-header-dropdown public-header-dropdown--categories${
                selectedCategory !== ALL_PRODUCT_CATEGORIES_VALUE ? ' is-filtered' : ''
              }`}
            >
              <DropdownSelect
                ariaLabel="Categorias"
                buttonLabel="Categorias"
                className="public-header-dropdown-select"
                onChange={(nextValue) =>
                  navigate(buildCatalogRoute(nextValue, selectedBrand))
                }
                options={[
                  {
                    label: 'Todas las categorias',
                    value: ALL_PRODUCT_CATEGORIES_VALUE,
                  },
                  ...PRODUCT_CATEGORY_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option.value,
                  })),
                ]}
                showMenuIcon
                size="header"
                value={selectedCategory}
              />
            </div>

            {isCatalogView && brandOptions.length > 0 ? (
              <div
                className={`public-header-dropdown public-header-dropdown--brand${
                  selectedBrand ? ' is-filtered' : ''
                }`}
              >
                <DropdownSelect
                  ariaLabel="Marcas"
                  buttonLabel="Marcas"
                  className="public-header-dropdown-select public-header-dropdown-select--brand"
                  onChange={(nextValue) =>
                    navigate(buildCatalogRoute(selectedCategory, nextValue))
                  }
                  options={[
                    ...brandOptions.map((brand) => ({
                      label: brand,
                      value: brand,
                    })),
                  ]}
                  showMenuIcon
                  showSelectedText={false}
                  size="header"
                  value={selectedBrand}
                />
              </div>
            ) : null}
          </div>
        </div>

        <nav
          className={`public-nav public-nav--actions${
            isCatalogHomeView ? ' is-catalog-view' : ''
          }`}
          aria-label="Navegacion principal"
        >
          <NavLink
            className={({ isActive }) =>
              `nav-pill${isActive ? ' is-active' : ''}`
            }
            to="/"
          >
            Catálogo
          </NavLink>
          {isSuperUser ? (
            <NavLink
              className={({ isActive }) =>
                `nav-pill${isActive ? ' is-active' : ''}`
              }
              to="/admin"
            >
              Panel admin
            </NavLink>
          ) : null}
          {isAuthenticated && !isSuperUser ? (
            <button
              className="nav-pill public-nav-button"
              onClick={() => logout()}
              type="button"
            >
              Cerrar sesión
            </button>
          ) : null}
          {!isAuthenticated ? (
            <NavLink
              className={() =>
                `nav-pill${showLoginOverlay ? ' is-active' : ''}`
              }
              to="/login"
            >
              Iniciar sesión
            </NavLink>
          ) : null}
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <span>Noir&Blanc selecciona siluetas sobrias para un guardarropa sereno.</span>
        <span>Catálogo público y gestión privada sincronizados con tu API.</span>
      </footer>

      {showLoginOverlay ? <LoginPage overlay /> : null}
    </div>
  )
}

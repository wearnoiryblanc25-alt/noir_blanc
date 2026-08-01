import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { getApiErrorMessage, getApiErrorMessages } from '../../api/api'
import { DropdownSelect } from '../../components/DropdownSelect'
import {
  PRODUCT_CATEGORY_OPTIONS,
  getProductCategoryLabel,
  normalizeProductCategory,
} from '../../constants/productCategories'
import {
  createProducto,
  deleteProducto,
  formatPrecio,
  getProductos,
  uploadProductoImages,
  updateProducto,
  type Producto,
  type ProductoImagenColor,
  type ProductoImagenMetadata,
  type ProductoPayload,
  type UploadedProductoImage,
} from '../../services/productos.service'
import {
  normalizeProductColorKey,
  resolveDefaultProductColorHex,
} from '../../utils/productColor'

interface ProductoImagenColorFormState {
  imagen: string
  color: string
  colorHex: string
}

interface ProductoColorFormState {
  nombre: string
  colorHex: string
}

interface ProductoFormState {
  nombre: string
  descripcion: string
  precio: string
  existencia: string
  categorias: string[]
  marca: string
  tallas: string
  coloresDetalle: ProductoColorFormState[]
  imagenPrincipal: string
  imagenPrincipalPublicId: string
  imagenPrincipalColor: string
  imagenPrincipalColorHex: string
  imagenes: string
  imagenesMetadata: ProductoImagenMetadata[]
  imagenesPorColor: ProductoImagenColorFormState[]
  activo: boolean
}

type ProductoImageField = 'imagenPrincipal' | 'imagenes'
type ProductosAdminMode = 'crear' | 'editar'

interface UploadPreviewState {
  imagenPrincipal: string[]
  imagenes: string[]
}

interface ImageDropzoneProps {
  description: string
  images: string[]
  isUploading?: boolean
  label: string
  multiple?: boolean
  onFilesSelected: (files: File[]) => void
}

interface ProductoFormFieldsProps {
  brandSuggestions: string[]
  form: ProductoFormState
  onBrandChange: (value: string) => void
  onCategoryToggle: (categoria: string) => void
  onColorAdd: (payload: ProductoColorFormState) => void
  onColorHexChange: (color: string, colorHex: string) => void
  onColorRemove: (color: string) => void
  onImageUpload: (field: ProductoImageField, files: File[]) => void
  onPrimaryImageColorChange: (color: string) => void
  onSecondaryImageColorChange: (
    index: number,
    color: string,
  ) => void
  onInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
  onRemovePrimaryImage: () => void
  onRemoveSecondaryImage: (index: number) => void
  previewState: UploadPreviewState
  uploadingField: ProductoImageField | null
}

interface ProductosAdminPageProps {
  mode: ProductosAdminMode
}

const acceptedImageTypes = 'image/jpeg,image/png,image/webp,image/avif'
const suggestedProductColors = [
  'Negro',
  'Blanco',
  'Marfil',
  'Beige',
  'Cafe',
  'Gris',
  'Azul',
  'Verde',
  'Rosa',
  'Rojo',
]

const createEmptyFormState = (): ProductoFormState => ({
  nombre: '',
  descripcion: '',
  precio: '',
  existencia: '',
  categorias: [],
  marca: '',
  tallas: '',
  coloresDetalle: [],
  imagenPrincipal: '',
  imagenPrincipalPublicId: '',
  imagenPrincipalColor: '',
  imagenPrincipalColorHex: '#d2c8bc',
  imagenes: '',
  imagenesMetadata: [],
  imagenesPorColor: [],
  activo: true,
})

const createEmptyPreviewState = (): UploadPreviewState => ({
  imagenPrincipal: [],
  imagenes: [],
})

const parseList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

const parseChoiceList = (value: string) => {
  const uniqueValues = new Map<string, string>()

  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const normalizedKey = normalizeProductColorKey(item)

      if (!normalizedKey || uniqueValues.has(normalizedKey)) {
        return
      }

      uniqueValues.set(normalizedKey, item)
    })

  return Array.from(uniqueValues.values())
}

const serializeList = (items: string[]) => items.join('\n')

const dedupeTrimmedList = (items: Array<string | null | undefined>) => {
  const uniqueValues = new Map<string, string>()

  items.forEach((item) => {
    const normalizedValue = item?.trim() ?? ''

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

const sortUniqueLabels = (items: Array<string | null | undefined>) =>
  dedupeTrimmedList(items).sort((left, right) => left.localeCompare(right))

const normalizeSearchTokens = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

const normalizeSecondaryImages = (
  items: Array<string | null | undefined>,
  primaryImage?: string | null,
) => {
  const normalizedPrimary = primaryImage?.trim() ?? ''

  return dedupeTrimmedList(items).filter((item) => item !== normalizedPrimary)
}

const buildImageMetadataState = (
  images: string[],
  metadata: ProductoImagenMetadata[],
): ProductoImagenMetadata[] => {
  const metadataByUrl = new Map<string, ProductoImagenMetadata>()

  metadata.forEach((item) => {
    const url = item.url.trim()

    if (!url || metadataByUrl.has(url)) {
      return
    }

    metadataByUrl.set(url, {
      url,
      publicId: item.publicId?.trim() || null,
    })
  })

  return images.map((url) => metadataByUrl.get(url) ?? { url, publicId: null })
}

const buildUniqueColorPalette = (
  items: Array<ProductoColorFormState | null | undefined>,
) => {
  const uniqueValues = new Map<string, ProductoColorFormState>()

  items.forEach((item) => {
    const normalizedName = item?.nombre?.trim() ?? ''

    if (!normalizedName) {
      return
    }

    const normalizedKey = normalizeProductColorKey(normalizedName)

    if (!uniqueValues.has(normalizedKey)) {
      uniqueValues.set(normalizedKey, {
        nombre: normalizedName,
        colorHex:
          item?.colorHex?.trim() || resolveDefaultProductColorHex(normalizedName),
      })
    }
  })

  return Array.from(uniqueValues.values())
}

const BrandInputField = ({
  onChange,
  suggestions,
  value,
}: {
  onChange: (value: string) => void
  suggestions: string[]
  value: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLLabelElement | null>(null)
  const filteredSuggestions = useMemo(() => {
    const normalizedValue = value.trim().toLowerCase()

    if (!normalizedValue) {
      return suggestions.slice(0, 6)
    }

    const startsWithMatches = suggestions.filter((suggestion: string) => {
      const normalizedSuggestion = suggestion.toLowerCase()

      return (
        normalizedSuggestion.startsWith(normalizedValue) &&
        normalizedSuggestion !== normalizedValue
      )
    })

    const includesMatches = suggestions.filter((suggestion: string) => {
      const normalizedSuggestion = suggestion.toLowerCase()

      return (
        normalizedSuggestion.includes(normalizedValue) &&
        !normalizedSuggestion.startsWith(normalizedValue)
      )
    })

    return [...startsWithMatches, ...includesMatches].slice(0, 6)
  }, [suggestions, value])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <label className="field-group suggestion-field" ref={rootRef}>
      <span className="field-label">Marca</span>
      <input
        autoComplete="off"
        className="text-input suggestion-field__input"
        name="brandLookup"
        onChange={(event) => {
          onChange(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Escribe o selecciona una marca"
        required
        spellCheck={false}
        value={value}
      />

      {isOpen && filteredSuggestions.length > 0 ? (
        <div className="suggestion-field__menu" role="listbox">
          {filteredSuggestions.map((suggestion) => (
            <button
              className={`suggestion-field__option${
                suggestion.toLowerCase() === value.trim().toLowerCase()
                  ? ' is-selected'
                  : ''
              }`}
              key={suggestion}
              onClick={() => {
                onChange(suggestion)
                setIsOpen(false)
              }}
              onMouseDown={(event) => event.preventDefault()}
              role="option"
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  )
}

const findColorHex = (
  palette: ProductoColorFormState[],
  colorName?: string | null,
) => {
  const normalizedName = normalizeProductColorKey(colorName)

  if (!normalizedName) {
    return null
  }

  const match = palette.find(
    (item) => normalizeProductColorKey(item.nombre) === normalizedName,
  )

  return match?.colorHex ?? resolveDefaultProductColorHex(colorName ?? '')
}

const upsertPaletteColor = (
  palette: ProductoColorFormState[],
  payload: ProductoColorFormState,
) => {
  const normalizedName = payload.nombre.trim()

  if (!normalizedName) {
    return buildUniqueColorPalette(palette)
  }

  const normalizedKey = normalizeProductColorKey(normalizedName)
  let didUpdate = false

  const nextPalette = palette.map((item) => {
    if (normalizeProductColorKey(item.nombre) !== normalizedKey) {
      return item
    }

    didUpdate = true

    return {
      nombre: normalizedName,
      colorHex:
        payload.colorHex.trim() || resolveDefaultProductColorHex(normalizedName),
    }
  })

  if (!didUpdate) {
    nextPalette.push({
      nombre: normalizedName,
      colorHex:
        payload.colorHex.trim() || resolveDefaultProductColorHex(normalizedName),
    })
  }

  return buildUniqueColorPalette(nextPalette)
}

const removePaletteColor = (
  palette: ProductoColorFormState[],
  colorName: string,
) => {
  const normalizedName = normalizeProductColorKey(colorName)

  return palette.filter(
    (item) => normalizeProductColorKey(item.nombre) !== normalizedName,
  )
}

const syncFormPalette = (
  form: ProductoFormState,
  palette: ProductoColorFormState[],
): ProductoFormState => {
  const nextPalette = buildUniqueColorPalette(palette)
  const nextPrimaryHex = findColorHex(nextPalette, form.imagenPrincipalColor)

  return {
    ...form,
    coloresDetalle: nextPalette,
    imagenPrincipalColor: nextPrimaryHex ? form.imagenPrincipalColor : '',
    imagenPrincipalColorHex: nextPrimaryHex ?? '#d2c8bc',
    imagenesPorColor: form.imagenesPorColor.map((image) => {
      const nextHex = findColorHex(nextPalette, image.color)

      return {
        ...image,
        color: nextHex ? image.color : '',
        colorHex: nextHex ?? '#d2c8bc',
      }
    }),
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const buildErrorAlertHtml = (messages: string[]) => `
  <div style="text-align:left">
    <p style="margin:0 0 12px;color:#5c544b">Revisa estos puntos antes de continuar:</p>
    <ul style="margin:0;padding-left:20px;color:#1d1a17">
      ${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}
    </ul>
  </div>
`

const showRequestErrorAlert = async (
  title: string,
  error: unknown,
  fallback: string,
) => {
  const messages = getApiErrorMessages(error, fallback)

  await Swal.fire({
    icon: 'error',
    title,
    html: buildErrorAlertHtml(messages),
    confirmButtonText: 'Revisar',
    background: '#fffdf9',
    confirmButtonColor: '#1d1a17',
  })

  return messages
}

const buildImageColorFormState = (
  images: string[],
  assignments: ProductoImagenColor[] | ProductoImagenColorFormState[],
): ProductoImagenColorFormState[] =>
  images.map((imagen) => {
    const currentAssignment = assignments.find(
      (assignment) => assignment.imagen === imagen,
    )

    return {
      imagen,
      color: currentAssignment?.color?.trim() ?? '',
      colorHex:
        currentAssignment?.colorHex?.trim() ||
        resolveDefaultProductColorHex(currentAssignment?.color ?? ''),
    }
  })

const getProductoCategorias = (producto: Producto) =>
  producto.categorias.length > 0
    ? producto.categorias
    : producto.categoria.trim()
      ? [producto.categoria]
      : []

const buildPaletteFromProducto = (producto: Producto) =>
  buildUniqueColorPalette([
    ...producto.colores.map((color) => ({
      nombre: color,
      colorHex:
        producto.imagenesPorColor.find(
          (item) =>
            normalizeProductColorKey(item.color) === normalizeProductColorKey(color),
        )?.colorHex ??
        (normalizeProductColorKey(producto.imagenPrincipalColor) ===
        normalizeProductColorKey(color)
          ? producto.imagenPrincipalColorHex
          : null) ??
        resolveDefaultProductColorHex(color),
    })),
    ...(producto.imagenPrincipalColor?.trim()
      ? [
          {
            nombre: producto.imagenPrincipalColor,
            colorHex:
              producto.imagenPrincipalColorHex ??
              resolveDefaultProductColorHex(producto.imagenPrincipalColor),
          },
        ]
      : []),
    ...producto.imagenesPorColor
      .filter((item) => item.color?.trim())
      .map((item) => ({
        nombre: item.color ?? '',
        colorHex: item.colorHex ?? resolveDefaultProductColorHex(item.color ?? ''),
      })),
  ])

const mapProductoToForm = (producto: Producto): ProductoFormState => {
  const secondaryImages = normalizeSecondaryImages(
    producto.imagenes,
    producto.imagenPrincipal,
  )
  const coloresDetalle = buildPaletteFromProducto(producto)
  const secondaryImageMetadata = buildImageMetadataState(
    secondaryImages,
    producto.imagenesMetadata,
  )

  return {
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: String(producto.precio),
    existencia: String(producto.existencia),
    categorias:
      producto.categorias.length > 0
        ? producto.categorias.map((categoria) =>
            normalizeProductCategory(categoria),
          )
        : [normalizeProductCategory(producto.categoria)],
    marca: producto.marca,
    tallas: producto.tallas.join(', '),
    coloresDetalle,
    imagenPrincipal: producto.imagenPrincipal ?? '',
    imagenPrincipalPublicId: producto.imagenPrincipalPublicId ?? '',
    imagenPrincipalColor: producto.imagenPrincipalColor ?? '',
    imagenPrincipalColorHex:
      findColorHex(coloresDetalle, producto.imagenPrincipalColor) ??
      producto.imagenPrincipalColorHex ??
      '#d2c8bc',
    imagenes: secondaryImages.join('\n'),
    imagenesMetadata: secondaryImageMetadata,
    imagenesPorColor: buildImageColorFormState(
      secondaryImages,
      producto.imagenesPorColor,
    ),
    activo: producto.activo,
  }
}

const buildPayload = (form: ProductoFormState): ProductoPayload => {
  const coloresDetalle = buildUniqueColorPalette(form.coloresDetalle)
  const secondaryImages = normalizeSecondaryImages(
    parseList(form.imagenes),
    form.imagenPrincipal,
  )
  const secondaryImageMetadata = buildImageMetadataState(
    secondaryImages,
    form.imagenesMetadata,
  )
  const relatedImages = buildImageColorFormState(
    secondaryImages,
    form.imagenesPorColor,
  )
  const colores = dedupeTrimmedList(coloresDetalle.map((item) => item.nombre))

  return {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    precio: Number(form.precio),
    existencia: Number(form.existencia),
    categoria: form.categorias[0] ?? 'GENERAL',
    categorias: form.categorias,
    marca: form.marca.trim(),
    tallas: parseList(form.tallas),
    colores,
    imagenPrincipal: form.imagenPrincipal.trim() || null,
    imagenPrincipalPublicId: form.imagenPrincipal.trim()
      ? form.imagenPrincipalPublicId.trim() || null
      : null,
    imagenPrincipalColor: form.imagenPrincipal.trim()
      ? form.imagenPrincipalColor.trim() || null
      : null,
    imagenPrincipalColorHex: form.imagenPrincipal.trim()
      ? findColorHex(coloresDetalle, form.imagenPrincipalColor)
      : null,
    imagenes: secondaryImages,
    imagenesMetadata: secondaryImageMetadata,
    imagenesPorColor: relatedImages.map((image) => ({
      imagen: image.imagen,
      color: image.color.trim() || null,
      colorHex: findColorHex(coloresDetalle, image.color),
    })),
    activo: form.activo,
  }
}

const applyUploadedImagesToForm = (
  form: ProductoFormState,
  field: ProductoImageField,
  uploadedImages: UploadedProductoImage[],
): ProductoFormState => {
  if (field === 'imagenPrincipal') {
    const nextPrimaryImage = uploadedImages[0]?.url ?? form.imagenPrincipal
    const nextSecondaryImages = normalizeSecondaryImages(
      parseList(form.imagenes),
      nextPrimaryImage,
    )

    return {
      ...form,
      imagenPrincipal: nextPrimaryImage,
      imagenPrincipalPublicId: uploadedImages[0]?.publicId ?? '',
      imagenes: serializeList(nextSecondaryImages),
      imagenesMetadata: buildImageMetadataState(
        nextSecondaryImages,
        form.imagenesMetadata,
      ),
      imagenesPorColor: buildImageColorFormState(
        nextSecondaryImages,
        form.imagenesPorColor,
      ),
    }
  }

  const nextSecondaryImages = normalizeSecondaryImages(
    [...parseList(form.imagenes), ...uploadedImages.map((image) => image.url)],
    form.imagenPrincipal,
  )

  return {
    ...form,
    imagenes: serializeList(nextSecondaryImages),
    imagenesMetadata: buildImageMetadataState(nextSecondaryImages, [
      ...form.imagenesMetadata,
      ...uploadedImages.map((image) => ({
        url: image.url,
        publicId: image.publicId,
      })),
    ]),
    imagenesPorColor: buildImageColorFormState(
      nextSecondaryImages,
      form.imagenesPorColor,
    ),
  }
}

const removePrimaryImageFromForm = (form: ProductoFormState): ProductoFormState => ({
  ...form,
  imagenPrincipal: '',
  imagenPrincipalPublicId: '',
  imagenPrincipalColor: '',
  imagenPrincipalColorHex: '#d2c8bc',
})

const removeSecondaryImageFromForm = (
  form: ProductoFormState,
  indexToRemove: number,
): ProductoFormState => {
  const nextAssignments = form.imagenesPorColor.filter(
    (_, index) => index !== indexToRemove,
  )
  const nextImages = nextAssignments.map((image) => image.imagen)

  return {
    ...form,
    imagenes: serializeList(nextImages),
    imagenesMetadata: buildImageMetadataState(nextImages, form.imagenesMetadata),
    imagenesPorColor: nextAssignments,
  }
}

const revokePreviewUrls = (urls: string[]) => {
  urls.forEach((url) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
}

const replacePreviewField = (
  current: UploadPreviewState,
  field: ProductoImageField,
  nextUrls: string[],
): UploadPreviewState => {
  revokePreviewUrls(current[field])

  return {
    ...current,
    [field]: nextUrls,
  }
}

const syncPreviewWithForm = (
  form: ProductoFormState,
  field: ProductoImageField,
): string[] =>
  field === 'imagenPrincipal'
    ? form.imagenPrincipal.trim()
      ? [form.imagenPrincipal.trim()]
      : []
    : parseList(form.imagenes)

const removePreviewImageFromState = (
  current: UploadPreviewState,
  field: ProductoImageField,
  indexToRemove?: number,
): UploadPreviewState => {
  if (current[field].length === 0) {
    return current
  }

  if (field === 'imagenPrincipal') {
    return replacePreviewField(current, field, [])
  }

  return replacePreviewField(
    current,
    field,
    current.imagenes.filter((_, index) => index !== indexToRemove),
  )
}

const clearPreviewState = (current: UploadPreviewState): UploadPreviewState => {
  revokePreviewUrls(current.imagenPrincipal)
  revokePreviewUrls(current.imagenes)

  return createEmptyPreviewState()
}

const createObjectPreviewUrls = (files: File[]) =>
  files.map((file) => URL.createObjectURL(file))

const AdminProductMedia = ({
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
        <img alt={alt} onError={() => setFailedSrc(src)} src={src ?? undefined} />
      ) : (
        <div className="media-fallback">Noir & Blanc</div>
      )}
    </div>
  )
}

const ImageDropzone = ({
  description,
  images,
  isUploading = false,
  label,
  multiple = false,
  onFilesSelected,
}: ImageDropzoneProps) => {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const openFilePicker = () => {
    if (isUploading) {
      return
    }

    inputRef.current?.click()
  }

  const selectFiles = (fileList: FileList | null) => {
    if (!fileList?.length || isUploading) {
      return
    }

    onFilesSelected(Array.from(fileList))
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (isUploading) {
      return
    }

    setIsDragActive(true)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (isUploading) {
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    setIsDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    setIsDragActive(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    selectFiles(event.dataTransfer.files)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    openFilePicker()
  }

  return (
    <div className="field-group field-group--full">
      <span className="field-label">{label}</span>

      <input
        accept={acceptedImageTypes}
        className="sr-only"
        id={inputId}
        multiple={multiple}
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />

      <div
        aria-disabled={isUploading}
        className={`upload-dropzone${isDragActive ? ' is-dragging' : ''}${
          isUploading ? ' is-uploading' : ''
        }`}
        onClick={openFilePicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={isUploading ? -1 : 0}
      >
        <span className="small-label">
          {multiple ? 'Carga multiple' : 'Carga individual'}
        </span>
        <strong>
          {isUploading
            ? 'Subiendo imagenes...'
            : 'Haz clic para escoger archivos o arrastralos aqui'}
        </strong>
        <p className="muted-text">{description}</p>
      </div>

      {images.length > 0 ? (
        <div className="upload-dropzone-status">
          <span className="small-label">
            {multiple
              ? `${images.length} fotos listas para relacionarse abajo`
              : 'Foto lista para relacionarse abajo'}
          </span>
        </div>
      ) : null}
    </div>
  )
}

const CategorySelectorField = ({
  selectedCategories,
  onToggle,
}: {
  selectedCategories: string[]
  onToggle: (categoria: string) => void
}) => (
  <div className="field-group field-group--full category-selector-field">
    <div className="category-choice-header">
      <span className="field-label">Categorias</span>
      <span className="small-label">
        {selectedCategories.length > 0
          ? `${selectedCategories.length} asignadas`
          : 'Combina las que necesites'}
      </span>
    </div>

    <div className="filter-chip-grid">
      {PRODUCT_CATEGORY_OPTIONS.map((option) => {
        const isActive = selectedCategories.includes(option.value)

        return (
          <button
            aria-pressed={isActive}
            className={`filter-chip${isActive ? ' is-active' : ''}`}
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  </div>
)

const ChoiceAddField = ({
  description,
  label,
  onAdd,
  onColorHexChange,
  onRemove,
  selectedValues,
  suggestions = [],
}: {
  description: string
  label: string
  onAdd: (value: ProductoColorFormState) => void
  onColorHexChange: (color: string, colorHex: string) => void
  onRemove: (value: string) => void
  selectedValues: ProductoColorFormState[]
  suggestions?: string[]
}) => {
  const [draftValue, setDraftValue] = useState('')
  const [draftColorHex, setDraftColorHex] = useState('#d2c8bc')
  const [draftColorHexTouched, setDraftColorHexTouched] = useState(false)
  const listId = useId()
  const selectedLookup = new Set(
    selectedValues.map((value) => normalizeProductColorKey(value.nombre)),
  )

  const commitValue = () => {
    const nextValues = parseChoiceList(draftValue)

    if (nextValues.length === 0) {
      return
    }

    nextValues.forEach((value) => {
      onAdd({
        nombre: value,
        colorHex:
          nextValues.length === 1 && draftColorHexTouched
            ? draftColorHex
            : resolveDefaultProductColorHex(value),
      })
    })

    setDraftValue('')
    setDraftColorHex('#d2c8bc')
    setDraftColorHexTouched(false)
  }

  return (
    <div className="field-group field-group--full choice-add-field">
      <div className="category-choice-header">
        <span className="field-label">{label}</span>
        <span className="small-label">
          {selectedValues.length > 0
            ? `${selectedValues.length} agregados`
            : 'Agrega uno o varios'}
        </span>
      </div>

      <p className="muted-text upload-relations-copy">{description}</p>

      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}

      {selectedValues.length > 0 ? (
        <div className="choice-add-list">
          {selectedValues.map((value) => (
            <div
              className="choice-pill choice-pill--selected choice-pill--editable"
              key={value.nombre}
            >
              <span>{value.nombre}</span>
              <span
                aria-hidden="true"
                className="choice-pill-dot"
                style={{ backgroundColor: value.colorHex }}
              >
                ×
              </span>
              <input
                aria-label={`Cambiar tono de ${value.nombre}`}
                className="choice-pill-color"
                onChange={(event) =>
                  onColorHexChange(value.nombre, event.target.value)
                }
                type="color"
                value={value.colorHex}
              />
              <button
                className="choice-pill-remove-button"
                onClick={() => onRemove(value.nombre)}
                type="button"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="choice-add-suggestions">
          {suggestions
            .filter(
              (suggestion) =>
                !selectedLookup.has(normalizeProductColorKey(suggestion)),
            )
            .map((suggestion) => (
              <button
                className="choice-pill"
                key={suggestion}
                onClick={() =>
                  onAdd({
                    nombre: suggestion,
                    colorHex: resolveDefaultProductColorHex(suggestion),
                  })
                }
                type="button"
              >
                {suggestion}
              </button>
            ))}
        </div>
      ) : null}

      <div className="choice-add-input-row">
        <input
          aria-label="Color visual del tono"
          className="choice-add-picker"
          onChange={(event) => {
            setDraftColorHex(event.target.value)
            setDraftColorHexTouched(true)
          }}
          type="color"
          value={draftColorHex}
        />
        <input
          className="text-input"
          list={suggestions.length > 0 ? listId : undefined}
          onChange={(event) => {
            const nextValue = event.target.value

            setDraftValue(nextValue)

            if (!draftColorHexTouched) {
              const nextValues = parseChoiceList(nextValue)

              setDraftColorHex(
                nextValues.length === 1
                  ? resolveDefaultProductColorHex(nextValues[0])
                  : '#d2c8bc',
              )
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return
            }

            event.preventDefault()
            commitValue()
          }}
          placeholder="Escribe colores separados por coma o Enter"
          type="text"
          value={draftValue}
        />
        <button className="button button--ghost" onClick={commitValue} type="button">
          Agregar
        </button>
      </div>
    </div>
  )
}

const AdminModal = ({
  children,
  footer,
  onClose,
  subtitle,
  title,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  subtitle?: string
  title: string
}) => {
  const titleId = useId()
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="admin-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="admin-form-caption">{subtitle}</p> : null}
          </div>
          <button
            aria-label="Cerrar editor"
            className="button button--ghost admin-modal-close"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="admin-modal-body" ref={bodyRef}>
          {children}
        </div>
        {footer ? <div className="admin-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

const buildImageColorOptions = (form: ProductoFormState) =>
  buildUniqueColorPalette(form.coloresDetalle)

const ImageColorRelationEditor = ({
  colorOptions,
  description,
  images,
  isUploading = false,
  label,
  onColorChange,
  onRemoveImage,
  selectedColors,
}: {
  colorOptions: ProductoColorFormState[]
  description: string
  images: string[]
  isUploading?: boolean
  label: string
  onColorChange: (index: number, color: string) => void
  onRemoveImage: (index: number) => void
  selectedColors: string[]
}) => {
  if (images.length === 0) {
    return null
  }

  return (
    <div className="field-group field-group--full">
      <div className="category-choice-header">
        <span className="field-label">{label}</span>
        <span className="small-label">
          {isUploading ? 'Espera la carga' : 'Relaciona cada foto'}
        </span>
      </div>

      <p className="muted-text upload-relations-copy">{description}</p>
      {colorOptions.length === 0 ? (
        <p className="muted-text image-color-empty">
          Agrega primero la paleta del producto y luego vincula aqui cada foto.
        </p>
      ) : null}

      <div className="upload-preview-grid upload-preview-grid--compact">
        {images.map((image, index) => {
          const selectedColor = selectedColors[index] ?? ''
          const selectedColorHex =
            findColorHex(colorOptions, selectedColor) ?? '#d2c8bc'

          return (
            <div
              className="upload-preview-card upload-preview-card--compact"
              key={`${image}-${index}`}
            >
              <div className="upload-preview-media upload-preview-media--compact">
                <img alt={`${label} ${index + 1}`} src={image} />
              </div>

              <div className="upload-preview-footer upload-preview-footer--stacked">
                <div className="upload-preview-caption-row">
                  <span className="small-label">Foto {index + 1}</span>
                  <span
                    aria-hidden="true"
                    className="choice-pill-dot choice-pill-dot--large"
                    style={{ backgroundColor: selectedColorHex }}
                  />
                </div>
                <DropdownSelect
                  ariaLabel={`Color para ${label} ${index + 1}`}
                  className="upload-preview-select"
                  disabled={isUploading || colorOptions.length === 0}
                  onChange={(nextValue) => onColorChange(index, nextValue)}
                  options={[
                    {
                      label: 'Sin color',
                      value: '',
                    },
                    ...colorOptions.map((color) => ({
                      colorHex: color.colorHex,
                      label: color.nombre,
                      value: color.nombre,
                    })),
                  ]}
                  placeholder="Sin color"
                  value={selectedColor}
                  withColorDot
                />
                <button
                  className="upload-preview-remove"
                  disabled={isUploading}
                  onClick={() => onRemoveImage(index)}
                  type="button"
                >
                  Quitar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ProductoFormFields = ({
  brandSuggestions,
  form,
  onBrandChange,
  onCategoryToggle,
  onColorAdd,
  onColorHexChange,
  onColorRemove,
  onImageUpload,
  onPrimaryImageColorChange,
  onSecondaryImageColorChange,
  onInputChange,
  onRemovePrimaryImage,
  onRemoveSecondaryImage,
  previewState,
  uploadingField,
}: ProductoFormFieldsProps) => {
  const principalImage = form.imagenPrincipal.trim()
  const secondaryImages = parseList(form.imagenes)
  const colorOptions = buildImageColorOptions(form)
  const principalPreview =
    previewState.imagenPrincipal.length > 0
      ? previewState.imagenPrincipal
      : principalImage
        ? [principalImage]
        : []
  const secondaryPreview =
    previewState.imagenes.length > 0 ? previewState.imagenes : secondaryImages

  return (
    <div className="form-grid">
      <label className="field-group">
        <span className="field-label">Nombre</span>
        <input
          className="text-input"
          name="nombre"
          onChange={onInputChange}
          required
          value={form.nombre}
        />
      </label>

      <BrandInputField
        onChange={onBrandChange}
        suggestions={brandSuggestions}
        value={form.marca}
      />

      <CategorySelectorField
        onToggle={onCategoryToggle}
        selectedCategories={form.categorias}
      />

      <div className="field-group field-group--full form-flow-note">
        <p className="muted-text">
          Define la paleta una sola vez y usa esa misma lista para relacionar
          cada foto con su vista correcta sin repetir tonos.
        </p>
      </div>

      <label className="field-group">
        <span className="field-label">Precio</span>
        <input
          className="text-input"
          min="0"
          name="precio"
          onChange={onInputChange}
          required
          step="0.01"
          type="number"
          value={form.precio}
        />
      </label>

      <label className="field-group">
        <span className="field-label">Existencia</span>
        <input
          className="text-input"
          min="0"
          name="existencia"
          onChange={onInputChange}
          required
          step="1"
          type="number"
          value={form.existencia}
        />
      </label>

      <ImageDropzone
        description="Acepta JPG, PNG, WEBP o AVIF. Puedes hacer clic o arrastrar la foto principal y luego relacionarla con su color en el bloque inferior."
        images={principalPreview}
        isUploading={uploadingField === 'imagenPrincipal'}
        label="Imagen principal"
        onFilesSelected={(files) => onImageUpload('imagenPrincipal', files)}
      />

      <ImageColorRelationEditor
        colorOptions={colorOptions}
        description="Selecciona desde la paleta el color que representa esta foto principal."
        images={principalPreview}
        isUploading={uploadingField === 'imagenPrincipal'}
        label="Color de la foto principal"
        onColorChange={(_, color) => onPrimaryImageColorChange(color)}
        onRemoveImage={() => onRemovePrimaryImage()}
        selectedColors={[form.imagenPrincipalColor]}
      />

      <label className="field-group">
        <span className="field-label">Tallas</span>
        <input
          className="text-input"
          name="tallas"
          onChange={onInputChange}
          placeholder="CH, M, G"
          value={form.tallas}
        />
      </label>

      <ChoiceAddField
        description="Agrega los colores del producto aqui. Despues podras usarlos en las fotos sin volver a escribirlos."
        label="Colores"
        onAdd={onColorAdd}
        onColorHexChange={onColorHexChange}
        onRemove={onColorRemove}
        selectedValues={form.coloresDetalle}
        suggestions={suggestedProductColors}
      />

      <label className="field-group field-group--full">
        <span className="field-label">Descripcion</span>
        <textarea
          className="text-area"
          name="descripcion"
          onChange={onInputChange}
          required
          value={form.descripcion}
        />
      </label>

      <ImageDropzone
        description="Sube varias fotos secundarias o arrastralas al area para agregarlas a la galeria y relacionarlas por color en el bloque inferior."
        images={secondaryPreview}
        isUploading={uploadingField === 'imagenes'}
        label="Imagenes secundarias"
        multiple
        onFilesSelected={(files) => onImageUpload('imagenes', files)}
      />

      <ImageColorRelationEditor
        colorOptions={colorOptions}
        description="Relaciona cada foto con un color existente de la paleta para ordenar mejor la galeria."
        images={secondaryPreview}
        isUploading={uploadingField === 'imagenes'}
        label="Relacion foto-color"
        onColorChange={onSecondaryImageColorChange}
        onRemoveImage={onRemoveSecondaryImage}
        selectedColors={form.imagenesPorColor.map((image) => image.color)}
      />

      <label className="checkbox-row field-group--full">
        <input
          checked={form.activo}
          name="activo"
          onChange={onInputChange}
          type="checkbox"
        />
        <span>Producto activo y visible en el catálogo</span>
      </label>
    </div>
  )
}

const ProductosAdminPage = ({ mode }: ProductosAdminPageProps) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProductParam = searchParams.get('productoId')
  const [productos, setProductos] = useState<Producto[]>([])
  const [createForm, setCreateForm] = useState<ProductoFormState>(createEmptyFormState)
  const [editForm, setEditForm] = useState<ProductoFormState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [createSaving, setCreateSaving] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [createUploadingField, setCreateUploadingField] =
    useState<ProductoImageField | null>(null)
  const [editUploadingField, setEditUploadingField] =
    useState<ProductoImageField | null>(null)
  const [createPreviewState, setCreatePreviewState] = useState<UploadPreviewState>(
    createEmptyPreviewState,
  )
  const [editPreviewState, setEditPreviewState] = useState<UploadPreviewState>(
    createEmptyPreviewState,
  )
  const createFormRef = useRef(createForm)
  const editFormRef = useRef(editForm)
  const createPreviewRef = useRef(createPreviewState)
  const editPreviewRef = useRef(editPreviewState)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deferredProductSearch = useDeferredValue(productSearch)
  const brandSuggestions = useMemo(
    () => sortUniqueLabels(productos.map((producto) => producto.marca)),
    [productos],
  )
  const filteredProductos = useMemo(() => {
    const searchTokens = normalizeSearchTokens(deferredProductSearch)

    if (searchTokens.length === 0) {
      return productos
    }

    return productos.filter((producto) => {
      const searchableText = [
        producto.nombre,
        producto.descripcion,
        producto.marca,
        producto.categoria,
        ...producto.categorias,
        ...producto.tallas,
        ...producto.colores,
        producto.imagenPrincipalColor ?? '',
        ...producto.imagenesPorColor.map((image) => image.color ?? ''),
      ]
        .join(' ')
        .toLowerCase()

      return searchTokens.every((token) => searchableText.includes(token))
    })
  }, [deferredProductSearch, productos])

  useEffect(() => {
    createFormRef.current = createForm
  }, [createForm])

  useEffect(() => {
    editFormRef.current = editForm
  }, [editForm])

  useEffect(() => {
    createPreviewRef.current = createPreviewState
  }, [createPreviewState])

  useEffect(() => {
    editPreviewRef.current = editPreviewState
  }, [editPreviewState])

  useEffect(() => {
    return () => {
      clearPreviewState(createPreviewRef.current)
      clearPreviewState(editPreviewRef.current)
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadProductos = async () => {
      try {
        setLoading(true)
        const response = await getProductos()

        if (!active) {
          return
        }

        setProductos(response)
        setError(null)

        if (mode !== 'editar') {
          return
        }

        if (!selectedProductParam) {
          return
        }

        const selectedId = Number(selectedProductParam)

        if (Number.isNaN(selectedId)) {
          return
        }

        const selectedProduct = response.find((producto) => producto.id === selectedId)

        if (!selectedProduct) {
          return
        }

        setEditingId(selectedProduct.id)
        setEditForm(mapProductoToForm(selectedProduct))
      } catch (requestError) {
        if (active) {
          setError(
            getApiErrorMessage(
              requestError,
              'No fue posible cargar la administracion de productos.',
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
  }, [mode, selectedProductParam])

  const resetCreateForm = () => {
    setCreateForm(createEmptyFormState())
    setCreatePreviewState((current) => clearPreviewState(current))
  }

  const resetEditForm = useCallback(() => {
    setEditingId(null)
    setEditForm(null)
    setEditPreviewState((current) => clearPreviewState(current))

    if (searchParams.has('productoId')) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('productoId')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (mode !== 'editar' || !editingId) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || editSaving || editUploadingField !== null) {
        return
      }

      resetEditForm()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    editSaving,
    editUploadingField,
    editingId,
    mode,
    resetEditForm,
    searchParams,
    setSearchParams,
  ])

  const toggleCategory = (categorias: string[], categoria: string) => {
    if (categorias.includes(categoria)) {
      return categorias.filter((currentCategoria) => currentCategoria !== categoria)
    }

    return [...categorias, categoria]
  }

  const handleCreateCategoryToggle = (categoria: string) => {
    setCreateForm((current) => ({
      ...current,
      categorias: toggleCategory(current.categorias, categoria),
    }))
  }

  const handleEditCategoryToggle = (categoria: string) => {
    setEditForm((current) =>
      current
        ? {
            ...current,
            categorias: toggleCategory(current.categorias, categoria),
          }
        : current,
    )
  }

  const handleCreateColorAdd = (payload: ProductoColorFormState) => {
    setCreateForm((current) =>
      syncFormPalette(current, upsertPaletteColor(current.coloresDetalle, payload)),
    )
  }

  const handleCreateColorHexChange = (color: string, colorHex: string) => {
    setCreateForm((current) =>
      syncFormPalette(
        current,
        upsertPaletteColor(current.coloresDetalle, {
          nombre: color,
          colorHex,
        }),
      ),
    )
  }

  const handleCreateColorRemove = (color: string) => {
    setCreateForm((current) =>
      syncFormPalette(current, removePaletteColor(current.coloresDetalle, color)),
    )
  }

  const handleEditColorAdd = (payload: ProductoColorFormState) => {
    setEditForm((current) =>
      current
        ? syncFormPalette(
            current,
            upsertPaletteColor(current.coloresDetalle, payload),
          )
        : current,
    )
  }

  const handleEditColorHexChange = (color: string, colorHex: string) => {
    setEditForm((current) =>
      current
        ? syncFormPalette(
            current,
            upsertPaletteColor(current.coloresDetalle, {
              nombre: color,
              colorHex,
            }),
          )
        : current,
    )
  }

  const handleEditColorRemove = (color: string) => {
    setEditForm((current) =>
      current
        ? syncFormPalette(
            current,
            removePaletteColor(current.coloresDetalle, color),
          )
        : current,
    )
  }

  const handleCreatePrimaryImageColorChange = (color: string) => {
    setCreateForm((current) => ({
      ...current,
      imagenPrincipalColor: color,
      imagenPrincipalColorHex:
        findColorHex(current.coloresDetalle, color) ?? '#d2c8bc',
    }))
  }

  const handleEditPrimaryImageColorChange = (color: string) => {
    setEditForm((current) =>
      current
        ? {
            ...current,
            imagenPrincipalColor: color,
            imagenPrincipalColorHex:
              findColorHex(current.coloresDetalle, color) ?? '#d2c8bc',
          }
        : current,
    )
  }

  const handleCreateSecondaryImageColorChange = (index: number, color: string) => {
    setCreateForm((current) => ({
      ...current,
      imagenesPorColor: current.imagenesPorColor.map((image, imageIndex) =>
        imageIndex === index
          ? {
              ...image,
              color,
              colorHex: findColorHex(current.coloresDetalle, color) ?? '#d2c8bc',
            }
          : image,
      ),
    }))
  }

  const handleEditSecondaryImageColorChange = (index: number, color: string) => {
    setEditForm((current) =>
      current
        ? {
            ...current,
            imagenesPorColor: current.imagenesPorColor.map((image, imageIndex) =>
              imageIndex === index
                ? {
                    ...image,
                    color,
                    colorHex:
                      findColorHex(current.coloresDetalle, color) ?? '#d2c8bc',
                  }
                : image,
            ),
          }
        : current,
    )
  }

  const handleCreateInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = event.target
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value

    setCreateForm((current) => ({
      ...current,
      [target.name]: value,
    }))
  }

  const handleCreateBrandChange = (value: string) => {
    setCreateForm((current) => ({
      ...current,
      marca: value,
    }))
  }

  const handleEditInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = event.target
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value

    setEditForm((current) =>
      current
        ? {
            ...current,
            [target.name]: value,
          }
        : current,
    )
  }

  const handleEditBrandChange = (value: string) => {
    setEditForm((current) =>
      current
        ? {
            ...current,
            marca: value,
          }
        : current,
    )
  }

  const selectProductForEdit = (producto: Producto) => {
    setEditingId(producto.id)
    setEditForm(mapProductoToForm(producto))
    setEditPreviewState((current) => clearPreviewState(current))
    setFeedback(null)
    setError(null)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('productoId', String(producto.id))
    setSearchParams(nextParams, { replace: true })
  }

  const handleEditIntent = (producto: Producto) => {
    if (mode === 'editar') {
      selectProductForEdit(producto)
      return
    }

    navigate(`/admin/productos/editar?productoId=${producto.id}`)
  }

  const handleDelete = async (producto: Producto) => {
    const confirmed = window.confirm(
      `Eliminar "${producto.nombre}" del catálogo?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await deleteProducto(producto.id)
      setProductos((current) =>
        current.filter((currentProducto) => currentProducto.id !== producto.id),
      )
      setFeedback(`"${producto.nombre}" fue eliminado.`)
      setError(null)

      if (editingId === producto.id) {
        resetEditForm()
      }
    } catch (requestError) {
      const messages = await showRequestErrorAlert(
        'No se pudo eliminar el producto',
        requestError,
        'No fue posible eliminar el producto seleccionado.',
      )

      setFeedback(null)
      setError(messages.join(' '))
    }
  }

  const handleCreateImageUpload = async (
    field: ProductoImageField,
    files: File[],
  ) => {
    const filesToUpload = field === 'imagenPrincipal' ? files.slice(0, 1) : files

    if (filesToUpload.length === 0) {
      return
    }

    setCreatePreviewState((current) =>
      replacePreviewField(current, field, createObjectPreviewUrls(filesToUpload)),
    )

    try {
      setCreateUploadingField(field)
      const uploadedImages = await uploadProductoImages(filesToUpload)
      const nextForm = applyUploadedImagesToForm(
        createFormRef.current,
        field,
        uploadedImages,
      )

      setCreateForm(nextForm)
      setCreatePreviewState((current) =>
        replacePreviewField(current, field, syncPreviewWithForm(nextForm, field)),
      )
      setError(null)
    } catch (requestError) {
      const messages = await showRequestErrorAlert(
        'No se pudieron subir las imagenes',
        requestError,
        'No fue posible subir las imagenes seleccionadas.',
      )

      setFeedback(null)
      setError(messages.join(' '))
    } finally {
      setCreateUploadingField(null)
    }
  }

  const handleEditImageUpload = async (
    field: ProductoImageField,
    files: File[],
  ) => {
    const filesToUpload = field === 'imagenPrincipal' ? files.slice(0, 1) : files

    if (filesToUpload.length === 0 || !editForm) {
      return
    }

    setEditPreviewState((current) =>
      replacePreviewField(current, field, createObjectPreviewUrls(filesToUpload)),
    )

    try {
      setEditUploadingField(field)
      const uploadedImages = await uploadProductoImages(filesToUpload)
      const currentForm = editFormRef.current

      if (!currentForm) {
        return
      }

      const nextForm = applyUploadedImagesToForm(
        currentForm,
        field,
        uploadedImages,
      )

      setEditForm(nextForm)
      setEditPreviewState((current) =>
        replacePreviewField(current, field, syncPreviewWithForm(nextForm, field)),
      )
      setError(null)
    } catch (requestError) {
      const messages = await showRequestErrorAlert(
        'No se pudieron subir las imagenes',
        requestError,
        'No fue posible subir las imagenes seleccionadas.',
      )

      setFeedback(null)
      setError(messages.join(' '))
    } finally {
      setEditUploadingField(null)
    }
  }

  const handleCreatePrimaryImageRemove = () => {
    setCreateForm((current) => removePrimaryImageFromForm(current))
    setCreatePreviewState((current) =>
      removePreviewImageFromState(current, 'imagenPrincipal'),
    )
  }

  const handleCreateSecondaryImageRemove = (index: number) => {
    setCreateForm((current) => removeSecondaryImageFromForm(current, index))
    setCreatePreviewState((current) =>
      removePreviewImageFromState(current, 'imagenes', index),
    )
  }

  const handleEditPrimaryImageRemove = () => {
    setEditForm((current) => (current ? removePrimaryImageFromForm(current) : current))
    setEditPreviewState((current) =>
      removePreviewImageFromState(current, 'imagenPrincipal'),
    )
  }

  const handleEditSecondaryImageRemove = (index: number) => {
    setEditForm((current) =>
      current ? removeSecondaryImageFromForm(current, index) : current,
    )
    setEditPreviewState((current) =>
      removePreviewImageFromState(current, 'imagenes', index),
    )
  }

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (createForm.categorias.length === 0) {
      setFeedback(null)
      setError('Selecciona al menos una categoria para crear el producto.')
      await Swal.fire({
        icon: 'warning',
        title: 'Falta una categoria',
        text: 'Elige una o varias categorias antes de crear el producto.',
        confirmButtonText: 'Entendido',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
      return
    }

    try {
      setCreateSaving(true)
      const created = await createProducto(buildPayload(createForm))

      setProductos((current) => [created, ...current])
      setFeedback(null)
      setError(null)
      resetCreateForm()
      await Swal.fire({
        icon: 'success',
        title: 'Producto creado',
        text: `${created.nombre} se creo correctamente.`,
        confirmButtonText: 'Continuar',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
    } catch (requestError) {
      const messages = await showRequestErrorAlert(
        'No se pudo crear el producto',
        requestError,
        'No fue posible crear el producto. Revisa los datos del formulario.',
      )

      setFeedback(null)
      setError(messages.join(' '))
    } finally {
      setCreateSaving(false)
    }
  }

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingId || !editForm) {
      return
    }

    if (editForm.categorias.length === 0) {
      setFeedback(null)
      setError('Selecciona al menos una categoria para guardar el producto.')
      await Swal.fire({
        icon: 'warning',
        title: 'Falta una categoria',
        text: 'Elige una o varias categorias antes de actualizar el producto.',
        confirmButtonText: 'Entendido',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
      return
    }

    try {
      setEditSaving(true)
      const updated = await updateProducto(editingId, buildPayload(editForm))

      setProductos((current) =>
        current.map((producto) =>
          producto.id === updated.id ? updated : producto,
        ),
      )
      setFeedback(null)
      setError(null)
      await Swal.fire({
        icon: 'success',
        title: 'Producto actualizado',
        text: `${updated.nombre} se actualizo correctamente.`,
        confirmButtonText: 'Continuar',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
      resetEditForm()
    } catch (requestError) {
      const messages = await showRequestErrorAlert(
        'No se pudo guardar la edicion',
        requestError,
        'No fue posible guardar los cambios del producto.',
      )

      setFeedback(null)
      setError(messages.join(' '))
    } finally {
      setEditSaving(false)
    }
  }

  const isCreateUploading = createUploadingField !== null
  const isEditUploading = editUploadingField !== null
  const pageTitle = mode === 'crear' ? 'Crear productos' : 'Editar productos'
  return (
    <div className="content-stack">
      <section className="section-heading section-heading--admin-products">
        <div className="admin-heading-top">
          <div className="admin-heading-copy">
            <h2>{pageTitle}</h2>
          </div>
          {mode === 'editar' ? (
            <div className="admin-toolbar-meta">
              <span className="small-label">
                {loading
                  ? 'Actualizando...'
                  : `${filteredProductos.length} de ${productos.length} visibles`}
              </span>
              <button
                className="status-chip status-chip--action"
                onClick={() => navigate('/')}
                type="button"
              >
                Ver catálogo
              </button>
            </div>
          ) : (
            <div className="admin-toolbar-meta">
              <span className="status-chip is-active">Modulo de alta</span>
            </div>
          )}
        </div>

        {mode === 'editar' ? (
          <label className="admin-search-bar">
            <span aria-hidden="true" className="admin-search-bar__icon" />
            <input
              aria-label="Buscar producto"
              className="admin-search-bar__input"
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Busca por nombre, marca, color o talla"
              type="search"
              value={productSearch}
            />
          </label>
        ) : null}
      </section>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {feedback ? <div className="alert alert--success">{feedback}</div> : null}

      <section className="admin-products-workspace admin-products-workspace--create">
        <article
          className={`admin-card admin-card--editor-shell${
            mode === 'editar' ? ' admin-card--hidden' : ''
          }`}
        >
          {mode === 'crear' ? (
            <>
              <div className="section-heading">
                <div>
                  <h2>Crear producto</h2>
                  <span className="small-label">Alta independiente</span>
                </div>
              </div>

              <p className="admin-form-caption">
                Organiza la ficha con categorias multiples, fotos compactas y
                relaciones visuales por color desde un mismo formulario.
              </p>

              <form
                className="product-form product-form--compact"
                onSubmit={handleCreateSubmit}
              >
                <ProductoFormFields
                  brandSuggestions={brandSuggestions}
                  form={createForm}
                  onBrandChange={handleCreateBrandChange}
                  onCategoryToggle={handleCreateCategoryToggle}
                  onColorAdd={handleCreateColorAdd}
                  onColorHexChange={handleCreateColorHexChange}
                  onColorRemove={handleCreateColorRemove}
                  onImageUpload={handleCreateImageUpload}
                  onPrimaryImageColorChange={handleCreatePrimaryImageColorChange}
                  onInputChange={handleCreateInputChange}
                  onRemovePrimaryImage={handleCreatePrimaryImageRemove}
                  onRemoveSecondaryImage={handleCreateSecondaryImageRemove}
                  onSecondaryImageColorChange={handleCreateSecondaryImageColorChange}
                  previewState={createPreviewState}
                  uploadingField={createUploadingField}
                />

                <div className="inline-actions">
                  <button
                    className="button button--primary"
                    disabled={createSaving || isCreateUploading}
                    type="submit"
                  >
                    {createSaving
                      ? 'Creando...'
                      : isCreateUploading
                        ? 'Subiendo imagenes...'
                        : 'Crear producto'}
                  </button>
                  <button
                    className="button button--ghost"
                    disabled={createSaving || isCreateUploading}
                    onClick={resetCreateForm}
                    type="button"
                  >
                    Limpiar formulario
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>Editar producto</h2>
                  <span className="small-label">
                    {editingId ? `Producto #${editingId}` : 'Esperando seleccion'}
                  </span>
                </div>
                {editingId ? (
                  <button
                    className="button button--ghost"
                    disabled={editSaving || isEditUploading}
                    onClick={resetEditForm}
                    type="button"
                  >
                    Salir de edicion
                  </button>
                ) : null}
              </div>

              {!editForm || !editingId ? (
                <div className="empty-state">
                  Elige un producto del listado para cargarlo aqui en el editor.
                </div>
              ) : (
                <>
                  <p className="admin-form-caption">
                    Este modulo solo toca productos existentes y deja la creacion
                    aislada en su propia ruta del panel.
                  </p>

                  <form
                    className="product-form product-form--compact"
                    onSubmit={handleEditSubmit}
                  >
                    <ProductoFormFields
                      brandSuggestions={brandSuggestions}
                      form={editForm}
                      onBrandChange={handleEditBrandChange}
                      onCategoryToggle={handleEditCategoryToggle}
                      onColorAdd={handleEditColorAdd}
                      onColorHexChange={handleEditColorHexChange}
                      onColorRemove={handleEditColorRemove}
                      onImageUpload={handleEditImageUpload}
                      onPrimaryImageColorChange={handleEditPrimaryImageColorChange}
                      onInputChange={handleEditInputChange}
                      onRemovePrimaryImage={handleEditPrimaryImageRemove}
                      onRemoveSecondaryImage={handleEditSecondaryImageRemove}
                      onSecondaryImageColorChange={handleEditSecondaryImageColorChange}
                      previewState={editPreviewState}
                      uploadingField={editUploadingField}
                    />

                    <div className="inline-actions">
                      <button
                        className="button button--primary"
                        disabled={editSaving || isEditUploading}
                        type="submit"
                      >
                        {editSaving
                          ? 'Guardando...'
                          : isEditUploading
                            ? 'Subiendo imagenes...'
                            : 'Guardar cambios'}
                      </button>
                      <button
                        className="button button--ghost"
                        disabled={editSaving || isEditUploading}
                        onClick={resetEditForm}
                        type="button"
                      >
                        Cancelar edicion
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </article>

        {mode === 'editar' ? (
          <article className="admin-card">
            {loading ? (
              <div className="loading-grid">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="skeleton-card" key={index} />
                ))}
              </div>
            ) : productos.length === 0 ? (
              <div className="empty-state">
                No hay productos registrados todavia.
              </div>
            ) : filteredProductos.length === 0 ? (
              <div className="empty-state">
                No encontramos coincidencias para "{productSearch.trim()}".
              </div>
            ) : (
              <div className="product-list">
                {filteredProductos.map((producto) => (
                  <div className="admin-product-card" key={producto.id}>
                    <AdminProductMedia
                      alt={producto.nombre}
                      src={producto.imagenPrincipal}
                    />

                    <div>
                      <div className="catalog-footer">
                        <div>
                          <p className="small-label">
                            ID #{producto.id} ·{' '}
                            {getProductCategoryLabel(
                              getProductoCategorias(producto)[0] ?? producto.categoria,
                            )}
                          </p>
                          <h3 className="catalog-name">{producto.nombre}</h3>
                        </div>
                        <span
                          className={`status-chip ${
                            producto.activo ? 'is-active' : 'is-inactive'
                          }`}
                        >
                          {producto.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <p className="catalog-description">{producto.descripcion}</p>

                      <div className="admin-product-meta">
                        {getProductoCategorias(producto).map((categoria) => (
                          <span className="meta-chip" key={`${producto.id}-${categoria}`}>
                            {getProductCategoryLabel(categoria)}
                          </span>
                        ))}
                        <span className="meta-chip">{producto.marca}</span>
                        <span className="meta-chip">
                          {formatPrecio(producto.precio)}
                        </span>
                        <span className="meta-chip">
                          {producto.existencia} en inventario
                        </span>
                      </div>

                      <div className="admin-product-actions">
                        <button
                          className="button button--secondary"
                          onClick={() => handleEditIntent(producto)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="button button--danger"
                          onClick={() => void handleDelete(producto)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ) : null}

        {mode === 'editar' && editForm && editingId ? (
          <AdminModal
            onClose={resetEditForm}
            subtitle={`Producto #${editingId} · Ajusta fotos, colores y categorias sin salir del catálogo.`}
            title="Editar producto"
            footer={
              <div className="inline-actions">
                <button
                  className="button button--primary"
                  disabled={editSaving || isEditUploading}
                  form="edit-product-form"
                  type="submit"
                >
                  {editSaving
                    ? 'Guardando...'
                    : isEditUploading
                      ? 'Subiendo imagenes...'
                      : 'Guardar cambios'}
                </button>
                <button
                  className="button button--ghost"
                  disabled={editSaving || isEditUploading}
                  onClick={resetEditForm}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            }
          >
            <form
              className="product-form product-form--compact"
              id="edit-product-form"
              onSubmit={handleEditSubmit}
            >
              <ProductoFormFields
                brandSuggestions={brandSuggestions}
                form={editForm}
                onBrandChange={handleEditBrandChange}
                onCategoryToggle={handleEditCategoryToggle}
                onColorAdd={handleEditColorAdd}
                onColorHexChange={handleEditColorHexChange}
                onColorRemove={handleEditColorRemove}
                onImageUpload={handleEditImageUpload}
                onPrimaryImageColorChange={handleEditPrimaryImageColorChange}
                onInputChange={handleEditInputChange}
                onRemovePrimaryImage={handleEditPrimaryImageRemove}
                onRemoveSecondaryImage={handleEditSecondaryImageRemove}
                onSecondaryImageColorChange={handleEditSecondaryImageColorChange}
                previewState={editPreviewState}
                uploadingField={editUploadingField}
              />
            </form>
          </AdminModal>
        ) : null}
      </section>
    </div>
  )
}

export const ProductosCrearPage = () => <ProductosAdminPage mode="crear" />

export const ProductosEditarPage = () => <ProductosAdminPage mode="editar" />

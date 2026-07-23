import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useAuth } from '../../auth/AuthContext'
import { getApiErrorMessage } from '../../api/api'
import {
  createUsuario,
  getUsuarios,
  updateUsuarioPassword,
  type UsuarioAdmin,
} from '../../services/usuarios.service'

interface UsuarioFormState {
  nombre: string
  email: string
  password: string
}

interface PasswordResetFormState {
  password: string
  confirmPassword: string
}

const createEmptyFormState = (): UsuarioFormState => ({
  nombre: '',
  email: '',
  password: '',
})

const createEmptyPasswordResetFormState = (): PasswordResetFormState => ({
  password: '',
  confirmPassword: '',
})

const formatUserDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

export const UsuariosAdminPage = () => {
  const { isSuperUser } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [form, setForm] = useState<UsuarioFormState>(createEmptyFormState)
  const [passwordForm, setPasswordForm] = useState<PasswordResetFormState>(
    createEmptyPasswordResetFormState,
  )
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<number | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperUser) {
      return
    }

    let active = true

    const loadUsuarios = async () => {
      try {
        setLoading(true)
        const response = await getUsuarios()

        if (active) {
          setUsuarios(response)
          setError(null)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getApiErrorMessage(
              requestError,
              'No fue posible cargar los usuarios del panel.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadUsuarios()

    return () => {
      active = false
    }
  }, [isSuperUser])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setForm(createEmptyFormState())
  }

  const resetPasswordForm = () => {
    setPasswordForm(createEmptyPasswordResetFormState())
    setEditingPasswordUserId(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSuperUser) {
      setError('Solo el superusuario puede crear o administrar cuentas.')
      return
    }

    try {
      setSaving(true)
      const created = await createUsuario({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      setUsuarios((current) => [created, ...current])
      setError(null)
      resetForm()
      await Swal.fire({
        icon: 'success',
        title: 'Usuario creado',
        text: `${created.nombre} ya puede iniciar sesion.`,
        confirmButtonText: 'Continuar',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible crear el usuario del panel.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = event.target

    setPasswordForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleOpenPasswordEditor = (usuarioId: number) => {
    setError(null)
    setEditingPasswordUserId((current) => (current === usuarioId ? null : usuarioId))
    setPasswordForm(createEmptyPasswordResetFormState())
  }

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    usuario: UsuarioAdmin,
  ) => {
    event.preventDefault()

    if (!isSuperUser) {
      setError('Solo el superusuario puede crear o administrar cuentas.')
      return
    }

    if (passwordForm.password.length < 8) {
      setError('La nueva contrasena debe tener al menos 8 caracteres.')
      return
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('La confirmacion de la contrasena no coincide.')
      return
    }

    try {
      setSavingPassword(true)
      const updated = await updateUsuarioPassword(usuario.id, {
        password: passwordForm.password,
      })

      setUsuarios((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setError(null)
      resetPasswordForm()
      await Swal.fire({
        icon: 'success',
        title: 'Contrasena actualizada',
        text: `La cuenta de ${updated.nombre} ya tiene una nueva contrasena.`,
        confirmButtonText: 'Continuar',
        background: '#fffdf9',
        confirmButtonColor: '#1d1a17',
      })
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible actualizar la contrasena del usuario.',
        ),
      )
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="content-stack">
      <section className="section-heading">
        <div>
          <h2>Usuarios</h2>
          <p>
            Administra los accesos del panel. El primer usuario queda como
            superusuario y desde este modulo puede crear cuentas adicionales con
            permisos limitados.
          </p>
        </div>
        <div className="admin-toolbar-meta">
          <span className="status-chip is-active">Acceso protegido</span>
          <span className="small-label">{usuarios.length} registrados</span>
        </div>
      </section>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {!isSuperUser ? (
        <div className="empty-state">
          Esta cuenta no tiene permisos de superusuario. Puedes iniciar sesion,
          crear y editar productos, pero la administracion de usuarios esta
          reservada al primer acceso.
        </div>
      ) : null}

      {isSuperUser ? (
        <section className="admin-users-workspace">
          <article className="admin-card admin-card--sticky">
            <div className="section-heading">
              <div>
                <h2>Crear usuario</h2>
                <span className="small-label">Alta de usuarios del panel</span>
              </div>
            </div>

            <p className="admin-form-caption">
              Crea nuevos accesos con correo y contrasena para que mas personas
              puedan entrar al back office sin otorgarles permisos de
              superusuario.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="field-group">
                <span className="field-label">Nombre</span>
                <input
                  className="text-input"
                  name="nombre"
                  onChange={handleInputChange}
                  placeholder="Nombre del usuario"
                  required
                  value={form.nombre}
                />
              </label>

              <label className="field-group">
                <span className="field-label">Email</span>
                <input
                  className="text-input"
                  name="email"
                  onChange={handleInputChange}
                  placeholder="equipo@noirblanc.com"
                  required
                  type="email"
                  value={form.email}
                />
              </label>

              <label className="field-group">
                <span className="field-label">Password</span>
                <input
                  className="text-input"
                  minLength={8}
                  name="password"
                  onChange={handleInputChange}
                  placeholder="Minimo 8 caracteres"
                  required
                  type="password"
                  value={form.password}
                />
              </label>

              <div className="inline-actions">
                <button
                  className="button button--primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? 'Creando...' : 'Crear usuario'}
                </button>
                <button
                  className="button button--ghost"
                  disabled={saving}
                  onClick={resetForm}
                  type="button"
                >
                  Limpiar formulario
                </button>
              </div>
            </form>
          </article>

          <article className="admin-card">
            <div className="section-heading">
              <div>
                <h2>Accesos activos</h2>
                <p className="admin-form-caption">
                  Listado de usuarios validos
                </p>
              </div>
              <span className="small-label">
                {loading ? 'Actualizando...' : 'Sincronizado con API'}
              </span>
            </div>

            {loading ? (
              <div className="loading-grid">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="skeleton-card" key={index} />
                ))}
              </div>
            ) : usuarios.length === 0 ? (
              <div className="empty-state">
                Todavia no hay usuarios registrados en este entorno.
              </div>
            ) : (
              <div className="user-list">
                {usuarios.map((usuario) => (
                  <article className="admin-user-card" key={usuario.id}>
                    <div className="catalog-footer">
                      <div>
                        <p className="small-label">{usuario.rol}</p>
                        <h3 className="catalog-name">{usuario.nombre}</h3>
                      </div>
                      <span
                        className={`status-chip ${
                          usuario.activo ? 'is-active' : 'is-inactive'
                        }`}
                      >
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <p className="catalog-description">{usuario.email}</p>

                    <div className="admin-user-meta">
                      <span className="meta-chip">ID {usuario.id}</span>
                      <span className="meta-chip">
                        Alta {formatUserDate(usuario.createdAt)}
                      </span>
                      <span className="meta-chip">
                        Actualizado {formatUserDate(usuario.updatedAt)}
                      </span>
                    </div>

                    <div className="admin-user-actions">
                      <button
                        className="button button--secondary"
                        disabled={savingPassword}
                        onClick={() => handleOpenPasswordEditor(usuario.id)}
                        type="button"
                      >
                        {editingPasswordUserId === usuario.id
                          ? 'Cancelar cambio'
                          : 'Cambiar contrasena'}
                      </button>
                    </div>

                    {editingPasswordUserId === usuario.id ? (
                      <div className="admin-user-password-panel">
                        <p className="admin-form-caption">
                          Define una nueva contrasena para este acceso del panel.
                        </p>

                        <form
                          className="auth-form"
                          onSubmit={(event) => void handlePasswordSubmit(event, usuario)}
                        >
                          <div className="form-grid">
                            <label className="field-group">
                              <span className="field-label">Nueva contrasena</span>
                              <input
                                className="text-input"
                                minLength={8}
                                name="password"
                                onChange={handlePasswordInputChange}
                                placeholder="Minimo 8 caracteres"
                                required
                                type="password"
                                value={passwordForm.password}
                              />
                            </label>

                            <label className="field-group">
                              <span className="field-label">
                                Confirmar contrasena
                              </span>
                              <input
                                className="text-input"
                                minLength={8}
                                name="confirmPassword"
                                onChange={handlePasswordInputChange}
                                placeholder="Repite la nueva contrasena"
                                required
                                type="password"
                                value={passwordForm.confirmPassword}
                              />
                            </label>
                          </div>

                          <div className="inline-actions">
                            <button
                              className="button button--primary"
                              disabled={savingPassword}
                              type="submit"
                            >
                              {savingPassword ? 'Guardando...' : 'Guardar contrasena'}
                            </button>
                            <button
                              className="button button--ghost"
                              disabled={savingPassword}
                              onClick={resetPasswordForm}
                              type="button"
                            >
                              Cerrar
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}
    </div>
  )
}

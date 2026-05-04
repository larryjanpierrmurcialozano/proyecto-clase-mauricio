Proyecto: DropSport - Sistema de Inventario Deportivo

Descripción:
Sistema web completo para gestionar inventario, préstamos, tickets de seguimiento y reportes de artículos deportivos. Incluye backend Flask con MySQL (configurable por entorno), autenticación por token, control de roles y seguimiento del estado físico de los productos.

Funcionalidades principales:
- CRUD completo de activos (artículos deportivos)
- Seguimiento de estado físico del producto (bueno / regular / deterioro)
- Sistema de préstamos con registro de condición al prestar
- Devolución con reporte de estado y creación automática de ticket
- Sistema de tickets (abierto → en proceso → cerrado)
- Creación manual de tickets de incidencia
- Reportes y estadísticas con gráficos (Chart.js)
- Roles: administrador, empleado, cliente
- Tema claro/oscuro

Estructura del proyecto:
```
├── backend/
│   ├── server.py          # Backend Flask (API REST + modelos SQLAlchemy)
│   ├── requirements.txt   # Dependencias Python
│   ├── check_db.py         # Verifica tablas/columnas
│   ├── fix_db.py           # Inicializa/actualiza BD
│   ├── migrate_sqlite_to_mysql.py  # Migracion SQLite -> MySQL
│   └── app.db              # SQLite (opcional en desarrollo)
├── frontend/
│   ├── index.html          # Página de inicio (landing page)
│   ├── login.html          # Inicio de sesión
│   ├── register.html       # Registro de usuarios
│   ├── dashboard.html      # Panel principal de administración
│   ├── cliente.html        # Vista cliente
│   ├── app.js              # Lógica admin
│   ├── cliente.js          # Lógica cliente
│   ├── styles.css          # Estilos CSS
│   └── logo.svg
├── docs/
│   ├── README.md           # Este archivo
│   ├── INSTALL.md          # Guía de instalación y despliegue en Linux
│   ├── db.md
│   ├── dumb.sql
│   └── usuarios de prueba.md
└── uploads/                # Imágenes subidas
```

Ejecución rápida:
1. Crear y activar un entorno virtual (recomendado):
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

2. Instalar dependencias:
```bash
pip install -r backend/requirements.txt
```

3. Ejecutar el servidor:
```bash
python backend/server.py
```

4. Abrir `http://127.0.0.1:5000` en el navegador.

Para despliegue en Linux: ver `docs/INSTALL.md`

Base de datos y credenciales iniciales:
- El servidor usa MySQL por defecto (con `DB_DRIVER=mysql`) y toma SQLite (`backend/app.db`) solo si cambias `DB_DRIVER=sqlite`.
- El usuario administrador se crea solo si defines variables de entorno antes del primer arranque:
	- `ADMIN_EMAIL`
	- `ADMIN_PASSWORD`
	- (opcional) `ADMIN_NAME`
	Si no defines esas variables, no se crea admin automaticamente.
Configuracion MySQL (recomendado):
- Crear la base de datos en MySQL (ej: `mauricio`).
- Definir variables de entorno antes de iniciar el servidor.

Ejemplo (PowerShell):
```powershell
$env:DB_DRIVER = "mysql"
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DB = "mauricio"
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = "tu_contrasena"
$env:ADMIN_EMAIL = "admin@tuapp.com"
$env:ADMIN_PASSWORD = "tu_clave_segura"
$env:ADMIN_NAME = "Admin"
python backend/server.py
```

Ejemplo con URL completa:
```powershell
$env:DATABASE_URL = "mysql+pymysql://root:tu_contrasena@127.0.0.1:3306/mauricio?charset=utf8mb4"
python backend/server.py
```

Migracion desde SQLite a MySQL:
1. Configura MySQL (variables de entorno).
2. Ejecuta el script de migracion:

```powershell
$env:DB_DRIVER = "mysql"
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DB = "mauricio"
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = "tu_contrasena"
$env:SQLITE_PATH = "backend/app.db"
$env:SKIP_SEED = "1"
python backend/migrate_sqlite_to_mysql.py
```

Si la base de datos MySQL ya tiene datos y deseas sobrescribir:
```powershell
$env:MIGRATE_FORCE = "1"
python backend/migrate_sqlite_to_mysql.py
```

API (endpoints principales):

Autenticación:
- `POST /api/register` → {name, email, password, role}
- `POST /api/login` → {user, password}
- `GET /api/me` → info del usuario autenticado

Inventario (CRUD):
- `GET /api/inventory` → lista de artículos
- `POST /api/items` → {name, image, price, condition}
- `POST /api/items/<id>/name` → {name}
- `POST /api/items/<id>/price` → {price}
- `POST /api/items/<id>/status` → {status}
- `POST /api/items/<id>/condition` → {condition: bueno|regular|deterioro}
- `DELETE /api/items/<id>` → eliminar artículo

Préstamos:
- `GET /api/reservations` → lista de reservas
- `POST /api/loan` → {itemId, client, document, phone, from, to, price}
- `POST /api/return` → {itemId, condition, description}

Tickets:
- `GET /api/tickets` → lista de tickets (?status=abierto|en_proceso|cerrado)
- `POST /api/tickets` → {item_id, ticket_type, description, condition_before, condition_after}
- `POST /api/tickets/<id>/status` → {status: abierto|en_proceso|cerrado}
- `DELETE /api/tickets/<id>` → eliminar ticket

Operaciones masivas:
- `POST /api/items/bulk-update` → {ids[], price?, name?}
- `POST /api/items/price-all` → {price}

Notas:
- El frontend consume la API REST. Ejecuta el servidor para que todo funcione.
- Las imágenes se suben vía `POST /api/upload` y se sirven desde `/uploads/`.
- Los tickets se crean automáticamente al devolver un producto, o manualmente desde el panel.

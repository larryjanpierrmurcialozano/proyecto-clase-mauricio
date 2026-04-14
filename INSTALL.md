# Guía de Instalación y Despliegue en Linux — DropSport

## Requisitos Previos

- **Sistema Operativo:** Ubuntu 20.04+ / Debian 11+ (o cualquier distribución con Python 3.8+)
- **Python:** 3.8 o superior
- **pip:** gestor de paquetes de Python

## 1. Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Instalar Python y dependencias del sistema

```bash
sudo apt install -y python3 python3-pip python3-venv git
```

## 2.1 Instalar MySQL (recomendado)

```bash
sudo apt install -y mysql-server
```

Crear base de datos y usuario (ejemplo):

```bash
sudo mysql
CREATE DATABASE mauricio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dropsport'@'localhost' IDENTIFIED BY 'tu_contrasena';
GRANT ALL PRIVILEGES ON mauricio TO 'dropsport'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Clonar o copiar el proyecto

```bash
# Si usas git:
git clone <URL_DEL_REPOSITORIO> /opt/dropsport
cd /opt/dropsport

# O copiar manualmente los archivos al servidor:
# scp -r ./mauricio/* usuario@servidor:/opt/dropsport/
```

## 4. Crear entorno virtual

```bash
cd /opt/dropsport
python3 -m venv venv
source venv/bin/activate
```

## 5. Instalar dependencias de Python

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 6. Verificar que funciona

```bash
python server.py
```

Debería mostrar:
```
 * Running on http://127.0.0.1:5000
```

Accede desde el navegador a `http://<IP_DEL_SERVIDOR>:5000`

## 7. Despliegue en producción con Gunicorn

Para producción, no uses el servidor de desarrollo de Flask. Usa **Gunicorn**:

```bash
pip install gunicorn
```

### Ejecutar con Gunicorn

```bash
gunicorn --bind 0.0.0.0:5000 --workers 3 server:app
```

### Crear servicio systemd (arranque automático)

```bash
sudo nano /etc/systemd/system/dropsport.service
```

Pegar el siguiente contenido:

```ini
[Unit]
Description=DropSport - Sistema de Inventario Deportivo
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/dropsport
Environment="PATH=/opt/dropsport/venv/bin"
Environment="DB_DRIVER=mysql"
Environment="MYSQL_HOST=127.0.0.1"
Environment="MYSQL_PORT=3306"
Environment="MYSQL_DB=mauricio"
Environment="MYSQL_USER=dropsport"
Environment="MYSQL_PASSWORD=tu_contrasena"
ExecStart=/opt/dropsport/venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 3 server:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activar y arrancar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dropsport
sudo systemctl start dropsport
sudo systemctl status dropsport
```

## 8. Configurar Nginx como proxy inverso (opcional pero recomendado)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/dropsport
```

Contenido:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # o la IP del servidor

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /opt/dropsport/uploads/;
    }
}
```

Activar el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/dropsport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Firewall

Si usas `ufw`:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # si usas HTTPS
```

## 10. Permisos

Asegurar que el directorio de uploads y la base de datos sean escribibles:

```bash
sudo chown -R www-data:www-data /opt/dropsport
sudo chmod -R 755 /opt/dropsport
sudo chmod 775 /opt/dropsport/uploads
```

## Estructura del Proyecto

```
dropsport/
├── server.py          # Servidor Flask (API REST + modelos de BD)
├── app.js             # Frontend JavaScript (lógica de la UI)
├── styles.css         # Estilos CSS del sistema
├── dashboard.html     # Panel de administración
├── index.html         # Página de inicio (landing)
├── login.html         # Página de inicio de sesión
├── register.html      # Página de registro de usuarios
├── requirements.txt   # Dependencias de Python
├── README.md          # Documentación del proyecto
├── INSTALL.md         # Esta guía de instalación
├── app.db             # Base de datos SQLite (opcional)
└── uploads/           # Imágenes subidas por los usuarios
```

## Comandos Útiles

| Acción | Comando |
|--------|---------|
| Iniciar el servicio | `sudo systemctl start dropsport` |
| Detener el servicio | `sudo systemctl stop dropsport` |
| Reiniciar | `sudo systemctl restart dropsport` |
| Ver logs | `sudo journalctl -u dropsport -f` |
| Ver estado | `sudo systemctl status dropsport` |

## Credenciales por Defecto

- **Email:** larryjanpier@gmail.com
- **Contraseña:** 3202964025
- **Rol:** Administrador

> **Importante:** Cambia las credenciales del administrador en producción editando la función `seed()` en `server.py` antes del primer arranque.

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| Puerto 5000 en uso | `sudo lsof -i :5000` y matar el proceso, o cambiar el puerto en `server.py` |
| Permisos denegados en uploads | `sudo chown -R www-data:www-data /opt/dropsport/uploads` |
| Base de datos corrupta | Eliminar `app.db` y reiniciar (se recreará con datos demo) |
| Módulo no encontrado | Verificar que el entorno virtual está activado: `source venv/bin/activate` |

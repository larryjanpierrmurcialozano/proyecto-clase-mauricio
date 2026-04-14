from flask import Flask, send_from_directory, jsonify, request
import os
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from werkzeug.utils import secure_filename
import uuid
import datetime
import re
from sqlalchemy import text, inspect
from urllib.parse import quote_plus


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, os.pardir))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')
UPLOADS_DIR = os.path.join(PROJECT_ROOT, 'uploads')
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
DB_PATH = os.path.join(BASE_DIR, 'app.db')


def build_database_url():
    db_url = os.getenv('DATABASE_URL', '').strip()
    if db_url:
        return db_url
    
    # para configurar y que se usa la base de datos en mysql,
    #  se debe usar la variable DB_DRIVER=mysql o configurar DATABASE_URL con la url completa
    # a su vez debe configurar el mysql_password e ingresado los datos de la base de datos mysql
    #  a usar (usuario, contraseña, host, puerto y nombre de la base de datos)
    db_driver = os.getenv('DB_DRIVER', 'mysql').lower().strip()
# todo esto debe estar configurado para los datos del usuario que inicia el servidor y en como
# tenga configurado su mysql y usuarios de mysql
    if db_driver == 'mysql':
        user = os.getenv('MYSQL_USER', 'root').strip()
        password = os.getenv('MYSQL_PASSWORD', '3202964025larry.').strip()
        host = os.getenv('MYSQL_HOST', '127.0.0.1').strip()
        port = os.getenv('MYSQL_PORT', '3306').strip()
        database = os.getenv('MYSQL_DB', 'mauricio').strip()
        safe_password = quote_plus(password) if password else ''
        if safe_password:
            auth = f"{user}:{safe_password}"
        else:
            auth = f"{user}"
        return f"mysql+pymysql://{auth}@{host}:{port}/{database}?charset=utf8mb4"
    return 'sqlite:///' + DB_PATH


app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)
DB_URL = build_database_url()
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
if DB_URL.startswith('mysql'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# --------------- MODELOS ---------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(300), nullable=False)
    role = db.Column(db.String(50), default='cliente')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'email': self.email, 'role': self.role}


class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), default='disponible')
    condition = db.Column(db.String(50), default='bueno')  # bueno | regular | deterioro
    image = db.Column(db.String(400), nullable=True)
    price = db.Column(db.Integer, default=10000, nullable=False)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'status': self.status,
                'condition': self.condition or 'bueno',
                'image': self.image, 'price': self.price}


class Reservation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('item.id'), nullable=False)
    client = db.Column(db.String(200), nullable=False)
    document = db.Column(db.String(50), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    start_date = db.Column(db.String(32), nullable=False)
    end_date = db.Column(db.String(32), nullable=False)
    price = db.Column(db.Integer, default=10000, nullable=False)
    condition_at_loan = db.Column(db.String(50), nullable=True)  # estado al prestar

    def to_dict(self):
        return {'id': self.id, 'item_id': self.item_id, 'client': self.client,
                'document': self.document, 'phone': self.phone,
                'start_date': self.start_date, 'end_date': self.end_date,
                'price': self.price, 'condition_at_loan': self.condition_at_loan}


class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('item.id'), nullable=False)
    ticket_type = db.Column(db.String(50), default='devolucion')  # devolucion | incidencia
    description = db.Column(db.Text, nullable=True)
    condition_before = db.Column(db.String(50), nullable=True)
    condition_after = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(50), default='abierto')  # abierto | en_proceso | cerrado
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        item = Item.query.get(self.item_id)
        return {
            'id': self.id, 'item_id': self.item_id,
            'item_name': item.name if item else 'Eliminado',
            'ticket_type': self.ticket_type, 'description': self.description,
            'condition_before': self.condition_before,
            'condition_after': self.condition_after,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_by': self.created_by
        }


class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(128), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {'token': self.token, 'user_id': self.user_id}


def get_table_columns(table_name):
    inspector = inspect(db.engine)
    if not inspector.has_table(table_name):
        return set()
    return {col['name'] for col in inspector.get_columns(table_name)}


def ensure_db():
    with app.app_context():
        db.create_all()
        try:
            cols = get_table_columns('item')
            if 'image' not in cols:
                db.session.execute(text("ALTER TABLE item ADD COLUMN image VARCHAR(400)"))
            if 'price' not in cols:
                db.session.execute(text("ALTER TABLE item ADD COLUMN price INTEGER DEFAULT 10000"))
            if 'condition' not in cols:
                db.session.execute(text("ALTER TABLE item ADD COLUMN condition VARCHAR(50) DEFAULT 'bueno'"))
            db.session.execute(text("UPDATE item SET price = 10000 WHERE price IS NULL OR price <= 0"))
            db.session.execute(text("UPDATE item SET condition = 'bueno' WHERE condition IS NULL OR condition = ''"))
            db.session.commit()
        except Exception:
            pass

        try:
            cols = get_table_columns('reservation')
            if 'price' not in cols:
                db.session.execute(text("ALTER TABLE reservation ADD COLUMN price INTEGER DEFAULT 10000"))
            if 'document' not in cols:
                db.session.execute(text("ALTER TABLE reservation ADD COLUMN document VARCHAR(50)"))
            if 'phone' not in cols:
                db.session.execute(text("ALTER TABLE reservation ADD COLUMN phone VARCHAR(30)"))
            if 'condition_at_loan' not in cols:
                db.session.execute(text("ALTER TABLE reservation ADD COLUMN condition_at_loan VARCHAR(50)"))
            db.session.execute(text("UPDATE reservation SET price = 10000 WHERE price IS NULL OR price <= 0"))
            db.session.commit()
        except Exception:
            pass

        if os.getenv('SKIP_SEED', '0') != '1':
            seed()


def seed():
    # crea usuario administrador con credenciales proporcionadas por el usuario
    admin_email = 'larryjanpier@gmail.com'
    admin_pass = '3202964025'
    if not User.query.filter_by(email=admin_email).first():
        u = User(name='Larry', email=admin_email, password_hash=generate_password_hash(admin_pass), role='administrador')
        db.session.add(u)
    # sólo insertar artículos demo si la tabla de items está vacía
    cnt = 0
    try:
        cnt = Item.query.count()
    except Exception:
        pass
    if not cnt:
        demo_list = [
            # balones
            ('Pelota fútbol','disponible','https://images.unsplash.com/photo-1473080169841-388967592010?w=200&h=160&fit=crop'),
            ('Balón basketball','disponible','https://images.unsplash.com/photo-1545186641-7a62e913e0ad?w=200&h=160&fit=crop'),
            ('Pelota tenis','alquilado','https://images.unsplash.com/photo-1554224311-beee414c421f?w=200&h=160&fit=crop'),
            ('Balón voleibol','disponible','https://images.unsplash.com/photo-1589965143106-80e85b55a1c7?w=200&h=160&fit=crop'),
            # vestimenta
            ('Jersey deportivo M','disponible','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=160&fit=crop'),
            ('Pantalones deportivos','disponible','https://images.unsplash.com/photo-1506629082632-cf17fef9c869?w=200&h=160&fit=crop'),
            ('Uniforme fútbol','alquilado','https://images.unsplash.com/photo-1598762685941-bff92de46b00?w=200&h=160&fit=crop'),
            # herramientas
            ('Raqueta tenis','disponible','https://images.unsplash.com/photo-1554224311-beee414c421f?w=200&h=160&fit=crop'),
            ('Bate baseball','mantenimiento','https://images.unsplash.com/photo-1540747913ee7b8b54f2b1b1b8d1d6d6d?w=200&h=160&fit=crop'),
            # cancha
            ('Bicicleta montaña','mantenimiento','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=160&fit=crop'),
            ('Patines','alquilado','https://images.unsplash.com/photo-1599821262772-98a0ccd19b94?w=200&h=160&fit=crop'),
            ('Red tenis','disponible','https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=200&h=160&fit=crop'),
            ('Conos entrenamiento','disponible','https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=200&h=160&fit=crop'),
        ]
        # check columns to decide insert style
        try:
            cols = list(get_table_columns('item'))
        except Exception:
            cols = []

        if 'image' in cols:
            for item_data in demo_list:
                name, status = item_data[0], item_data[1]
                image = item_data[2] if len(item_data) > 2 else None
                db.session.add(Item(name=name, status=status, image=image, price=10000))
        else:
            # insertar por SQL directo sin referenciar la columna image
            for item_data in demo_list:
                name, status = item_data[0], item_data[1]
                db.session.execute(text("INSERT INTO item (name,status,price) VALUES (:name,:status,:price)"), {'name':name,'status':status,'price':10000})
    db.session.commit()


def create_session_for_user(user):
    token = uuid.uuid4().hex
    s = Session(token=token, user_id=user.id)
    db.session.add(s)
    db.session.commit()
    return token


def get_user_by_token(token):
    if not token:
        return None
    s = Session.query.filter_by(token=token).first()
    if not s:
        return None
    return User.query.get(s.user_id)


def require_auth(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization','')
        if auth.startswith('Bearer '):
            token = auth.split(' ',1)[1]
        else:
            token = None
        user = get_user_by_token(token)
        if not user:
            return jsonify({'ok': False, 'msg': 'No autorizado'}), 401
        request.current_user = user
        return fn(*args, **kwargs)
    return wrapper


@app.route('/api/me')
def api_me():
    auth = request.headers.get('Authorization','')
    if auth.startswith('Bearer '):
        token = auth.split(' ',1)[1]
    else:
        token = None
    user = get_user_by_token(token)
    if not user:
        return jsonify({'ok': False, 'msg': 'No autorizado'}), 401
    return jsonify({'ok': True, 'user': user.to_dict()})


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:pth>')
def static_proxy(pth):
    if pth.startswith('uploads/'):
        rel_path = pth.split('/', 1)[1]
        fp = os.path.join(UPLOADS_DIR, rel_path)
        if os.path.exists(fp):
            return send_from_directory(UPLOADS_DIR, rel_path)
    if os.path.exists(os.path.join(FRONTEND_DIR, pth)):
        return send_from_directory(FRONTEND_DIR, pth)
    return ('Not Found', 404)


@app.route('/api/ping')
def ping():
    return jsonify({'status': 'ok', 'msg': 'pong'})


@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'cliente')
    if not name or not email or not password:
        return jsonify({'ok': False, 'msg': 'Campos incompletos'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'ok': False, 'msg': 'Correo ya registrado'}), 400
    u = User(name=name, email=email, password_hash=generate_password_hash(password), role=role)
    db.session.add(u)
    db.session.commit()
    return jsonify({'ok': True, 'user': u.to_dict()})


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user = data.get('user')
    password = data.get('password')
    if not user or not password:
        return jsonify({'ok': False, 'msg': 'Datos incompletos'}), 400
    u = User.query.filter((User.email == user) | (User.name == user)).first()
    if not u or not check_password_hash(u.password_hash, password):
        return jsonify({'ok': False, 'msg': 'Credenciales inválidas'}), 401
    token = create_session_for_user(u)
    return jsonify({'ok': True, 'user': u.to_dict(), 'token': token})


@app.route('/api/recover', methods=['POST'])
def api_recover_password():
    data = request.json or {}
    email = (data.get('email') or '').strip()
    password = data.get('password')
    if not email or not password:
        return jsonify({'ok': False, 'msg': 'Datos incompletos'}), 400
    u = User.query.filter_by(email=email).first()
    if not u:
        return jsonify({'ok': False, 'msg': 'Correo no encontrado'}), 404
    u.password_hash = generate_password_hash(password)
    db.session.commit()
    return jsonify({'ok': True, 'msg': 'Contraseña actualizada'})


@app.route('/api/inventory')
def api_inventory():
    items = Item.query.all()
    return jsonify([i.to_dict() for i in items])


@app.route('/api/items', methods=['POST'])
@require_auth
def api_add_item():
    user = request.current_user
    if user.role not in ('administrador','empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    name = data.get('name')
    image = data.get('image')
    raw_price = data.get('price', 10000)
    condition = (data.get('condition') or 'bueno').strip()
    if not name:
        return jsonify({'ok': False, 'msg': 'Nombre requerido'}), 400
    try:
        price = int(raw_price)
    except (TypeError, ValueError):
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    if price < 0:
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    allowed_cond = ('bueno', 'regular', 'deterioro')
    if condition not in allowed_cond:
        condition = 'bueno'
    it = Item(name=name, status='disponible', condition=condition, price=price)
    if image:
        it.image = image
    db.session.add(it)
    db.session.commit()
    return jsonify({'ok': True, 'item': it.to_dict()})


@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'ok': False, 'msg': 'No hay archivo'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'ok': False, 'msg': 'No se seleccionó archivo'}), 400
    filename = secure_filename(f.filename)
    dest = os.path.join(UPLOADS_DIR, filename)
    f.save(dest)
    # devolver una ruta relativa a la raíz del servidor
    url = '/uploads/' + filename
    return jsonify({'ok': True, 'url': url})


@app.route('/uploads/<path:pth>')
def serve_uploads(pth):
    fp = os.path.join(UPLOADS_DIR, pth)
    if os.path.exists(fp):
        return send_from_directory(UPLOADS_DIR, pth)
    return ('Not Found', 404)


@app.route('/api/items/<int:item_id>/status', methods=['POST'])
@require_auth
def api_update_item_status(item_id):
    # sólo empleado o administrador
    user = request.current_user
    if user.role not in ('administrador','empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    status = data.get('status')
    if not status:
        return jsonify({'ok': False, 'msg': 'Status requerido'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    it.status = status
    db.session.commit()
    return jsonify({'ok': True, 'item': it.to_dict()})


@app.route('/api/reservations')
def api_reservations():
    r = Reservation.query.all()
    return jsonify([x.to_dict() for x in r])


@app.route('/api/loan', methods=['POST'])
@require_auth
def api_loan():
    data = request.json or {}
    item_id = data.get('itemId')
    client = data.get('client')
    start = data.get('from')
    end = data.get('to')
    raw_price = data.get('price')
    if not item_id or not client or not start or not end:
        return jsonify({'ok': False, 'msg': 'Campos incompletos'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    if raw_price is None or str(raw_price).strip() == '':
        price = it.price if it.price else 10000
    else:
        try:
            price = int(raw_price)
        except (TypeError, ValueError):
            return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    if price < 0:
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400

    document = (data.get('document') or '').strip()
    phone = (data.get('phone') or '').strip()
    condition_at_loan = it.condition or 'bueno'
    it.status = 'alquilado'
    it.price = price
    r = Reservation(item_id=item_id, client=client, document=document, phone=phone,
                    start_date=start, end_date=end, price=price,
                    condition_at_loan=condition_at_loan)
    db.session.add(r)
    db.session.commit()
    return jsonify({'ok': True, 'reservation': r.to_dict()})


@app.route('/api/items/<int:item_id>/name', methods=['POST'])
@require_auth
def api_update_item_name(item_id):
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    new_name = (data.get('name') or '').strip()
    if not new_name:
        return jsonify({'ok': False, 'msg': 'Nombre requerido'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    it.name = new_name
    db.session.commit()
    return jsonify({'ok': True, 'item': it.to_dict()})


@app.route('/api/items/<int:item_id>/price', methods=['POST'])
@require_auth
def api_update_item_price(item_id):
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    raw_price = data.get('price')
    try:
        price = int(raw_price)
    except (TypeError, ValueError):
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    if price < 0:
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    it.price = price
    db.session.commit()
    return jsonify({'ok': True, 'item': it.to_dict()})


@app.route('/api/items/price-all', methods=['POST'])
@require_auth
def api_update_all_items_price():
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    raw_price = data.get('price')
    try:
        price = int(raw_price)
    except (TypeError, ValueError):
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
    if price < 0:
        return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400

    updated = Item.query.update({Item.price: price})
    db.session.commit()
    return jsonify({'ok': True, 'updated': updated, 'price': price})


@app.route('/api/items/bulk-update', methods=['POST'])
@require_auth
def api_bulk_update_items():
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403

    data = request.json or {}
    ids = data.get('ids') or []
    raw_price = data.get('price', None)
    new_name = (data.get('name') or '').strip()

    if not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'ok': False, 'msg': 'Selecciona al menos un artículo'}), 400

    parsed_ids = []
    for raw_id in ids:
        try:
            parsed_ids.append(int(raw_id))
        except (TypeError, ValueError):
            return jsonify({'ok': False, 'msg': 'IDs inválidos'}), 400

    price = None
    if raw_price is not None:
        try:
            price = int(raw_price)
        except (TypeError, ValueError):
            return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400
        if price < 0:
            return jsonify({'ok': False, 'msg': 'Precio inválido'}), 400

    if price is None and not new_name:
        return jsonify({'ok': False, 'msg': 'No hay cambios para aplicar'}), 400

    items = Item.query.filter(Item.id.in_(parsed_ids)).all()
    if not items:
        return jsonify({'ok': False, 'msg': 'No se encontraron artículos'}), 404

    for it in items:
        if price is not None:
            it.price = price
        if new_name:
            it.name = new_name

    db.session.commit()
    return jsonify({'ok': True, 'updated': len(items)})


@app.route('/api/return', methods=['POST'])
@require_auth
def api_return():
    data = request.json or {}
    item_id = data.get('itemId')
    condition_after = (data.get('condition') or 'bueno').strip()
    description = (data.get('description') or '').strip()
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    allowed = ('bueno', 'regular', 'deterioro')
    if condition_after not in allowed:
        condition_after = 'bueno'
    condition_before = it.condition or 'bueno'
    it.status = 'disponible'
    it.condition = condition_after
    # crear ticket de devolución
    user = request.current_user
    ticket = Ticket(
        item_id=item_id,
        ticket_type='devolucion',
        description=description if description else 'Devolución registrada',
        condition_before=condition_before,
        condition_after=condition_after,
        status='abierto',
        created_by=user.name
    )
    db.session.add(ticket)
    Reservation.query.filter_by(item_id=item_id).delete()
    db.session.commit()
    return jsonify({'ok': True, 'ticket': ticket.to_dict()})


@app.route('/api/items/<int:item_id>', methods=['DELETE'])
@require_auth
def api_delete_item(item_id):
    # sólo administrador puede eliminar
    user = request.current_user
    if user.role not in ('administrador',):
        return jsonify({'ok': False, 'msg': 'Solo administrador puede eliminar'}), 403
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    # Eliminar reservaciones asociadas
    Reservation.query.filter_by(item_id=item_id).delete()
    db.session.delete(it)
    db.session.commit()
    return jsonify({'ok': True, 'msg': 'Artículo eliminado exitosamente'})


# --------------- CONDICIÓN DE ITEMS ---------------

@app.route('/api/items/<int:item_id>/condition', methods=['POST'])
@require_auth
def api_update_item_condition(item_id):
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    condition = (data.get('condition') or '').strip()
    allowed = ('bueno', 'regular', 'deterioro')
    if condition not in allowed:
        return jsonify({'ok': False, 'msg': 'Condición inválida. Use: bueno, regular o deterioro'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    it.condition = condition
    db.session.commit()
    return jsonify({'ok': True, 'item': it.to_dict()})


# --------------- TICKETS ---------------

@app.route('/api/tickets')
@require_auth
def api_tickets():
    status_filter = request.args.get('status', '')
    q = Ticket.query.order_by(Ticket.created_at.desc())
    if status_filter and status_filter in ('abierto', 'en_proceso', 'cerrado'):
        q = q.filter_by(status=status_filter)
    tickets = q.all()
    return jsonify([t.to_dict() for t in tickets])


@app.route('/api/tickets', methods=['POST'])
@require_auth
def api_create_ticket():
    user = request.current_user
    data = request.json or {}
    item_id = data.get('item_id')
    ticket_type = data.get('ticket_type', 'incidencia')
    description = (data.get('description') or '').strip()
    condition_before = (data.get('condition_before') or '').strip()
    condition_after = (data.get('condition_after') or '').strip()
    if not item_id:
        return jsonify({'ok': False, 'msg': 'Artículo requerido'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    if ticket_type not in ('devolucion', 'incidencia', 'mantenimiento', 'alquiler'):
        ticket_type = 'incidencia'
    ticket = Ticket(
        item_id=item_id,
        ticket_type=ticket_type,
        description=description if description else 'Sin descripción',
        condition_before=condition_before or it.condition,
        condition_after=condition_after or it.condition,
        status='abierto',
        created_by=user.name
    )
    db.session.add(ticket)
    db.session.commit()
    return jsonify({'ok': True, 'ticket': ticket.to_dict()})


@app.route('/api/tickets/<int:ticket_id>/status', methods=['POST'])
@require_auth
def api_update_ticket_status(ticket_id):
    user = request.current_user
    if user.role not in ('administrador', 'empleado'):
        return jsonify({'ok': False, 'msg': 'Permisos insuficientes'}), 403
    data = request.json or {}
    new_status = (data.get('status') or '').strip()
    if new_status not in ('abierto', 'en_proceso', 'cerrado'):
        return jsonify({'ok': False, 'msg': 'Estado inválido'}), 400
    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        return jsonify({'ok': False, 'msg': 'Ticket no encontrado'}), 404
    # Optional: update item condition
    new_condition = (data.get('condition_after') or '').strip()
    if new_condition in ('bueno', 'regular', 'deterioro'):
        ticket.condition_after = new_condition
        item = Item.query.get(ticket.item_id)
        if item:
            item.condition = new_condition
    # Optional: update item status (e.g. back to disponible after maintenance)
    item_status = (data.get('item_status') or '').strip()
    if item_status in ('disponible', 'mantenimiento'):
        item = Item.query.get(ticket.item_id)
        if item:
            item.status = item_status
    # Optional: delete item (pérdida total)
    delete_item = data.get('delete_item', False)
    if delete_item:
        item = Item.query.get(ticket.item_id)
        if item:
            # Instead of deleting (FKs/reservations can block delete), mark as eliminado
            item.status = 'eliminado'
            item.condition = 'deterioro'
            # optionally prefix name to indicate removal
            if not (item.name or '').lower().startswith('eliminado'):
                item.name = 'Eliminado - ' + item.name
    # Optional: update resolution notes
    resolution = (data.get('resolution') or '').strip()
    if resolution:
        ticket.description = ticket.description + ' | Resolución: ' + resolution
    ticket.status = new_status
    if new_status == 'cerrado':
        ticket.resolved_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'ticket': ticket.to_dict()})


@app.route('/api/tickets/<int:ticket_id>', methods=['DELETE'])
@require_auth
def api_delete_ticket(ticket_id):
    user = request.current_user
    if user.role not in ('administrador',):
        return jsonify({'ok': False, 'msg': 'Solo administrador puede eliminar tickets'}), 403
    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        return jsonify({'ok': False, 'msg': 'Ticket no encontrado'}), 404
    db.session.delete(ticket)
    db.session.commit()
    return jsonify({'ok': True, 'msg': 'Ticket eliminado'})


# --------------- CLIENT ENDPOINTS ---------------

@app.route('/api/rental-request', methods=['POST'])
@require_auth
def api_rental_request():
    """Client requests to rent an item — creates a ticket of type 'alquiler'."""
    user = request.current_user
    data = request.json or {}
    item_id = data.get('item_id')
    document = (data.get('document') or '').strip()
    phone = (data.get('phone') or '').strip()
    start_date = (data.get('start_date') or '').strip()
    end_date = (data.get('end_date') or '').strip()
    notes = (data.get('notes') or '').strip()
    if not item_id or not start_date or not end_date:
        return jsonify({'ok': False, 'msg': 'Campos incompletos'}), 400
    if not document:
        return jsonify({'ok': False, 'msg': 'Documento requerido'}), 400
    it = Item.query.get(item_id)
    if not it:
        return jsonify({'ok': False, 'msg': 'Artículo no encontrado'}), 404
    if it.status != 'disponible':
        return jsonify({'ok': False, 'msg': 'Artículo no disponible'}), 400
    description = 'Solicitud de alquiler por ' + user.name
    if document:
        description += ' | Doc: ' + document
    if phone:
        description += ' | Tel: ' + phone
    description += ' | Fechas: ' + start_date + ' a ' + end_date
    if notes:
        description += ' | Notas: ' + notes
    ticket = Ticket(
        item_id=item_id,
        ticket_type='alquiler',
        description=description,
        condition_before=it.condition or 'bueno',
        condition_after=it.condition or 'bueno',
        status='abierto',
        created_by=user.name
    )
    db.session.add(ticket)
    db.session.commit()
    return jsonify({'ok': True, 'ticket': ticket.to_dict()})


@app.route('/api/my-tickets')
@require_auth
def api_my_tickets():
    """Return tickets created by the current user."""
    user = request.current_user
    tickets = Ticket.query.filter_by(created_by=user.name).order_by(Ticket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tickets])


@app.route('/api/my-rentals')
@require_auth
def api_my_rentals():
    """Return rental info for the current user based on their alquiler tickets."""
    user = request.current_user
    tickets = Ticket.query.filter_by(created_by=user.name, ticket_type='alquiler').order_by(Ticket.created_at.desc()).all()
    result = []
    for t in tickets:
        item = Item.query.get(t.item_id)
        # Parse dates from description
        desc = t.description or ''
        start_date = ''
        end_date = ''
        if 'Fechas: ' in desc:
            try:
                dates_part = desc.split('Fechas: ')[1].split(' |')[0].strip()
                parts = dates_part.split(' a ')
                if len(parts) == 2:
                    start_date = parts[0].strip()
                    end_date = parts[1].strip()
            except Exception:
                pass
        status = 'pendiente'
        if t.status == 'en_proceso':
            status = 'activo'
        elif t.status == 'cerrado':
            status = 'completado'
        result.append({
            'id': t.id,
            'item_id': t.item_id,
            'item_name': item.name if item else 'Eliminado',
            'start_date': start_date,
            'end_date': end_date,
            'price': item.price if item else 0,
            'status': status,
            'ticket_status': t.status
        })
    return jsonify(result)


if __name__ == '__main__':
    try:
        ensure_db()
    except Exception as e:
        print('Advertencia: fallo al asegurar/actualizar la BD:', e)
    app.run(debug=True, port=5000)

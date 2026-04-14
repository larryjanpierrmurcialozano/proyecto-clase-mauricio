import os
import sqlite3
import datetime
from server import app, db, User, Item, Reservation, Ticket, Session, ensure_db
from sqlalchemy import text


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, os.pardir))
DEFAULT_SQLITE_PATH = os.path.join(SCRIPT_DIR, 'app.db')


def parse_dt(value):
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value
    if isinstance(value, str):
        val = value.strip()
        if not val:
            return None
        try:
            if val.endswith('Z'):
                val = val[:-1] + '+00:00'
            return datetime.datetime.fromisoformat(val)
        except Exception:
            return None
    return None


def load_rows(conn, table_name):
    cur = conn.execute('SELECT * FROM ' + table_name)
    rows = cur.fetchall()
    return rows


def coerce_rows(model, rows):
    cols = [c.name for c in model.__table__.columns]
    results = []
    for row in rows:
        data = {}
        for name in cols:
            if name in row.keys():
                value = row[name]
                if name in ('created_at', 'resolved_at'):
                    parsed = parse_dt(value)
                    value = parsed if parsed is not None else value
                data[name] = value
        results.append(data)
    return results


def table_has_data(model):
    return db.session.query(model).first() is not None


def clear_mysql_data():
    db.session.query(Session).delete()
    db.session.query(Ticket).delete()
    db.session.query(Reservation).delete()
    db.session.query(Item).delete()
    db.session.query(User).delete()
    db.session.commit()


def main():
    sqlite_path = os.getenv('SQLITE_PATH', DEFAULT_SQLITE_PATH)
    if not os.path.exists(sqlite_path):
        fallback = os.path.join(PROJECT_ROOT, 'app.db')
        if os.path.exists(fallback):
            sqlite_path = fallback
    force = os.getenv('MIGRATE_FORCE', '0') == '1'

    if not os.path.exists(sqlite_path):
        print('SQLite DB no encontrada:', sqlite_path)
        return

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row

    with app.app_context():
        if not os.getenv('SKIP_SEED'):
            os.environ['SKIP_SEED'] = '1'
        ensure_db()

        if db.engine.dialect.name != 'mysql':
            print('Destino no es MySQL. Configure DATABASE_URL o DB_DRIVER=mysql.')
            return

        if any([table_has_data(User), table_has_data(Item), table_has_data(Reservation), table_has_data(Ticket), table_has_data(Session)]):
            if not force:
                print('La base de datos destino ya tiene datos. Use MIGRATE_FORCE=1 para sobrescribir.')
                return
            clear_mysql_data()

        try:
            if db.engine.dialect.name == 'mysql':
                db.session.execute(text('SET FOREIGN_KEY_CHECKS=0'))
                db.session.commit()
        except Exception:
            pass

        users = load_rows(conn, 'user')
        items = load_rows(conn, 'item')
        reservations = load_rows(conn, 'reservation')
        tickets = load_rows(conn, 'ticket')
        sessions = load_rows(conn, 'session')

        user_rows = coerce_rows(User, users)
        item_rows = coerce_rows(Item, items)

        db.session.bulk_insert_mappings(User, user_rows)
        db.session.bulk_insert_mappings(Item, item_rows)
        db.session.commit()

        item_ids = {row['id'] for row in item_rows if 'id' in row}
        user_ids = {row['id'] for row in user_rows if 'id' in row}

        reservation_rows = []
        skipped_res = 0
        for row in coerce_rows(Reservation, reservations):
            if row.get('item_id') in item_ids:
                reservation_rows.append(row)
            else:
                skipped_res += 1

        ticket_rows = []
        skipped_tix = 0
        for row in coerce_rows(Ticket, tickets):
            if row.get('item_id') in item_ids:
                ticket_rows.append(row)
            else:
                skipped_tix += 1

        session_rows = []
        skipped_sess = 0
        for row in coerce_rows(Session, sessions):
            if row.get('user_id') in user_ids:
                session_rows.append(row)
            else:
                skipped_sess += 1

        if reservation_rows:
            db.session.bulk_insert_mappings(Reservation, reservation_rows)
        if ticket_rows:
            db.session.bulk_insert_mappings(Ticket, ticket_rows)
        if session_rows:
            db.session.bulk_insert_mappings(Session, session_rows)
        db.session.commit()

        try:
            if db.engine.dialect.name == 'mysql':
                db.session.execute(text('SET FOREIGN_KEY_CHECKS=1'))
                db.session.commit()
        except Exception:
            pass

        print('Migracion completada.')
        print('Usuarios:', len(user_rows))
        print('Items:', len(item_rows))
        print('Reservas:', len(reservation_rows), 'omitidas:', skipped_res)
        print('Tickets:', len(ticket_rows), 'omitidos:', skipped_tix)
        print('Sesiones:', len(session_rows), 'omitidas:', skipped_sess)

    conn.close()


if __name__ == '__main__':
    main()

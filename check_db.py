import server
from sqlalchemy import inspect


def main():
    with server.app.app_context():
        inspector = inspect(server.db.engine)
        tables = ['user', 'item', 'reservation', 'ticket', 'session']
        for table_name in tables:
            if not inspector.has_table(table_name):
                print('Tabla no encontrada:', table_name)
                continue
            cols = [col['name'] for col in inspector.get_columns(table_name)]
            print('Columnas en', table_name + ':', cols)


if __name__ == '__main__':
    main()
